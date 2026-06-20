-- Migration 00031: Fix JWT hook overwritten by 00019 + drop cross-tenant numbering functions
--
-- 00019 replaced the full custom_access_token_hook (which injected team_id, role_name,
-- is_owner, permissions) with a simplified version injecting only user_id.
-- This migration restores the correct hook while keeping SECURITY DEFINER + search_path fix.
--
-- 00019 also created no-param overloads of generate_next_*_number() with no team_id filter
-- (cross-tenant bug). Those overloads are dropped here.

-- ============================================================
-- 1. Restore full custom_access_token_hook
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID;
  v_claims  jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;

  SELECT jsonb_build_object(
    'app_metadata', jsonb_build_object(
      'team_id',     tm.team_id,
      'role_name',   tr.name,
      'is_owner',    tm.is_owner,
      'permissions', tr.permissions
    )
  ) INTO v_claims
  FROM public.team_members tm
  LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  -- No team membership (portal user or unassigned) → return claims unchanged
  IF v_claims IS NULL THEN
    RETURN jsonb_set(event, '{claims}', event -> 'claims' || '{}'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', event -> 'claims' || v_claims);
END;
$$;

-- Re-grant to supabase_auth_admin (safe to repeat)
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.team_members TO supabase_auth_admin;
GRANT SELECT ON public.team_roles TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- ============================================================
-- 2. Drop cross-tenant numbering overloads (no team_id param)
-- ============================================================

-- These overloads were created by 00019 without a team_id filter.
-- The correct versions with (p_team_id UUID) from 00008 are kept.
DROP FUNCTION IF EXISTS public.generate_next_invoice_number();
DROP FUNCTION IF EXISTS public.generate_next_quote_number();
