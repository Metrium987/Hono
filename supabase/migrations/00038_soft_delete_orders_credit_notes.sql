-- Add soft-delete column to credit_notes and orders
-- Required for P0-3/P0-4 compliance: PF 10-year retention mandate on commercial documents

ALTER TABLE public.credit_notes
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS credit_notes_deleted_at_idx
  ON public.credit_notes(team_id, deleted_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS orders_deleted_at_idx
  ON public.orders(team_id, deleted_at)
  WHERE deleted_at IS NULL;
