-- Migration 00004: Catalog (Categories, Products, Inventory Ledger)
-- Apply after 00003_config_crud.sql

-- ============================================================
-- Product Categories (hierarchical, with i18n)
-- ============================================================

CREATE TABLE public.product_categories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  slug          TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, slug)
);

ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS product_categories_team_id_idx ON public.product_categories(team_id);
CREATE INDEX IF NOT EXISTS product_categories_parent_id_idx ON public.product_categories(parent_id);

CREATE POLICY "Team scoped product_categories"
  ON public.product_categories FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE TABLE public.product_category_translations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  locale        TEXT NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  UNIQUE(category_id, locale)
);

CREATE INDEX IF NOT EXISTS cat_translations_category_idx
  ON public.product_category_translations(category_id);

-- ============================================================
-- Products (with full-text + vector search, stock tracking)
-- ============================================================

CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sku             TEXT,
  type            product_type NOT NULL DEFAULT 'product',
  name            TEXT NOT NULL,
  description     TEXT,

  price_ht        NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id     UUID NOT NULL REFERENCES public.currencies(id),
  tax_rate_id     UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,

  track_stock     BOOLEAN DEFAULT FALSE,
  current_stock   NUMERIC(10,2) DEFAULT 0,
  low_stock_alert INTEGER,
  unit            TEXT DEFAULT 'pcs',

  is_active       BOOLEAN DEFAULT TRUE,
  is_published    BOOLEAN DEFAULT FALSE,

  -- AI Search (hybrid)
  embedding       VECTOR(1536),
  fts             TSVECTOR
    GENERATED ALWAYS AS (
      to_tsvector('french', COALESCE(name, '') || ' ' || COALESCE(description, ''))
    ) STORED,

  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, sku)
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS products_team_id_idx ON public.products(team_id);
CREATE INDEX IF NOT EXISTS products_team_category_idx ON public.products(team_id, category_id);
CREATE INDEX IF NOT EXISTS products_team_active_published_idx ON public.products(team_id, is_active, is_published);
CREATE INDEX IF NOT EXISTS products_embedding_idx
  ON public.products USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
CREATE INDEX IF NOT EXISTS products_fts_idx ON public.products USING GIN (fts);
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);

CREATE POLICY "Team scoped products"
  ON public.products FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

CREATE POLICY "Storefront can view published products"
  ON public.products FOR SELECT
  USING (is_active = TRUE AND is_published = TRUE);

-- Translations
CREATE TABLE public.product_translations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  locale            TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  short_description TEXT,
  UNIQUE(product_id, locale)
);

CREATE INDEX IF NOT EXISTS product_translations_product_idx ON public.product_translations(product_id);

-- Images
CREATE TABLE public.product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path  TEXT NOT NULL,
  position      INTEGER DEFAULT 0,
  alt_text      TEXT,
  UNIQUE(product_id, position)
);

CREATE INDEX IF NOT EXISTS product_images_position_idx ON public.product_images(product_id, position);

-- ============================================================
-- Inventory Ledger (Immutable Stock Movement Log)
-- ============================================================

CREATE TABLE public.inventory_ledger (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  location_id       UUID,
  transaction_type  inventory_movement_type NOT NULL,
  quantity_change   NUMERIC(10,2) NOT NULL,
  running_balance   NUMERIC(10,2) NOT NULL,
  unit_cost         NUMERIC(15,2),
  reference_type    TEXT,
  reference_id      UUID,
  description       TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS inventory_ledger_team_product_idx
  ON public.inventory_ledger(team_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_ledger_product_idx
  ON public.inventory_ledger(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_ledger_reference_idx
  ON public.inventory_ledger(reference_type, reference_id) WHERE reference_type IS NOT NULL;

CREATE POLICY "Team scoped inventory_ledger"
  ON public.inventory_ledger FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Immutable ledger: prevent updates/deletes
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Inventory ledger records are immutable. Create an adjustment transaction instead.';
END;
$$;

CREATE TRIGGER trg_inventory_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();
