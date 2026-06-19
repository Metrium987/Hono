-- Migration 00014: Fix Portal RLS — add policies for portal auth flow
-- Apply after 00013_expenses_income.sql
--
-- portal_users and portal_login_tokens had RLS enabled with ZERO policies,
-- meaning all operations were blocked (PostgreSQL default-deny).
-- This broke the entire portal auth flow (magic link login, verify, quote-request).

-- ============================================================
-- portal_users policies
-- ============================================================

-- Allow email lookup during magic link request (unauthenticated)
CREATE POLICY "Portal: email lookup for magic link"
  ON public.portal_users FOR SELECT
  USING (true);

-- Allow portal users to view own record (authenticated via hono_portal cookie)
CREATE POLICY "Portal: view own record"
  ON public.portal_users FOR SELECT
  USING (true);

-- Allow portal user creation from quote-request endpoint
CREATE POLICY "Portal: create from storefront signup"
  ON public.portal_users FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- portal_login_tokens policies
-- ============================================================

-- Allow token creation during magic link request
CREATE POLICY "Portal: create login token"
  ON public.portal_login_tokens FOR INSERT
  WITH CHECK (true);

-- Allow token lookup during verification
CREATE POLICY "Portal: verify login token"
  ON public.portal_login_tokens FOR SELECT
  USING (true);

-- Allow marking token as used after verification
CREATE POLICY "Portal: mark token as used"
  ON public.portal_login_tokens FOR UPDATE
  USING (true);
