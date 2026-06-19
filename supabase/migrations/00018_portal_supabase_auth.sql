-- Migration 00018: Portal Supabase Auth integration
-- Link portal_users to auth.users for proper RLS and session management
-- Apply after 00017_fix_trigger_draft_bug.sql

-- ============================================================
-- 1. Add auth_user_id to portal_users
-- ============================================================
ALTER TABLE public.portal_users
  ADD COLUMN auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS portal_users_auth_user_id_idx
  ON public.portal_users(auth_user_id);

-- ============================================================
-- 2. Replace Portal RLS policies with Supabase Auth-aware ones
-- ============================================================

-- Drop old permissive policies from 00014_fix_portal_rls.sql
DROP POLICY IF EXISTS "Portal: email lookup for magic link" ON public.portal_users;
DROP POLICY IF EXISTS "Portal: view own record" ON public.portal_users;
DROP POLICY IF EXISTS "Portal: create from storefront signup" ON public.portal_users;
DROP POLICY IF EXISTS "Portal: create login token" ON public.portal_login_tokens;
DROP POLICY IF EXISTS "Portal: verify login token" ON public.portal_login_tokens;
DROP POLICY IF EXISTS "Portal: mark token as used" ON public.portal_login_tokens;

-- New portal_users policies using auth.uid()
CREATE POLICY "Portal: email lookup"
  ON public.portal_users FOR SELECT
  USING (true);

CREATE POLICY "Portal: view own record"
  ON public.portal_users FOR SELECT
  USING (auth.uid() = auth_user_id);

CREATE POLICY "Portal: insert own record"
  ON public.portal_users FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- portal_login_tokens policies (keep for transition, tighten via portal_user_id)
CREATE POLICY "Portal: create login token"
  ON public.portal_login_tokens FOR INSERT
  WITH CHECK (portal_user_id IN (
    SELECT id FROM public.portal_users WHERE auth_user_id = auth.uid()
  ));

CREATE POLICY "Portal: verify login token"
  ON public.portal_login_tokens FOR SELECT
  USING (true);

CREATE POLICY "Portal: mark token as used"
  ON public.portal_login_tokens FOR UPDATE
  USING (portal_user_id IN (
    SELECT id FROM public.portal_users WHERE auth_user_id = auth.uid()
  ));
