-- ============================================================
-- 00027 — Catalogue storefront : catégories nommées, produits enrichis
-- ============================================================

-- 1. product_categories : ajouter colonne name (nom affiché en fr)
ALTER TABLE public.product_categories
  ADD COLUMN IF NOT EXISTS name TEXT;

-- Backfill depuis les traductions françaises existantes
UPDATE public.product_categories pc
SET    name = pct.name
FROM   public.product_category_translations pct
WHERE  pct.category_id = pc.id
  AND  pct.locale      = 'fr'
  AND  pc.name IS NULL;

-- Fallback : si pas de traduction, utiliser le slug capitalisé
UPDATE public.product_categories
SET    name = initcap(replace(slug, '-', ' '))
WHERE  name IS NULL OR name = '';

-- 2. products : featured, short_description, SEO
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS featured          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS short_description TEXT,
  ADD COLUMN IF NOT EXISTS meta_title        TEXT,
  ADD COLUMN IF NOT EXISTS meta_description  TEXT,
  ADD COLUMN IF NOT EXISTS slug              TEXT;

-- Index unique slug par équipe (nullable ignoré)
CREATE UNIQUE INDEX IF NOT EXISTS products_team_slug_idx
  ON public.products(team_id, slug)
  WHERE slug IS NOT NULL;

-- Index pour les requêtes storefront homepage (produits mis en avant)
CREATE INDEX IF NOT EXISTS products_featured_idx
  ON public.products(team_id, featured)
  WHERE featured = TRUE AND is_active = TRUE AND is_published = TRUE;
