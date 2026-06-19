-- Migration 00017: Fix trigger draft bug
-- The trigger trg_invoice_payment_aiud was changing draft invoices with past-due
-- due_date to 'overdue' status. This fix adds a guard clause to skip status
-- changes on draft, cancelled, and refunded invoices.

-- Apply after 00014_fix_portal_rls.sql

CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_paid NUMERIC(15,2);
  v_total_ttc NUMERIC(15,2);
  v_invoice_id UUID;
  v_current_status invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  -- Check current invoice status
  SELECT status INTO v_current_status
  FROM public.invoices WHERE id = v_invoice_id;

  -- Don't change status of draft, cancelled, or refunded invoices
  IF v_current_status IN ('draft', 'cancelled', 'refunded') THEN
    -- Still update paid_amount for accuracy, but don't change status
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.invoice_payments WHERE invoice_id = v_invoice_id;

    UPDATE public.invoices SET
      paid_amount = v_total_paid
    WHERE id = v_invoice_id;

    RETURN COALESCE(NEW, OLD);
  END IF;

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
