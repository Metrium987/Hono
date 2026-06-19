-- Migration 00002: Auth, Teams & RBAC
-- Apply after 00001_extensions_enums_rls.sql

-- ============================================================
-- Users (synced from auth.users via trigger)
-- ============================================================

CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT,
  full_name       TEXT,
  avatar_url      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data"
  ON public.users FOR SELECT USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE USING ((SELECT auth.uid()) = id);

-- Auto-create public.users row when a new auth.users signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Teams (business entities / companies)
-- ============================================================

CREATE TABLE public.teams (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT,
  phone               TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  island              TEXT,
  postal_code         TEXT,
  country             TEXT DEFAULT 'French Polynesia',

  -- PF Legal Identity
  n_tahiti            TEXT UNIQUE,
  rcs_number          TEXT,
  tax_id              TEXT,
  is_franchise_en_base BOOLEAN DEFAULT FALSE,

  -- Branding
  logo_url            TEXT,
  website             TEXT,
  default_currency_id UUID,

  -- PF Invoice defaults
  invoice_prefix      TEXT DEFAULT 'FAC-',
  quote_prefix        TEXT DEFAULT 'DEV-',
  late_fee_fixed      NUMERIC(10,2) DEFAULT 5000,

  -- Bank details (required on PF invoices)
  bank_name           TEXT,
  bank_rib            TEXT,
  bank_iban           TEXT,
  bank_bic            TEXT,

  timezone            TEXT DEFAULT 'Pacific/Tahiti',

  is_educational_mode BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS teams_n_tahiti_idx ON public.teams(n_tahiti);

-- Team members can view their teams
CREATE POLICY "Team members can view their teams"
  ON public.teams FOR SELECT
  USING (id IN (SELECT public.get_teams_for_authenticated_user()));

-- NOTE: Team UPDATE policy referencing team_members is added
-- after team_members table is created (see bottom of this migration).

-- ============================================================
-- Team Roles (granular JSONB permissions)
-- ============================================================

CREATE TABLE public.team_roles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  permissions   JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS team_roles_team_id_idx ON public.team_roles(team_id);

-- JSONB expression indexes for fast permission lookups
CREATE INDEX IF NOT EXISTS team_roles_permissions_catalog_idx
  ON public.team_roles USING BTREE ((permissions -> 'catalog'));
CREATE INDEX IF NOT EXISTS team_roles_permissions_invoices_idx
  ON public.team_roles USING BTREE ((permissions -> 'invoices'));

CREATE POLICY "Team members can view roles"
  ON public.team_roles FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- NOTE: Team roles ALL policy referencing team_members is added
-- after team_members table is created (see bottom of this migration).

-- ============================================================
-- Team Members (M2M between users and teams)
-- ============================================================

CREATE TABLE public.team_members (
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id       UUID REFERENCES public.team_roles(id) ON DELETE SET NULL,
  is_owner      BOOLEAN DEFAULT FALSE,
  invited_by    UUID REFERENCES public.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members(user_id);

CREATE POLICY "Team members can view members"
  ON public.team_members FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE POLICY "Team owners can manage members"
  ON public.team_members FOR ALL
  USING (public.is_team_owner(team_id));

-- ============================================================
-- Company Invitations (team onboarding via email)
-- ============================================================

CREATE TABLE public.company_invitations (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  role_id         UUID REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  token           TEXT NOT NULL UNIQUE,
  is_owner        BOOLEAN DEFAULT FALSE,
  expires_at      TIMESTAMPTZ NOT NULL,
  accepted_at     TIMESTAMPTZ,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS company_invitations_team_id_idx ON public.company_invitations(team_id);
CREATE INDEX IF NOT EXISTS company_invitations_token_idx ON public.company_invitations(token);

CREATE POLICY "Team scoped company_invitations"
  ON public.company_invitations FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- ============================================================
-- API Keys (AI controllability)
-- ============================================================

CREATE TABLE public.api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id       UUID NOT NULL REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  key_prefix    TEXT NOT NULL,
  key_hash      TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT,
  expires_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS api_keys_team_id_idx ON public.api_keys(team_id);

CREATE POLICY "Team members can view API keys"
  ON public.api_keys FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- NOTE: API keys ALL policy referencing team_members is added
-- after team_members table is created (see bottom of this migration).

-- NOTE: portal_users and portal_login_tokens are created in the CRM
-- module migration (00004) alongside the customers table they reference.

-- ============================================================
-- JWT Auth Hook: Inject custom claims from team_roles
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_user_id UUID;
  v_claims jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;

  -- Get the user's first team role (if any)
  SELECT jsonb_build_object(
    'app_metadata', jsonb_build_object(
      'team_id', tm.team_id,
      'role_name', tr.name,
      'is_owner', tm.is_owner,
      'permissions', tr.permissions
    )
  ) INTO v_claims
  FROM public.team_members tm
  LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  IF v_claims IS NULL THEN
    -- No team membership → must be a portal user (Client)
    -- Return minimal claims
    RETURN jsonb_set(event, '{claims}', event->'claims' || '{}'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', event->'claims' || coalesce(v_claims, '{}'::jsonb));
END;
$$;

-- Grant usage for the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.team_members TO supabase_auth_admin;
GRANT SELECT ON public.team_roles TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- ============================================================
-- Deferred RLS Policies (require team_members to exist first)
-- ============================================================

-- Team owners can update their teams (uses is_team_owner SECURITY DEFINER helper to avoid RLS recursion)
CREATE POLICY "Team owners can update their teams"
  ON public.teams FOR UPDATE
  USING (public.is_team_owner(id));

-- Team owners can manage roles (uses is_team_owner SECURITY DEFINER helper to avoid RLS recursion)
CREATE POLICY "Team owners can manage roles"
  ON public.team_roles FOR ALL
  USING (public.is_team_owner(team_id));

-- Team owners can manage API keys (uses is_team_owner SECURITY DEFINER helper to avoid RLS recursion)
CREATE POLICY "Team owners can manage API keys"
  ON public.api_keys FOR ALL
  USING (public.is_team_owner(team_id));
