-- Migration 00029 : is_fixed_cost flag on expenses for break-even calculation

ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS is_fixed_cost BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS expenses_fixed_cost_idx ON public.expenses(team_id, is_fixed_cost) WHERE is_fixed_cost = TRUE;
