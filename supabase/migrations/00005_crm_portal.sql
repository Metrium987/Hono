-- Migration 00005: CRM & Customer Portal
-- Apply after 00004_catalog.sql (depends on customers for portal_users FK)

-- ============================================================
-- Customers (PF-specific: n_tahiti, island, consent tracking)
-- ============================================================

CREATE TABLE public.customers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_name      TEXT,
  contact_name      TEXT NOT NULL,
  is_b2b            BOOLEAN DEFAULT FALSE,
  n_tahiti          TEXT,
  email             TEXT,
  phone             TEXT,
  address_line1     TEXT,
  address_line2     TEXT,
  city              TEXT,
  island            TEXT,
  postal_code       TEXT,
  portal_enabled    BOOLEAN DEFAULT FALSE,
  portal_id         TEXT,
  payment_terms     INTEGER DEFAULT 30,
  notes             TEXT,
  embedding         VECTOR(1536),
  consent_recorded  BOOLEAN DEFAULT FALSE,
  consent_recorded_at TIMESTAMPTZ,
  source            customer_source DEFAULT 'erp',
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT b2b_requires_tahiti CHECK (is_b2b = FALSE OR n_tahiti IS NOT NULL)
);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS customers_team_id_idx ON public.customers(team_id);
CREATE INDEX IF NOT EXISTS customers_team_name_idx ON public.customers(team_id, contact_name);
CREATE UNIQUE INDEX IF NOT EXISTS customers_portal_id_idx ON public.customers(portal_id) WHERE portal_id IS NOT NULL;

CREATE POLICY "Team scoped customers"
  ON public.customers FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- ============================================================
-- CRM Requests & Notes
-- ============================================================

CREATE TABLE public.crm_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subject       TEXT NOT NULL,
  message       TEXT NOT NULL,
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.crm_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS crm_requests_team_id_idx ON public.crm_requests(team_id);
CREATE INDEX IF NOT EXISTS crm_requests_customer_idx ON public.crm_requests(team_id, customer_id);

CREATE POLICY "Team scoped crm_requests"
  ON public.crm_requests FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE TABLE public.crm_notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content       TEXT NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS crm_notes_team_id_idx ON public.crm_notes(team_id);
CREATE INDEX IF NOT EXISTS crm_notes_customer_idx ON public.crm_notes(team_id, customer_id);

CREATE POLICY "Team scoped crm_notes"
  ON public.crm_notes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- ============================================================
-- Customer Portal (separate auth from staff)
-- ============================================================

CREATE TABLE public.portal_users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id       UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  email             TEXT NOT NULL UNIQUE,
  name              TEXT,
  last_login_at     TIMESTAMPTZ,
  token_version     INTEGER DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, email)
);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS portal_users_customer_idx ON public.portal_users(customer_id);

-- Magic link tokens only — no password authentication
CREATE TABLE public.portal_login_tokens (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id  UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  token           TEXT NOT NULL UNIQUE,
  expires_at      TIMESTAMPTZ NOT NULL,
  used_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.portal_login_tokens ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS portal_login_tokens_token_idx ON public.portal_login_tokens(token);
