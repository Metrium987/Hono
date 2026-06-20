-- ============================================================
-- DELTA AUDIT — Corrections sécurité + RPCs atomiques
-- Contenu des ex-migrations 00035 et 00036 (jamais appliquées en remote)
-- ============================================================

-- ============================================================
-- 1. Vue active_invoices avec security_invoker
-- ============================================================
DROP VIEW IF EXISTS public.active_invoices CASCADE;
CREATE VIEW public.active_invoices WITH (security_invoker = true) AS
  SELECT * FROM public.invoices WHERE deleted_at IS NULL;

-- ============================================================
-- 2. Colonne last_credit_note_sequence (manquante sur remote)
-- ============================================================
ALTER TABLE public.invoice_number_rules
  ADD COLUMN IF NOT EXISTS last_credit_note_sequence INTEGER DEFAULT 0 NOT NULL;

-- ============================================================
-- 3. Colonnes period_key séparées par séquence (fix bug year rollover)
-- ============================================================
ALTER TABLE public.invoice_number_rules
  ADD COLUMN IF NOT EXISTS last_invoice_period_key TEXT,
  ADD COLUMN IF NOT EXISTS last_quote_period_key TEXT,
  ADD COLUMN IF NOT EXISTS last_credit_note_period_key TEXT;

-- Seed depuis last_period_key existant
UPDATE public.invoice_number_rules SET
  last_invoice_period_key     = COALESCE(last_invoice_period_key,     last_period_key),
  last_quote_period_key       = COALESCE(last_quote_period_key,       last_period_key),
  last_credit_note_period_key = COALESCE(last_credit_note_period_key, last_period_key);

-- ============================================================
-- 4. Générateurs de séquences — version finale avec period_key indépendants
-- ============================================================

CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prefix TEXT; v_year TEXT; v_sequence INTEGER;
BEGIN
  SELECT invoice_prefix, EXTRACT(YEAR FROM NOW())::TEXT INTO v_prefix, v_year
  FROM public.teams WHERE id = p_team_id;
  INSERT INTO public.invoice_number_rules (team_id, last_invoice_sequence, last_invoice_period_key)
  VALUES (p_team_id, 1, v_year)
  ON CONFLICT (team_id) DO UPDATE SET
    last_invoice_sequence = CASE WHEN public.invoice_number_rules.last_invoice_period_key = v_year
      THEN public.invoice_number_rules.last_invoice_sequence + 1 ELSE 1 END,
    last_invoice_period_key = v_year
  RETURNING last_invoice_sequence INTO v_sequence;
  RETURN v_prefix || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_next_quote_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_prefix TEXT; v_year TEXT; v_sequence INTEGER;
BEGIN
  SELECT quote_prefix, EXTRACT(YEAR FROM NOW())::TEXT INTO v_prefix, v_year
  FROM public.teams WHERE id = p_team_id;
  INSERT INTO public.invoice_number_rules (team_id, last_quote_sequence, last_quote_period_key)
  VALUES (p_team_id, 1, v_year)
  ON CONFLICT (team_id) DO UPDATE SET
    last_quote_sequence = CASE WHEN public.invoice_number_rules.last_quote_period_key = v_year
      THEN public.invoice_number_rules.last_quote_sequence + 1 ELSE 1 END,
    last_quote_period_key = v_year
  RETURNING last_quote_sequence INTO v_sequence;
  RETURN v_prefix || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END; $$;

CREATE OR REPLACE FUNCTION public.generate_next_credit_note_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_year TEXT; v_sequence INTEGER;
BEGIN
  v_year := EXTRACT(YEAR FROM NOW())::TEXT;
  INSERT INTO public.invoice_number_rules (team_id, last_credit_note_sequence, last_credit_note_period_key)
  VALUES (p_team_id, 1, v_year)
  ON CONFLICT (team_id) DO UPDATE SET
    last_credit_note_sequence = CASE WHEN public.invoice_number_rules.last_credit_note_period_key = v_year
      THEN public.invoice_number_rules.last_credit_note_sequence + 1 ELSE 1 END,
    last_credit_note_period_key = v_year
  RETURNING last_credit_note_sequence INTO v_sequence;
  RETURN 'AV-' || v_year || '-' || LPAD(v_sequence::TEXT, 4, '0');
END; $$;

-- ============================================================
-- 5. verify_api_key + convert_quote_to_invoice — search_path sécurisé
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_api_key(p_token_hash TEXT)
RETURNS TABLE (team_id UUID, role_id UUID, key_id UUID, key_name TEXT, permissions JSONB, is_owner BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT ak.team_id, ak.role_id, ak.id, ak.name, tr.permissions, ak.is_owner
  FROM public.api_keys ak
  LEFT JOIN public.team_roles tr ON ak.role_id = tr.id
  WHERE ak.key_hash = p_token_hash
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
  LIMIT 1;
END; $$;

CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(p_quote_id UUID, p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_invoice_id UUID; v_invoice_number TEXT; v_quote RECORD;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id AND team_id = p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF v_quote.status = 'converted' THEN RAISE EXCEPTION 'Quote already converted to invoice'; END IF;
  IF v_quote.status IN ('rejected', 'expired') THEN RAISE EXCEPTION 'Cannot convert a rejected or expired quote'; END IF;

  v_invoice_number := public.generate_next_invoice_number(p_team_id);

  INSERT INTO public.invoices (
    team_id, customer_id, quote_id, invoice_number, status,
    issue_date, due_date, subtotal_ht, tax_amount, total_ttc, currency_id, notes
  ) VALUES (
    v_quote.team_id, v_quote.customer_id, v_quote.id, v_invoice_number, 'draft',
    CURRENT_DATE, CURRENT_DATE + INTERVAL '30 days',
    v_quote.subtotal_ht, v_quote.tax_amount, v_quote.total_ttc, v_quote.currency_id, v_quote.notes
  ) RETURNING id INTO v_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
  SELECT v_invoice_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order
  FROM public.quote_items WHERE quote_id = p_quote_id;

  UPDATE public.quotes SET status = 'converted', converted_to_invoice_id = v_invoice_id, updated_at = NOW()
  WHERE id = p_quote_id;

  INSERT INTO public.invoice_events (invoice_id, event_type, payload, created_at)
  VALUES (v_invoice_id, 'created',
    jsonb_build_object('source', 'quote_conversion', 'quote_id', p_quote_id, 'quote_number', v_quote.quote_number), NOW());

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_number);
END; $$;

-- ============================================================
-- 6. Fonctions recherche vectorielle — search_path sécurisé
-- ============================================================

CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding VECTOR(1536), match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20, p_team_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, name TEXT, description TEXT, similarity FLOAT, unit_price_ht NUMERIC, category_id UUID, is_active BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_team_id IS NULL THEN RAISE EXCEPTION 'p_team_id is required'; END IF;
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  SELECT p.id, COALESCE(pt.name, p.name), pt.description,
    1 - (p.embedding <=> query_embedding), p.price_ht, p.category_id, p.is_active
  FROM public.products p
  LEFT JOIN public.product_translations pt ON pt.product_id = p.id AND pt.locale = 'fr'
  WHERE p.embedding IS NOT NULL AND p.team_id = p_team_id
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding LIMIT match_count;
END; $$;

CREATE OR REPLACE FUNCTION public.match_customers(
  query_embedding VECTOR(1536), match_threshold FLOAT DEFAULT 0.7,
  match_count INT DEFAULT 20, p_team_id UUID DEFAULT NULL
)
RETURNS TABLE(id UUID, company_name TEXT, contact_name TEXT, email TEXT, phone TEXT, n_tahiti TEXT, similarity FLOAT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_team_id IS NULL THEN RAISE EXCEPTION 'p_team_id is required'; END IF;
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  SELECT c.id, c.company_name, c.contact_name, c.email, c.phone, c.n_tahiti,
    1 - (c.embedding <=> query_embedding)
  FROM public.customers c
  WHERE c.embedding IS NOT NULL AND c.team_id = p_team_id
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding LIMIT match_count;
END; $$;

CREATE OR REPLACE FUNCTION public.hybrid_search_products(
  p_team_id UUID, p_query TEXT, p_limit INT DEFAULT 10, p_threshold FLOAT DEFAULT 0.1
)
RETURNS TABLE(id UUID, name TEXT, description TEXT, price_ht NUMERIC, sku TEXT, type TEXT, current_stock INT, is_active BOOLEAN, similarity FLOAT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  WITH trgm AS (
    SELECT p.id,
      ROW_NUMBER() OVER (ORDER BY GREATEST(similarity(p.name, p_query), similarity(COALESCE(p.sku,''), p_query), similarity(COALESCE(p.description,''), p_query)) DESC) AS rn
    FROM public.products p
    WHERE p.team_id = p_team_id AND p.is_active = true
      AND (p.name % p_query OR COALESCE(p.sku,'') % p_query OR COALESCE(p.description,'') % p_query
        OR p.name ILIKE '%'||p_query||'%' OR COALESCE(p.sku,'') ILIKE '%'||p_query||'%')
  ),
  rrf AS (SELECT trgm.id, SUM(1.0/(60+rn)) AS rrf_score FROM trgm GROUP BY trgm.id ORDER BY rrf_score DESC LIMIT p_limit)
  SELECT p.id, p.name, p.description, p.price_ht, p.sku, p.type::TEXT, p.current_stock::INT, p.is_active, r.rrf_score::FLOAT
  FROM rrf r JOIN public.products p ON p.id = r.id ORDER BY r.rrf_score DESC;
END; $$;

CREATE OR REPLACE FUNCTION public.hybrid_search_customers(
  p_team_id UUID, p_query TEXT, p_limit INT DEFAULT 10
)
RETURNS TABLE(id UUID, company_name TEXT, contact_name TEXT, email TEXT, phone TEXT, n_tahiti TEXT, is_b2b BOOLEAN, similarity FLOAT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  WITH trgm AS (
    SELECT c.id,
      ROW_NUMBER() OVER (ORDER BY GREATEST(similarity(COALESCE(c.company_name,''), p_query), similarity(c.contact_name, p_query), similarity(COALESCE(c.email,''), p_query)) DESC) AS rn
    FROM public.customers c
    WHERE c.team_id = p_team_id
      AND (COALESCE(c.company_name,'') % p_query OR c.contact_name % p_query OR COALESCE(c.email,'') % p_query
        OR COALESCE(c.n_tahiti,'') ILIKE '%'||p_query||'%' OR c.contact_name ILIKE '%'||p_query||'%'
        OR COALESCE(c.company_name,'') ILIKE '%'||p_query||'%')
  ),
  rrf AS (SELECT trgm.id, SUM(1.0/(60+rn)) AS rrf_score FROM trgm GROUP BY trgm.id ORDER BY rrf_score DESC LIMIT p_limit)
  SELECT c.id, c.company_name, c.contact_name, c.email, c.phone, c.n_tahiti, c.is_b2b, r.rrf_score::FLOAT
  FROM rrf r JOIN public.customers c ON c.id = r.id ORDER BY r.rrf_score DESC;
END; $$;

-- ============================================================
-- 7. RPCs atomiques replace_invoice_items / replace_quote_items
-- ============================================================

CREATE OR REPLACE FUNCTION public.replace_invoice_items(p_invoice_id UUID, p_team_id UUID, p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id AND team_id = p_team_id) THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;
  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;
  INSERT INTO public.invoice_items (invoice_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
  SELECT p_invoice_id, NULLIF(item->>'product_id','')::UUID, item->>'description',
    (item->>'quantity')::NUMERIC, (item->>'unit_price_ht')::NUMERIC,
    NULLIF(item->>'tax_rate_id','')::UUID, (item->>'line_total_ht')::NUMERIC, (item->>'sort_order')::INT
  FROM jsonb_array_elements(p_items) AS item;
END; $$;

CREATE OR REPLACE FUNCTION public.replace_quote_items(p_quote_id UUID, p_team_id UUID, p_items JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_quote_id AND team_id = p_team_id) THEN
    RAISE EXCEPTION 'Quote not found or access denied';
  END IF;
  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;
  INSERT INTO public.quote_items (quote_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
  SELECT p_quote_id, NULLIF(item->>'product_id','')::UUID, item->>'description',
    (item->>'quantity')::NUMERIC, (item->>'unit_price_ht')::NUMERIC,
    NULLIF(item->>'tax_rate_id','')::UUID, (item->>'line_total_ht')::NUMERIC, (item->>'sort_order')::INT
  FROM jsonb_array_elements(p_items) AS item;
END; $$;

-- ============================================================
-- 8. Politiques RLS onboarding
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'teams' AND policyname = 'Allow authenticated users to create teams') THEN
    EXECUTE 'CREATE POLICY "Allow authenticated users to create teams" ON public.teams FOR INSERT TO authenticated WITH CHECK (true)';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'team_members' AND policyname = 'Allow team creator to insert first member') THEN
    EXECUTE 'CREATE POLICY "Allow team creator to insert first member" ON public.team_members FOR INSERT TO authenticated WITH CHECK (
      user_id = auth.uid() AND NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_members.team_id)
    )';
  END IF;
END $$;
