-- Resize embedding columns from 1536 (OpenAI) to 768 (Google text-embedding-004)
-- Existing embeddings are dropped — they will be regenerated on next product/customer update.

-- Products
DROP INDEX IF EXISTS public.products_embedding_idx;
ALTER TABLE public.products DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.products ADD COLUMN embedding VECTOR(768);
CREATE INDEX products_embedding_idx ON public.products USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Customers
DROP INDEX IF EXISTS public.customers_embedding_idx;
ALTER TABLE public.customers DROP COLUMN IF EXISTS embedding;
ALTER TABLE public.customers ADD COLUMN embedding VECTOR(768);
CREATE INDEX customers_embedding_idx ON public.customers USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- Update vector search functions to use VECTOR(768)
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count     INT,
  p_team_id       UUID
)
RETURNS TABLE (
  id              UUID,
  name            TEXT,
  description     TEXT,
  price_ht        NUMERIC,
  similarity      FLOAT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    p.id,
    p.name,
    p.description,
    p.price_ht,
    1 - (p.embedding <=> query_embedding) AS similarity
  FROM public.products p
  WHERE p.embedding IS NOT NULL AND p.team_id = p_team_id
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
$$;

CREATE OR REPLACE FUNCTION public.match_customers(
  query_embedding VECTOR(768),
  match_threshold FLOAT,
  match_count     INT,
  p_team_id       UUID
)
RETURNS TABLE (
  id           UUID,
  contact_name TEXT,
  company_name TEXT,
  email        TEXT,
  similarity   FLOAT
)
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT
    c.id,
    c.contact_name,
    c.company_name,
    c.email,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.customers c
  WHERE c.embedding IS NOT NULL AND c.team_id = p_team_id
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
$$;

-- Hybrid search wrappers also updated to use 768
CREATE OR REPLACE FUNCTION public.hybrid_search_products(
  p_team_id UUID,
  p_query   TEXT,
  p_limit   INT DEFAULT 20
)
RETURNS SETOF public.products
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT p.*
  FROM public.products p
  WHERE p.team_id = p_team_id
    AND p.is_active = true
    AND (
      p.search_vector @@ plainto_tsquery('french', p_query)
      OR p.name ILIKE '%' || p_query || '%'
    )
  ORDER BY ts_rank(p.search_vector, plainto_tsquery('french', p_query)) DESC
  LIMIT p_limit;
$$;

CREATE OR REPLACE FUNCTION public.hybrid_search_customers(
  p_team_id UUID,
  p_query   TEXT,
  p_limit   INT DEFAULT 20
)
RETURNS SETOF public.customers
LANGUAGE sql STABLE SET search_path = ''
AS $$
  SELECT c.*
  FROM public.customers c
  WHERE c.team_id = p_team_id
    AND (
      c.contact_name ILIKE '%' || p_query || '%'
      OR c.company_name ILIKE '%' || p_query || '%'
      OR c.email ILIKE '%' || p_query || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT p_limit;
$$;
