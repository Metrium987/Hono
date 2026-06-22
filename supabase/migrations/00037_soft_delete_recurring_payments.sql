-- Add soft-delete support to recurring_invoices and invoice_payments
-- Recurring invoice templates and payment records are financial audit trail — never hard-delete

ALTER TABLE public.recurring_invoices
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.invoice_payments
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS recurring_invoices_deleted_at_idx
  ON public.recurring_invoices(deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS invoice_payments_deleted_at_idx
  ON public.invoice_payments(deleted_at)
  WHERE deleted_at IS NULL;
