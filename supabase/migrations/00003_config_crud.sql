-- Migration 00003: Configuration CRUD (Tax Rates, Currencies, Payment Methods)
-- Apply after 00002_auth_teams_rbac.sql

-- ============================================================
-- Tax Rates (PF TVA — fully CRUD)
-- ============================================================

CREATE TABLE public.tax_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  rate          NUMERIC(5,2) NOT NULL,
  description   TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS tax_rates_team_id_idx ON public.tax_rates(team_id);

CREATE POLICY "Team scoped tax_rates"
  ON public.tax_rates FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()) OR team_id IS NULL);

-- ============================================================
-- Currencies (fully CRUD, manual exchange rates)
-- ============================================================

CREATE TABLE public.currencies (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  code                TEXT NOT NULL,
  name                TEXT NOT NULL,
  symbol              TEXT NOT NULL,
  symbol_position     TEXT DEFAULT 'prefix' CHECK (symbol_position IN ('prefix', 'suffix')),
  is_default          BOOLEAN DEFAULT FALSE,
  exchange_rate_to_xpf NUMERIC(15,6),   -- Manual entry only — 1 XPF = ? of this currency
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, code)
);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS currencies_team_id_idx ON public.currencies(team_id);

CREATE POLICY "Team scoped currencies"
  ON public.currencies FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()) OR team_id IS NULL);

-- ============================================================
-- Payment Methods (local-first, fully CRUD)
-- ============================================================

CREATE TABLE public.payment_methods (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  is_online     BOOLEAN DEFAULT FALSE,
  config        JSONB,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS payment_methods_team_id_idx ON public.payment_methods(team_id);

CREATE POLICY "Team scoped payment_methods"
  ON public.payment_methods FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()) OR team_id IS NULL);

-- Add FK from teams to currencies
ALTER TABLE public.teams
  ADD CONSTRAINT teams_default_currency_fkey
  FOREIGN KEY (default_currency_id) REFERENCES public.currencies(id)
  ON DELETE SET NULL;
