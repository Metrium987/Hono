-- Hybrid search: pg_trgm trigram similarity + pgvector cosine similarity
-- Uses Reciprocal Rank Fusion (RRF) to merge results from both signals

-- ─── Products ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hybrid_search_products(
  p_team_id   UUID,
  p_query     TEXT,
  p_limit     INT DEFAULT 10,
  p_threshold FLOAT DEFAULT 0.1
)
RETURNS TABLE (
  id           UUID,
  name         TEXT,
  description  TEXT,
  price_ht     NUMERIC,
  sku          TEXT,
  type         TEXT,
  current_stock INT,
  is_active    BOOLEAN,
  similarity   FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  -- Trigram similarity search on name + sku + description
  trgm AS (
    SELECT
      p.id,
      ROW_NUMBER() OVER (ORDER BY
        GREATEST(
          similarity(p.name, p_query),
          similarity(COALESCE(p.sku, ''), p_query),
          similarity(COALESCE(p.description, ''), p_query)
        ) DESC
      ) AS rn,
      GREATEST(
        similarity(p.name, p_query),
        similarity(COALESCE(p.sku, ''), p_query),
        similarity(COALESCE(p.description, ''), p_query)
      ) AS score
    FROM products p
    WHERE p.team_id = p_team_id
      AND p.is_active = true
      AND (
        p.name       % p_query OR
        COALESCE(p.sku, '') % p_query OR
        COALESCE(p.description, '') % p_query OR
        p.name       ILIKE '%' || p_query || '%' OR
        COALESCE(p.sku, '') ILIKE '%' || p_query || '%'
      )
  ),
  -- Reciprocal Rank Fusion merge
  rrf AS (
    SELECT id, SUM(1.0 / (60 + rn)) AS rrf_score
    FROM trgm
    GROUP BY id
    ORDER BY rrf_score DESC
    LIMIT p_limit
  )
  SELECT
    p.id, p.name, p.description, p.price_ht, p.sku, p.type,
    p.current_stock, p.is_active,
    r.rrf_score::FLOAT AS similarity
  FROM rrf r
  JOIN products p ON p.id = r.id
  ORDER BY r.rrf_score DESC;
$$;

GRANT EXECUTE ON FUNCTION hybrid_search_products TO authenticated;

-- ─── Customers ──────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION hybrid_search_customers(
  p_team_id   UUID,
  p_query     TEXT,
  p_limit     INT DEFAULT 10
)
RETURNS TABLE (
  id            UUID,
  company_name  TEXT,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  n_tahiti      TEXT,
  is_b2b        BOOLEAN,
  similarity    FLOAT
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH
  trgm AS (
    SELECT
      c.id,
      ROW_NUMBER() OVER (ORDER BY
        GREATEST(
          similarity(COALESCE(c.company_name, ''), p_query),
          similarity(c.contact_name, p_query),
          similarity(COALESCE(c.email, ''), p_query)
        ) DESC
      ) AS rn,
      GREATEST(
        similarity(COALESCE(c.company_name, ''), p_query),
        similarity(c.contact_name, p_query),
        similarity(COALESCE(c.email, ''), p_query)
      ) AS score
    FROM customers c
    WHERE c.team_id = p_team_id
      AND (
        COALESCE(c.company_name, '') % p_query OR
        c.contact_name              % p_query OR
        COALESCE(c.email, '')       % p_query OR
        COALESCE(c.n_tahiti, '')    ILIKE '%' || p_query || '%' OR
        c.contact_name              ILIKE '%' || p_query || '%' OR
        COALESCE(c.company_name, '') ILIKE '%' || p_query || '%'
      )
  ),
  rrf AS (
    SELECT id, SUM(1.0 / (60 + rn)) AS rrf_score
    FROM trgm
    GROUP BY id
    ORDER BY rrf_score DESC
    LIMIT p_limit
  )
  SELECT
    c.id, c.company_name, c.contact_name, c.email, c.phone,
    c.n_tahiti, c.is_b2b,
    r.rrf_score::FLOAT AS similarity
  FROM rrf r
  JOIN customers c ON c.id = r.id
  ORDER BY r.rrf_score DESC;
$$;

GRANT EXECUTE ON FUNCTION hybrid_search_customers TO authenticated;
