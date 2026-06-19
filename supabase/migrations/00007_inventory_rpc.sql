-- Migration 00007: Inventory RPC & API Key Verification
-- Apply after 00006_post_deploy_fixes.sql

-- ============================================================
-- Low Stock Detection RPC
-- Returns products where current_stock <= low_stock_alert
-- PostgREST can't compare two columns, so this RPC is needed.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_low_stock_products(
  p_team_id UUID,
  p_page INT DEFAULT 1,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  sku TEXT,
  current_stock NUMERIC,
  low_stock_alert INTEGER,
  unit TEXT,
  category_id UUID
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_offset INT;
BEGIN
  v_offset := (GREATEST(p_page, 1) - 1) * p_limit;

  RETURN QUERY
  SELECT
    p.id, p.name, p.sku,
    p.current_stock, p.low_stock_alert,
    p.unit, p.category_id
  FROM public.products p
  WHERE p.team_id = p_team_id
    AND p.track_stock = TRUE
    AND p.low_stock_alert IS NOT NULL
    AND p.current_stock <= p.low_stock_alert::NUMERIC
  ORDER BY p.current_stock ASC, p.name ASC
  LIMIT p_limit
  OFFSET v_offset;
END;
$$;

COMMENT ON FUNCTION public.get_low_stock_products IS
  'Returns products where current_stock <= low_stock_alert for a given team.';

-- ============================================================
-- API Key Verification RPC
-- Verifies a Bearer token against stored hashed API keys.
-- Uses pgcrypto (SHA-256) for hash comparison.
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_api_key(p_token_hash TEXT)
RETURNS TABLE (
  team_id UUID,
  role_id UUID,
  key_id UUID,
  key_name TEXT,
  permissions JSONB,
  is_owner BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.team_id,
    ak.role_id,
    ak.id,
    ak.name,
    tr.permissions,
    COALESCE(tm.is_owner, FALSE)
  FROM public.api_keys ak
  LEFT JOIN public.team_roles tr ON ak.role_id = tr.id
  LEFT JOIN public.team_members tm ON tm.team_id = ak.team_id AND tm.role_id = ak.role_id AND tm.is_owner = TRUE
  WHERE ak.key_hash = p_token_hash
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
  LIMIT 1;
END;
$$;

COMMENT ON FUNCTION public.verify_api_key IS
  'Verifies an API key by comparing its SHA-256 hash against stored keys. Returns team context if valid.';
