-- Phase 4.3: Create vector search functions
-- Requires pgvector extension (already enabled per schema) and embedding columns
-- These functions are called via supabase.rpc() from the frontend.

-- Search products by embedding similarity
CREATE OR REPLACE FUNCTION match_products(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  p_team_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  description TEXT,
  similarity FLOAT,
  unit_price_ht NUMERIC,
  category_id UUID,
  is_active BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    COALESCE(pt.name, p.name) AS name,
    pt.description AS description,
    1 - (p.embedding <=> query_embedding) AS similarity,
    p.unit_price_ht,
    p.category_id,
    p.is_active
  FROM products p
  LEFT JOIN product_translations pt ON pt.product_id = p.id AND pt.locale = 'fr'
  WHERE p.embedding IS NOT NULL
    AND (p_team_id IS NULL OR p.team_id = p_team_id)
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Search customers by embedding similarity
CREATE OR REPLACE FUNCTION match_customers(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20,
  p_team_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  company_name TEXT,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  n_tahiti TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.company_name,
    c.contact_name,
    c.email,
    c.phone,
    c.n_tahiti,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM customers c
  WHERE c.embedding IS NOT NULL
    AND (p_team_id IS NULL OR c.team_id = p_team_id)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
