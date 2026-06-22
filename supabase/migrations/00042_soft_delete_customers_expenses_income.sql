-- Soft-delete sur customers, expenses, income
-- customers : entités métier apparaissant sur factures (rétention 10 ans PF)
-- expenses/income : registres financiers

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.expenses  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.income    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON public.customers(team_id, deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at  ON public.expenses(team_id, deleted_at)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_income_deleted_at    ON public.income(team_id, deleted_at)    WHERE deleted_at IS NULL;
