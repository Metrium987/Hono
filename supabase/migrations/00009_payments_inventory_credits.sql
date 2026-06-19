-- Migration 00009: Payments, Inventory Triggers & Credit Notes
-- Apply after 00008_billing_quotes_invoices.sql

-- ============================================================
-- Invoice Payments (with auto-status trigger)
-- ============================================================

CREATE TABLE public.invoice_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount            NUMERIC(15,2) NOT NULL,
  currency_id       UUID NOT NULL,
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),
  reference         TEXT,
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON public.invoice_payments(invoice_id, payment_date);

CREATE POLICY "Team scoped invoice_payments"
  ON public.invoice_payments FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
  ));

-- Trigger: auto-update invoice status on payment change
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_paid NUMERIC(15,2);
  v_total_ttc NUMERIC(15,2);
  v_invoice_id UUID;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.invoice_payments WHERE invoice_id = v_invoice_id;

  SELECT total_ttc INTO v_total_ttc
  FROM public.invoices WHERE id = v_invoice_id;

  UPDATE public.invoices SET
    paid_amount = v_total_paid,
    status = CASE
      WHEN v_total_paid >= v_total_ttc THEN 'paid'::invoice_status
      WHEN v_total_paid > 0 THEN 'partial'::invoice_status
      WHEN due_date < CURRENT_DATE THEN 'overdue'::invoice_status
      ELSE 'sent'::invoice_status
    END,
    paid_at = CASE WHEN v_total_paid >= v_total_ttc THEN NOW() ELSE NULL END
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END; $$;

CREATE TRIGGER trg_invoice_payment_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

-- ============================================================
-- Invoice Number History (Free Mode renumbering audit trail)
-- ============================================================

CREATE TABLE public.invoice_number_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  old_number      TEXT NOT NULL,
  new_number      TEXT NOT NULL,
  changed_by      UUID REFERENCES public.users(id),
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS invoice_number_history_invoice_idx
  ON public.invoice_number_history(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_number_history_old_number_idx
  ON public.invoice_number_history(old_number);

-- ============================================================
-- Credit Notes
-- ============================================================

CREATE TABLE public.credit_notes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id          UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  credit_note_number  TEXT NOT NULL,
  status              TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  reason              TEXT,
  subtotal_ht         NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount          NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc           NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id         UUID NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, credit_note_number)
);

ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS credit_notes_team_id_idx ON public.credit_notes(team_id);
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON public.credit_notes(invoice_id);

CREATE POLICY "Team scoped credit_notes"
  ON public.credit_notes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE TABLE public.credit_note_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id  UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht   NUMERIC(15,2) NOT NULL,
  tax_rate_id     UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht   NUMERIC(15,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS credit_note_items_note_idx ON public.credit_note_items(credit_note_id);

-- ============================================================
-- Stock Deduction Trigger (Invoice Finalization)
-- When invoice status changes to 'sent' or 'paid', deduct stock
-- for tracked products and record in immutable inventory_ledger.
-- ============================================================

CREATE OR REPLACE FUNCTION public.deduct_invoice_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_item RECORD;
  v_current_stock NUMERIC(10,2);
  v_new_balance NUMERIC(10,2);
BEGIN
  -- Only run when status changes TO 'sent' or 'paid'
  IF (OLD.status NOT IN ('sent', 'paid') AND NEW.status IN ('sent', 'paid')) THEN
    FOR v_item IN
      SELECT ii.product_id, ii.quantity, p.current_stock, p.track_stock
      FROM public.invoice_items ii
      JOIN public.products p ON ii.product_id = p.id
      WHERE ii.invoice_id = NEW.id AND p.track_stock = TRUE
    LOOP
      v_current_stock := COALESCE(v_item.current_stock, 0);
      v_new_balance := v_current_stock - v_item.quantity;

      -- Update product current_stock
      UPDATE public.products SET current_stock = v_new_balance
      WHERE id = v_item.product_id;

      -- Record immutable ledger entry
      INSERT INTO public.inventory_ledger (
        team_id, product_id, transaction_type, quantity_change,
        running_balance, reference_type, reference_id, description
      ) VALUES (
        NEW.team_id, v_item.product_id, 'invoice_deduction',
        -v_item.quantity, v_new_balance,
        'invoice', NEW.id,
        'Invoice ' || NEW.invoice_number || ' — line item deduction'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoice_stock_deduction
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status NOT IN ('sent', 'paid') AND NEW.status IN ('sent', 'paid'))
  EXECUTE FUNCTION public.deduct_invoice_stock();
