-- Migration 00008: Billing Core — Numbering, Quotes, Invoices, Events
-- Apply after 00007_inventory_rpc.sql

-- ============================================================
-- Invoice Numbering Rules (atomic UPSERT sequences)
-- ============================================================

CREATE TABLE public.invoice_number_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID UNIQUE NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_pattern     TEXT DEFAULT '{PREFIX}{YEAR}-{SEQUENCE}',
  quote_pattern       TEXT DEFAULT '{PREFIX}{YEAR}-{SEQUENCE}',
  reset_period        TEXT DEFAULT 'yearly' CHECK (reset_period IN ('yearly', 'monthly', 'never')),
  last_invoice_sequence INTEGER DEFAULT 0,
  last_quote_sequence    INTEGER DEFAULT 0,
  last_period_key     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.invoice_number_rules ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS invoice_number_rules_team_idx ON public.invoice_number_rules(team_id);

CREATE POLICY "Team scoped invoice_number_rules"
  ON public.invoice_number_rules FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Atomic invoice number generator (UPSERT pattern — no race conditions)
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT; v_year TEXT; v_sequence INTEGER; v_period_key TEXT; v_result TEXT;
BEGIN
  SELECT invoice_prefix, EXTRACT(YEAR FROM NOW())::TEXT INTO v_prefix, v_year
  FROM public.teams WHERE id = p_team_id;
  v_period_key := v_year;

  INSERT INTO public.invoice_number_rules (team_id, last_invoice_sequence, last_period_key)
  VALUES (p_team_id, 1, v_period_key)
  ON CONFLICT (team_id) DO UPDATE SET
    last_invoice_sequence = CASE WHEN invoice_number_rules.last_period_key = v_period_key
      THEN invoice_number_rules.last_invoice_sequence + 1 ELSE 1 END,
    last_period_key = v_period_key
  RETURNING last_invoice_sequence INTO v_sequence;

  RETURN v_prefix || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END; $$;

-- Atomic quote number generator
CREATE OR REPLACE FUNCTION public.generate_next_quote_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  v_prefix TEXT; v_year TEXT; v_sequence INTEGER; v_period_key TEXT; v_result TEXT;
BEGIN
  SELECT quote_prefix, EXTRACT(YEAR FROM NOW())::TEXT INTO v_prefix, v_year
  FROM public.teams WHERE id = p_team_id;
  v_period_key := v_year;

  INSERT INTO public.invoice_number_rules (team_id, last_quote_sequence, last_period_key)
  VALUES (p_team_id, 1, v_period_key)
  ON CONFLICT (team_id) DO UPDATE SET
    last_quote_sequence = CASE WHEN invoice_number_rules.last_period_key = v_period_key
      THEN invoice_number_rules.last_quote_sequence + 1 ELSE 1 END,
    last_period_key = v_period_key
  RETURNING last_quote_sequence INTO v_sequence;

  RETURN v_prefix || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END; $$;

-- ============================================================
-- Quotes
-- ============================================================

CREATE TABLE public.quotes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_number    TEXT NOT NULL,
  status          quote_status DEFAULT 'draft',
  subtotal_ht     NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id     UUID NOT NULL,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date   DATE,
  converted_to_invoice_id UUID,
  notes           TEXT,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, quote_number)
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS quotes_team_id_idx ON public.quotes(team_id);
CREATE INDEX IF NOT EXISTS quotes_team_status_idx ON public.quotes(team_id, status);
CREATE INDEX IF NOT EXISTS quotes_customer_idx ON public.quotes(team_id, customer_id);

CREATE POLICY "Team scoped quotes"
  ON public.quotes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE TABLE public.quote_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id        UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht   NUMERIC(15,2) NOT NULL,
  tax_rate_id     UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht   NUMERIC(15,2) NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items(quote_id);

-- ============================================================
-- Invoices
-- ============================================================

CREATE TABLE public.invoices (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id       UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_id          UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_number    TEXT NOT NULL,
  status            invoice_status DEFAULT 'draft',
  issue_date        DATE NOT NULL DEFAULT CURRENT_DATE,
  service_date      DATE,
  due_date          DATE NOT NULL,
  paid_at           TIMESTAMPTZ,
  subtotal_ht       NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount        NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc         NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount       NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id       UUID NOT NULL,
  late_fee_fixed    NUMERIC(10,2) DEFAULT 5000,
  legal_vat_mention TEXT,
  legal_mentions    TEXT,
  discount_type     discount_type,
  discount_value    NUMERIC(15,2) DEFAULT 0,
  discount_amount   NUMERIC(15,2) DEFAULT 0,
  invoice_recurring_id UUID,
  recurring_sequence INTEGER,
  viewed_at         TIMESTAMPTZ,
  reminder_sent_at  TIMESTAMPTZ,
  notes             TEXT,
  message           TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  deleted_at        TIMESTAMPTZ,
  UNIQUE(team_id, invoice_number)
);

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS invoices_team_id_idx ON public.invoices(team_id);
CREATE INDEX IF NOT EXISTS invoices_team_status_idx ON public.invoices(team_id, status);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON public.invoices(team_id, customer_id);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON public.invoices(team_id, due_date);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON public.invoices(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_active_idx ON public.invoices(team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS invoices_recurring_idx ON public.invoices(invoice_recurring_id) WHERE invoice_recurring_id IS NOT NULL;

CREATE POLICY "Team scoped invoices"
  ON public.invoices FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Soft-delete view
CREATE VIEW public.active_invoices AS
  SELECT * FROM public.invoices WHERE deleted_at IS NULL;

-- ============================================================
-- Invoice Items & Groups
-- ============================================================

CREATE TABLE public.invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  group_id        UUID,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht   NUMERIC(15,2) NOT NULL,
  tax_rate_id     UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht   NUMERIC(15,2) NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);

CREATE TABLE public.invoice_item_groups (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS invoice_item_groups_invoice_idx ON public.invoice_item_groups(invoice_id);

-- ============================================================
-- Invoice Events (Audit Trail)
-- ============================================================

CREATE TABLE public.invoice_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type    invoice_event_type NOT NULL,
  payload       JSONB,
  created_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx ON public.invoice_events(invoice_id, created_at DESC);

CREATE POLICY "Team scoped invoice_events"
  ON public.invoice_events FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
  ));
