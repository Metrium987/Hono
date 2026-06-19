-- Migration 00013: Expenses & Income Tables
-- Adds expense_categories, vendors, expenses, income_categories, income tables
-- Part of Phase 7: Reports & Polish

-- ============================================================
-- EXPENSE CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS expense_categories_team_id_idx ON public.expense_categories(team_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team scoped expense_categories' AND tablename = 'expense_categories') THEN
    CREATE POLICY "Team scoped expense_categories" ON public.expense_categories FOR ALL
      USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
  END IF;
END $$;

-- ============================================================
-- VENDORS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.vendors (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  address       TEXT,
  n_tahiti      TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS vendors_team_id_idx ON public.vendors(team_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team scoped vendors' AND tablename = 'vendors') THEN
    CREATE POLICY "Team scoped vendors" ON public.vendors FOR ALL
      USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
  END IF;
END $$;

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.expenses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor_id       UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name     TEXT,
  description     TEXT NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency_id     UUID NOT NULL REFERENCES public.currencies(id),
  expense_date    DATE NOT NULL,
  receipt_url     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS expenses_team_id_idx ON public.expenses(team_id);
CREATE INDEX IF NOT EXISTS expenses_team_date_idx ON public.expenses(team_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses(team_id, category_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team scoped expenses' AND tablename = 'expenses') THEN
    CREATE POLICY "Team scoped expenses" ON public.expenses FOR ALL
      USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
  END IF;
END $$;

-- ============================================================
-- INCOME CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.income_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS income_categories_team_id_idx ON public.income_categories(team_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team scoped income_categories' AND tablename = 'income_categories') THEN
    CREATE POLICY "Team scoped income_categories" ON public.income_categories FOR ALL
      USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
  END IF;
END $$;

-- ============================================================
-- INCOME (non-invoice revenue)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.income (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES public.income_categories(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  amount          NUMERIC(15,2) NOT NULL,
  currency_id     UUID NOT NULL REFERENCES public.currencies(id),
  income_date     DATE NOT NULL,
  customer_id     UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  receipt_url     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS income_team_id_idx ON public.income(team_id);
CREATE INDEX IF NOT EXISTS income_team_date_idx ON public.income(team_id, income_date DESC);
CREATE INDEX IF NOT EXISTS income_category_idx ON public.income(team_id, category_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Team scoped income' AND tablename = 'income') THEN
    CREATE POLICY "Team scoped income" ON public.income FOR ALL
      USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
  END IF;
END $$;
