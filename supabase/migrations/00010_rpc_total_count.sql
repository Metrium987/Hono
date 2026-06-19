-- Migration 00010: Update low stock RPC with total_count for pagination
-- Apply after 00009_payments_inventory_credits.sql

-- Must drop first because PostgreSQL cannot change return type in CREATE OR REPLACE
DROP FUNCTION IF EXISTS public.get_low_stock_products(UUID, INT, INT);

CREATE FUNCTION public.get_low_stock_products(
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
  category_id UUID,
  total_count BIGINT
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
    p.unit, p.category_id,
    COUNT(*) OVER()::BIGINT AS total_count
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
