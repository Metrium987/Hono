-- ============================================================
-- MIGRATION DELTA V2 — Hono ERP
-- Fichier : 00039_cendaro_modules_v2.sql
-- Ajoute les modules Cendaro 1-10 adaptés à l'architecture Hono.
-- Ne modifie AUCUNE table existante sauf :
--   - products (6 colonnes Cendaro)
--   - inventory_ledger (FK location_id → warehouse_locations)
-- Vérifié contre schemahono.sql + migrations 00001-00038.
-- ============================================================
-- RÉSUMÉ DES OBJETS CRÉÉS :
--   16 enums, 1 table brands, ALTER TABLE products (6 cols),
--   ALTER TABLE inventory_ledger (FK), 28 nouvelles tables,
--   ~60 index, RLS sur chaque table, triggers updated_at.
-- ============================================================
-- EXCLUSIONS CONFIRMÉES (contexte PF non applicable) :
--   container, stock_ledger, channel_allocation, cash_closure,
--   payment_evidence, ml_order, exchange_rate (Cendaro BCV/VES)
-- ============================================================


-- ============================================================
-- 1. NOUVEAUX ENUMS
-- ============================================================

-- M1 — Logistique multi-entrepôts
DO $$ BEGIN
  CREATE TYPE public.warehouse_type AS ENUM (
    'showroom', 'warehouse', 'external', 'transit', 'reserved', 'defective'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.count_status AS ENUM (
    'draft', 'in_progress', 'completed', 'approved'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M2 — Moteur de tarification
DO $$ BEGIN
  CREATE TYPE public.price_type AS ENUM (
    'store', 'wholesale', 'vendor', 'promo', 'special'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.repricing_trigger AS ENUM (
    'auto', 'manual', 'scheduled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M3 — Marketplace
DO $$ BEGIN
  CREATE TYPE public.marketplace_listing_status AS ENUM (
    'active', 'paused', 'closed', 'out_of_stock', 'error'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.integration_log_level AS ENUM (
    'info', 'warning', 'error', 'critical'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M4 — Gouvernance et alertes
-- Note : 'integration_failure' remplace 'ml_failure'+'vendor_under_target' de Cendaro (contexte PF)
DO $$ BEGIN
  CREATE TYPE public.alert_type AS ENUM (
    'low_stock', 'inventory_diff', 'product_blocked',
    'rate_change', 'order_late', 'integration_failure', 'ar_overdue'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Note : 'document_edit' remplace 'product_unblock'+'cash_closure'+'edit_post_issue_document' de Cendaro
DO $$ BEGIN
  CREATE TYPE public.approval_type AS ENUM (
    'credit_sale', 'inventory_adjustment', 'channel_stock_move',
    'price_change', 'container_close', 'document_edit'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.approval_status AS ENUM (
    'pending', 'approved', 'rejected', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M5 — AR / Créances
DO $$ BEGIN
  CREATE TYPE public.ar_status AS ENUM (
    'pending', 'partial', 'paid', 'overdue', 'written_off'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.installment_status AS ENUM (
    'pending', 'paid', 'overdue', 'partially_paid'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M6 — Bons de livraison
-- Note : V2 ajoute 'dispatched'+'delivered' vs Cendaro qui n'a que draft/issued/cancelled
DO $$ BEGIN
  CREATE TYPE public.delivery_status AS ENUM (
    'draft', 'issued', 'dispatched', 'delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M7 — Import asynchrone
DO $$ BEGIN
  CREATE TYPE public.import_session_status AS ENUM (
    'pending', 'validating', 'category_mapping',
    'dry_run', 'committed', 'failed', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_session_row_status AS ENUM (
    'pending', 'valid', 'warning', 'error',
    'committed', 'skipped', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.import_session_row_action AS ENUM (
    'insert', 'update', 'skip'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- M10 — Notifications
DO $$ BEGIN
  CREATE TYPE public.notification_bucket_type AS ENUM (
    'finance', 'operations', 'inventory',
    'sales', 'integrations', 'general'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 2. TABLE brands (prérequis pour products.brand_id)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.brands (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  slug       TEXT NOT NULL,
  logo_url   TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, slug)
);

CREATE INDEX IF NOT EXISTS brands_team_id_idx ON public.brands(team_id);
CREATE INDEX IF NOT EXISTS brands_team_slug_idx ON public.brands(team_id, slug);

ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Team scoped brands" ON public.brands FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 3. ALTER TABLE products — 6 colonnes Cendaro
-- ============================================================
-- barcode       : identifiant EAN/UPC pour scan caisse et import
-- brand_id      : FK vers brands (ci-dessus)
-- weight/volume : shipping et logistique
-- units_per_box : conditionnement (utile pour import catalogue)
-- cost_avg      : coût moyen pondéré (distinct de cost_price migration 00030)

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode       TEXT,
  ADD COLUMN IF NOT EXISTS brand_id      UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS weight        NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS volume        NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS units_per_box INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS cost_avg      NUMERIC(15,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS products_barcode_idx  ON public.products(team_id, barcode)
  WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS products_brand_id_idx ON public.products(brand_id)
  WHERE brand_id IS NOT NULL;


-- ============================================================
-- 4. MODULE 1 — Logistique multi-entrepôts et audits physiques
-- ============================================================

-- 4a. warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  type       public.warehouse_type NOT NULL,
  location   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS warehouses_team_id_idx   ON public.warehouses(team_id);
CREATE INDEX IF NOT EXISTS warehouses_team_type_idx ON public.warehouses(team_id, type);

ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped warehouses" ON public.warehouses FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_warehouses_updated_at
  BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4b. warehouse_locations
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  description  TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (team_id, warehouse_id, code)
);

CREATE INDEX IF NOT EXISTS warehouse_locations_team_idx      ON public.warehouse_locations(team_id);
CREATE INDEX IF NOT EXISTS warehouse_locations_warehouse_idx ON public.warehouse_locations(warehouse_id);

ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped warehouse_locations" ON public.warehouse_locations FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4c. inventory_ledger — ajout FK sur location_id maintenant que warehouse_locations existe
-- NOT VALID : n'inspecte pas les lignes existantes (location_id était UUID libre sans FK)
DO $$ BEGIN
  ALTER TABLE public.inventory_ledger
    ADD CONSTRAINT inventory_ledger_location_id_fkey
    FOREIGN KEY (location_id) REFERENCES public.warehouse_locations(id)
    ON DELETE SET NULL
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4d. inventory_count
CREATE TABLE IF NOT EXISTS public.inventory_count (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  status       public.count_status NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  approved_by  UUID REFERENCES public.users(id),
  notes        TEXT,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS inventory_count_team_idx      ON public.inventory_count(team_id);
CREATE INDEX IF NOT EXISTS inventory_count_warehouse_idx ON public.inventory_count(team_id, warehouse_id);
CREATE INDEX IF NOT EXISTS inventory_count_status_idx    ON public.inventory_count(team_id, status);

ALTER TABLE public.inventory_count ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped inventory_count" ON public.inventory_count FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_inventory_count_updated_at
  BEFORE UPDATE ON public.inventory_count
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 4e. inventory_count_item
CREATE TABLE IF NOT EXISTS public.inventory_count_item (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  count_id    UUID NOT NULL REFERENCES public.inventory_count(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  system_qty  NUMERIC(10,2) NOT NULL DEFAULT 0,
  counted_qty NUMERIC(10,2),
  difference  NUMERIC(10,2),
  notes       TEXT
);

CREATE INDEX IF NOT EXISTS inventory_count_item_count_idx   ON public.inventory_count_item(count_id);
CREATE INDEX IF NOT EXISTS inventory_count_item_product_idx ON public.inventory_count_item(product_id);

ALTER TABLE public.inventory_count_item ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped inventory_count_item" ON public.inventory_count_item FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 4f. inventory_discrepancy
CREATE TABLE IF NOT EXISTS public.inventory_discrepancy (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  count_id    UUID NOT NULL REFERENCES public.inventory_count(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  system_qty  NUMERIC(10,2) NOT NULL,
  counted_qty NUMERIC(10,2) NOT NULL,
  difference  NUMERIC(10,2) NOT NULL,
  resolution  TEXT,
  resolved_by UUID REFERENCES public.users(id),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS inventory_discrepancy_count_idx   ON public.inventory_discrepancy(count_id);
CREATE INDEX IF NOT EXISTS inventory_discrepancy_product_idx ON public.inventory_discrepancy(product_id);
CREATE INDEX IF NOT EXISTS inventory_discrepancy_team_idx    ON public.inventory_discrepancy(team_id, created_at DESC);

ALTER TABLE public.inventory_discrepancy ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped inventory_discrepancy" ON public.inventory_discrepancy FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 5. MODULE 2 — Moteur de tarification et règles de prix
-- ============================================================
-- Note : Cendaro utilise exchange_rate (BCV/VES) absent de V2 car
--        Hono a déjà currencies.exchange_rate_to_xpf pour la PF.
--        repricing_events utilise donc currency_id (FK currencies).

-- 5a. pricing_rules
CREATE TABLE IF NOT EXISTS public.pricing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rule_type   TEXT NOT NULL,
  conditions  JSONB NOT NULL DEFAULT '{}',
  adjustments JSONB NOT NULL DEFAULT '{}',
  priority    INTEGER NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  valid_from  TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pricing_rules_team_idx        ON public.pricing_rules(team_id);
CREATE INDEX IF NOT EXISTS pricing_rules_team_active_idx ON public.pricing_rules(team_id, is_active);
CREATE INDEX IF NOT EXISTS pricing_rules_priority_idx    ON public.pricing_rules(team_id, priority);

ALTER TABLE public.pricing_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped pricing_rules" ON public.pricing_rules FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_pricing_rules_updated_at
  BEFORE UPDATE ON public.pricing_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 5b. repricing_events
CREATE TABLE IF NOT EXISTS public.repricing_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  trigger           public.repricing_trigger NOT NULL,
  currency_id       UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  old_exchange_rate NUMERIC(15,6),
  new_exchange_rate NUMERIC(15,6),
  variation_pct     NUMERIC(10,4),
  products_affected INTEGER NOT NULL DEFAULT 0,
  is_approved       BOOLEAN DEFAULT FALSE,
  approved_by       UUID REFERENCES public.users(id),
  approved_at       TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS repricing_events_team_idx      ON public.repricing_events(team_id);
CREATE INDEX IF NOT EXISTS repricing_events_approved_idx  ON public.repricing_events(team_id, is_approved);
CREATE INDEX IF NOT EXISTS repricing_events_created_idx   ON public.repricing_events(team_id, created_at DESC);

ALTER TABLE public.repricing_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped repricing_events" ON public.repricing_events FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 5c. price_history
CREATE TABLE IF NOT EXISTS public.price_history (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  product_id         UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  price_type         public.price_type NOT NULL DEFAULT 'store',
  currency_id        UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  old_price_ht       NUMERIC(15,2),
  new_price_ht       NUMERIC(15,2) NOT NULL,
  trigger            public.repricing_trigger NOT NULL,
  user_id            UUID REFERENCES public.users(id),
  repricing_event_id UUID REFERENCES public.repricing_events(id) ON DELETE SET NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS price_history_team_idx    ON public.price_history(team_id);
CREATE INDEX IF NOT EXISTS price_history_product_idx ON public.price_history(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS price_history_trigger_idx ON public.price_history(team_id, trigger);

ALTER TABLE public.price_history ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped price_history" ON public.price_history FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 6. MODULE 3 — Pipelines Marketplace et tolérance aux pannes
-- ============================================================
-- Note : marketplace_accounts généralise mercadolibre_account de Cendaro.
--        ml_order et mercadolibre_order_event exclus (Venezuela-spécifique).
--        integration_logs/failures = directement adaptés de Cendaro.

-- 6a. marketplace_accounts
CREATE TABLE IF NOT EXISTS public.marketplace_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  platform         TEXT NOT NULL,
  account_name     TEXT NOT NULL,
  platform_user_id TEXT,
  access_token     TEXT,
  refresh_token    TEXT,
  token_expires_at TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, platform_user_id)
);

CREATE INDEX IF NOT EXISTS marketplace_accounts_team_idx     ON public.marketplace_accounts(team_id);
CREATE INDEX IF NOT EXISTS marketplace_accounts_platform_idx ON public.marketplace_accounts(team_id, platform);

ALTER TABLE public.marketplace_accounts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped marketplace_accounts" ON public.marketplace_accounts FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_marketplace_accounts_updated_at
  BEFORE UPDATE ON public.marketplace_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 6b. marketplace_listings
CREATE TABLE IF NOT EXISTS public.marketplace_listings (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  product_id             UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  marketplace_account_id UUID REFERENCES public.marketplace_accounts(id) ON DELETE CASCADE,
  platform_item_id       TEXT NOT NULL,
  title                  TEXT NOT NULL,
  status                 public.marketplace_listing_status NOT NULL DEFAULT 'active',
  price                  NUMERIC(15,2) NOT NULL,
  stock_synced           INTEGER DEFAULT 0,
  permalink              TEXT,
  last_sync_at           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, platform_item_id)
);

CREATE INDEX IF NOT EXISTS marketplace_listings_team_idx       ON public.marketplace_listings(team_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_product_idx    ON public.marketplace_listings(product_id);
CREATE INDEX IF NOT EXISTS marketplace_listings_status_idx     ON public.marketplace_listings(team_id, status);
CREATE INDEX IF NOT EXISTS marketplace_listings_account_idx    ON public.marketplace_listings(marketplace_account_id);

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped marketplace_listings" ON public.marketplace_listings FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_marketplace_listings_updated_at
  BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 6c. integration_logs
CREATE TABLE IF NOT EXISTS public.integration_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  source      TEXT NOT NULL,
  level       public.integration_log_level NOT NULL DEFAULT 'info',
  message     TEXT NOT NULL,
  payload     JSONB,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS integration_logs_team_idx     ON public.integration_logs(team_id);
CREATE INDEX IF NOT EXISTS integration_logs_source_idx   ON public.integration_logs(team_id, source);
CREATE INDEX IF NOT EXISTS integration_logs_level_idx    ON public.integration_logs(team_id, level);
CREATE INDEX IF NOT EXISTS integration_logs_resolved_idx ON public.integration_logs(is_resolved);
CREATE INDEX IF NOT EXISTS integration_logs_created_idx  ON public.integration_logs(team_id, created_at DESC);

ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped integration_logs" ON public.integration_logs FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 6d. integration_failures
CREATE TABLE IF NOT EXISTS public.integration_failures (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  source        TEXT NOT NULL,
  error_code    TEXT,
  error_message TEXT NOT NULL,
  payload       JSONB,
  retry_count   INTEGER NOT NULL DEFAULT 0,
  max_retries   INTEGER NOT NULL DEFAULT 3,
  is_resolved   BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS integration_failures_team_idx     ON public.integration_failures(team_id);
CREATE INDEX IF NOT EXISTS integration_failures_source_idx   ON public.integration_failures(team_id, source);
CREATE INDEX IF NOT EXISTS integration_failures_resolved_idx ON public.integration_failures(is_resolved);
CREATE INDEX IF NOT EXISTS integration_failures_created_idx  ON public.integration_failures(team_id, created_at DESC);

ALTER TABLE public.integration_failures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped integration_failures" ON public.integration_failures FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_integration_failures_updated_at
  BEFORE UPDATE ON public.integration_failures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 7. MODULE 4 — Gouvernance, approbations et alertes
-- ============================================================
-- Note : signatures.role_id référence team_roles (UUID) et non
--        un enum user_role comme dans Cendaro. Adapté à Hono RBAC.

-- 7a. system_alerts
CREATE TABLE IF NOT EXISTS public.system_alerts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  alert_type   public.alert_type NOT NULL,
  title        TEXT NOT NULL,
  message      TEXT NOT NULL,
  severity     TEXT NOT NULL DEFAULT 'medium'
               CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  entity_type  TEXT,
  entity_id    UUID,
  is_dismissed BOOLEAN DEFAULT FALSE,
  dismissed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  dismissed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS system_alerts_team_idx       ON public.system_alerts(team_id);
CREATE INDEX IF NOT EXISTS system_alerts_type_idx       ON public.system_alerts(team_id, alert_type);
CREATE INDEX IF NOT EXISTS system_alerts_severity_idx   ON public.system_alerts(team_id, severity);
CREATE INDEX IF NOT EXISTS system_alerts_dismissed_idx  ON public.system_alerts(team_id, is_dismissed);
CREATE INDEX IF NOT EXISTS system_alerts_created_idx    ON public.system_alerts(team_id, created_at DESC);

ALTER TABLE public.system_alerts ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped system_alerts" ON public.system_alerts FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 7b. approvals
CREATE TABLE IF NOT EXISTS public.approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  approval_type public.approval_type NOT NULL,
  status        public.approval_status NOT NULL DEFAULT 'pending',
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  requested_by  UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  requested_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  resolved_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  reason        TEXT,
  metadata      JSONB,
  expires_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS approvals_team_idx   ON public.approvals(team_id);
CREATE INDEX IF NOT EXISTS approvals_type_idx   ON public.approvals(team_id, approval_type);
CREATE INDEX IF NOT EXISTS approvals_status_idx ON public.approvals(team_id, status);
CREATE INDEX IF NOT EXISTS approvals_entity_idx ON public.approvals(entity_type, entity_id);

ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped approvals" ON public.approvals FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 7c. signatures
CREATE TABLE IF NOT EXISTS public.signatures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  approval_id UUID NOT NULL REFERENCES public.approvals(id) ON DELETE CASCADE,
  signed_by   UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  role_id     UUID REFERENCES public.team_roles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  ip_address  INET,
  signed_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS signatures_team_idx      ON public.signatures(team_id);
CREATE INDEX IF NOT EXISTS signatures_approval_idx  ON public.signatures(approval_id);
CREATE INDEX IF NOT EXISTS signatures_signed_by_idx ON public.signatures(signed_by);

ALTER TABLE public.signatures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped signatures" ON public.signatures FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 8. MODULE 5 — Commissions vendors et créances clients (AR)
-- ============================================================
-- Note : vendor_commissions ≠ invoice_commissions (migration 00032).
--   invoice_commissions (00032) = commissions staff/salariés par facture
--   vendor_commissions (ici)    = rémunération vendors-partenaires externes
-- Les deux coexistent sans conflit.

-- 8a. account_receivables
CREATE TABLE IF NOT EXISTS public.account_receivables (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  invoice_id   UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  paid_amount  NUMERIC(15,2) NOT NULL DEFAULT 0,
  balance      NUMERIC(15,2) NOT NULL,
  status       public.ar_status NOT NULL DEFAULT 'pending',
  due_date     DATE NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES public.users(id),
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS account_receivables_team_idx     ON public.account_receivables(team_id);
CREATE INDEX IF NOT EXISTS account_receivables_customer_idx ON public.account_receivables(team_id, customer_id);
CREATE INDEX IF NOT EXISTS account_receivables_invoice_idx  ON public.account_receivables(invoice_id);
CREATE INDEX IF NOT EXISTS account_receivables_status_idx   ON public.account_receivables(team_id, status);
CREATE INDEX IF NOT EXISTS account_receivables_due_idx      ON public.account_receivables(team_id, due_date);

ALTER TABLE public.account_receivables ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped account_receivables" ON public.account_receivables FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_account_receivables_updated_at
  BEFORE UPDATE ON public.account_receivables
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 8b. ar_installments
-- due_date en DATE (pas TIMESTAMPTZ comme Cendaro) — cohérent avec invoices.due_date
CREATE TABLE IF NOT EXISTS public.ar_installments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  receivable_id      UUID NOT NULL REFERENCES public.account_receivables(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL,
  amount             NUMERIC(15,2) NOT NULL,
  due_date           DATE NOT NULL,
  status             public.installment_status NOT NULL DEFAULT 'pending',
  paid_amount        NUMERIC(15,2) DEFAULT 0,
  paid_at            TIMESTAMPTZ,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ar_installments_team_idx     ON public.ar_installments(team_id);
CREATE INDEX IF NOT EXISTS ar_installments_recv_idx     ON public.ar_installments(receivable_id);
CREATE INDEX IF NOT EXISTS ar_installments_status_idx   ON public.ar_installments(team_id, status);
CREATE INDEX IF NOT EXISTS ar_installments_due_idx      ON public.ar_installments(team_id, due_date);

ALTER TABLE public.ar_installments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped ar_installments" ON public.ar_installments FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_ar_installments_updated_at
  BEFORE UPDATE ON public.ar_installments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 8c. vendor_commissions
CREATE TABLE IF NOT EXISTS public.vendor_commissions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  vendor_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  order_id          UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_id        UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  base_amount       NUMERIC(15,2) NOT NULL,
  commission_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  commission_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  is_paid           BOOLEAN DEFAULT FALSE,
  paid_at           TIMESTAMPTZ,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vendor_commissions_team_idx   ON public.vendor_commissions(team_id);
CREATE INDEX IF NOT EXISTS vendor_commissions_vendor_idx ON public.vendor_commissions(vendor_id);
CREATE INDEX IF NOT EXISTS vendor_commissions_paid_idx   ON public.vendor_commissions(team_id, is_paid);

ALTER TABLE public.vendor_commissions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped vendor_commissions" ON public.vendor_commissions FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_vendor_commissions_updated_at
  BEFORE UPDATE ON public.vendor_commissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 9. MODULE 6 — Bons de livraison
-- ============================================================
-- Note : delivery_status a 5 valeurs (draft→issued→dispatched→delivered→cancelled)
--        vs Cendaro (document_status : draft/issued/cancelled seulement).
--        Hono ajoute la traçabilité expédition/livraison.

-- 9a. delivery_notes
CREATE TABLE IF NOT EXISTS public.delivery_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  note_number      TEXT NOT NULL,
  order_id         UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status           public.delivery_status NOT NULL DEFAULT 'draft',
  delivery_address TEXT,
  recipient_name   TEXT,
  recipient_id_doc TEXT,
  dispatched_at    TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  notes            TEXT,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, note_number)
);

CREATE INDEX IF NOT EXISTS delivery_notes_team_idx   ON public.delivery_notes(team_id);
CREATE INDEX IF NOT EXISTS delivery_notes_order_idx  ON public.delivery_notes(order_id);
CREATE INDEX IF NOT EXISTS delivery_notes_status_idx ON public.delivery_notes(team_id, status);

ALTER TABLE public.delivery_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped delivery_notes" ON public.delivery_notes FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_delivery_notes_updated_at
  BEFORE UPDATE ON public.delivery_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 9b. delivery_note_items
-- NUMERIC(10,2) pour quantités (fractions possibles en PF — ex. 0.5 kg)
CREATE TABLE IF NOT EXISTS public.delivery_note_items (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  delivery_note_id    UUID NOT NULL REFERENCES public.delivery_notes(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity_dispatched NUMERIC(10,2) NOT NULL,
  quantity_delivered  NUMERIC(10,2) DEFAULT 0,
  notes               TEXT
);

CREATE INDEX IF NOT EXISTS delivery_note_items_note_idx    ON public.delivery_note_items(delivery_note_id);
CREATE INDEX IF NOT EXISTS delivery_note_items_product_idx ON public.delivery_note_items(product_id);

ALTER TABLE public.delivery_note_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped delivery_note_items" ON public.delivery_note_items FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 10. MODULE 7 — Import asynchrone de catalogue
-- ============================================================
-- Adaptation directe de Cendaro import_session / import_session_row.
-- category_alias (Cendaro) non porté — Hono gère les slugs directement.

-- 10a. import_sessions
CREATE TABLE IF NOT EXISTS public.import_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  type            TEXT NOT NULL DEFAULT 'catalog',
  status          public.import_session_status NOT NULL DEFAULT 'pending',
  filename        TEXT,
  file_hash       TEXT,
  total_rows      INTEGER NOT NULL DEFAULT 0,
  valid_rows      INTEGER NOT NULL DEFAULT 0,
  error_rows      INTEGER NOT NULL DEFAULT 0,
  inserted        INTEGER NOT NULL DEFAULT 0,
  updated         INTEGER NOT NULL DEFAULT 0,
  skipped         INTEGER NOT NULL DEFAULT 0,
  failed          INTEGER NOT NULL DEFAULT 0,
  idempotency_key UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  committed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  UNIQUE (team_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS import_sessions_team_idx   ON public.import_sessions(team_id);
CREATE INDEX IF NOT EXISTS import_sessions_status_idx ON public.import_sessions(team_id, status);
CREATE INDEX IF NOT EXISTS import_sessions_user_idx   ON public.import_sessions(user_id);
CREATE INDEX IF NOT EXISTS import_sessions_expires_idx ON public.import_sessions(expires_at)
  WHERE status NOT IN ('committed', 'failed', 'expired');

ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped import_sessions" ON public.import_sessions FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 10b. import_session_rows
CREATE TABLE IF NOT EXISTS public.import_session_rows (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  import_session_id    UUID NOT NULL REFERENCES public.import_sessions(id) ON DELETE CASCADE,
  row_index            INTEGER NOT NULL,
  status               public.import_session_row_status NOT NULL DEFAULT 'pending',
  action               public.import_session_row_action,
  raw_data             JSONB NOT NULL,
  normalized_data      JSONB,
  resolved_category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  resolved_brand_id    UUID REFERENCES public.brands(id) ON DELETE SET NULL,
  resolved_product_id  UUID REFERENCES public.products(id) ON DELETE SET NULL,
  errors               JSONB,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS import_session_rows_session_idx ON public.import_session_rows(import_session_id);
CREATE INDEX IF NOT EXISTS import_session_rows_status_idx  ON public.import_session_rows(import_session_id, status);
CREATE INDEX IF NOT EXISTS import_session_rows_product_idx ON public.import_session_rows(resolved_product_id)
  WHERE resolved_product_id IS NOT NULL;

ALTER TABLE public.import_session_rows ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped import_session_rows" ON public.import_session_rows FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 11. MODULE 8 — Gestion des quotas SaaS
-- ============================================================
-- Adaptation de workspace_quota (Cendaro). Un seul enregistrement par team.

CREATE TABLE IF NOT EXISTS public.team_quotas (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  max_users          INTEGER NOT NULL DEFAULT 1,
  max_products       INTEGER NOT NULL DEFAULT 500,
  max_customers      INTEGER NOT NULL DEFAULT 50,
  max_warehouses     INTEGER NOT NULL DEFAULT 1,
  max_storage_mb     INTEGER NOT NULL DEFAULT 500,
  max_users_per_role JSONB NOT NULL DEFAULT '{}',
  updated_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (team_id)
);

ALTER TABLE public.team_quotas ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team members can view their quotas" ON public.team_quotas FOR SELECT
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Team owners can manage quotas" ON public.team_quotas FOR ALL
    USING (public.is_team_owner(team_id))
    WITH CHECK (public.is_team_owner(team_id));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 12. MODULE 9 — Orchestration IA native
-- ============================================================
-- Centralise les prompts système par config_key.
-- Identique à ai_prompt_config de Cendaro, adapté à team_id.

CREATE TABLE IF NOT EXISTS public.ai_prompt_configs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  config_key        TEXT NOT NULL,
  system_prompt     TEXT NOT NULL,
  few_shot_examples JSONB NOT NULL DEFAULT '[]',
  business_context  TEXT,
  category_rules    TEXT,
  active            BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (team_id, config_key)
);

CREATE INDEX IF NOT EXISTS ai_prompt_configs_team_idx   ON public.ai_prompt_configs(team_id);
CREATE INDEX IF NOT EXISTS ai_prompt_configs_active_idx ON public.ai_prompt_configs(team_id, active);

ALTER TABLE public.ai_prompt_configs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped ai_prompt_configs" ON public.ai_prompt_configs FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 13. MODULE 10 — Routage dynamique des notifications
-- ============================================================
-- alert_type doit correspondre à l'enum public.alert_type créé en section 1.

-- 13a. notification_buckets
CREATE TABLE IF NOT EXISTS public.notification_buckets (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bucket     public.notification_bucket_type NOT NULL,
  label      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (team_id, bucket)
);

CREATE INDEX IF NOT EXISTS notification_buckets_team_idx ON public.notification_buckets(team_id);

ALTER TABLE public.notification_buckets ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped notification_buckets" ON public.notification_buckets FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 13b. notification_bucket_assignees
-- user_id référence public.users (pas workspace_member comme dans Cendaro)
CREATE TABLE IF NOT EXISTS public.notification_bucket_assignees (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  bucket_id UUID NOT NULL REFERENCES public.notification_buckets(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  UNIQUE (bucket_id, user_id)
);

CREATE INDEX IF NOT EXISTS notification_bucket_assignees_team_idx   ON public.notification_bucket_assignees(team_id);
CREATE INDEX IF NOT EXISTS notification_bucket_assignees_bucket_idx ON public.notification_bucket_assignees(bucket_id);
CREATE INDEX IF NOT EXISTS notification_bucket_assignees_user_idx   ON public.notification_bucket_assignees(user_id);

ALTER TABLE public.notification_bucket_assignees ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped notification_bucket_assignees" ON public.notification_bucket_assignees FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 13c. notification_routing_rules
-- Un seul bucket par alert_type par team (UNIQUE constraint).
CREATE TABLE IF NOT EXISTS public.notification_routing_rules (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  alert_type public.alert_type NOT NULL,
  bucket_id  UUID NOT NULL REFERENCES public.notification_buckets(id) ON DELETE CASCADE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (team_id, alert_type)
);

CREATE INDEX IF NOT EXISTS notification_routing_rules_team_idx ON public.notification_routing_rules(team_id);

ALTER TABLE public.notification_routing_rules ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped notification_routing_rules" ON public.notification_routing_rules FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
-- RÉSUMÉ DES OBJETS CRÉÉS :
--
-- ENUMS (16) :
--   warehouse_type, count_status, price_type, repricing_trigger,
--   marketplace_listing_status, integration_log_level, alert_type,
--   approval_type, approval_status, ar_status, installment_status,
--   delivery_status, import_session_status, import_session_row_status,
--   import_session_row_action, notification_bucket_type
--
-- TABLES CRÉÉES (29) :
--   brands,
--   warehouses, warehouse_locations,
--   inventory_count, inventory_count_item, inventory_discrepancy,
--   pricing_rules, repricing_events, price_history,
--   marketplace_accounts, marketplace_listings,
--   integration_logs, integration_failures,
--   system_alerts, approvals, signatures,
--   account_receivables, ar_installments, vendor_commissions,
--   delivery_notes, delivery_note_items,
--   import_sessions, import_session_rows,
--   team_quotas,
--   ai_prompt_configs,
--   notification_buckets, notification_bucket_assignees,
--   notification_routing_rules
--
-- ALTER TABLE (2) :
--   products : +barcode, +brand_id, +weight, +volume,
--              +units_per_box, +cost_avg
--   inventory_ledger : +FK location_id → warehouse_locations (NOT VALID)
--
-- TABLES HONO NON MODIFIÉES (préservées intégralement) :
--   users, teams, team_roles, team_members, company_invitations,
--   api_keys, tax_rates, currencies, payment_methods,
--   product_categories, product_category_translations,
--   products (structure de base), product_translations, product_images,
--   inventory_ledger (structure), customers, crm_requests, crm_notes,
--   portal_users, portal_login_tokens, invoice_number_rules,
--   quotes, quote_items, invoices, invoice_items, invoice_item_groups,
--   invoice_events, invoice_payments, invoice_number_history,
--   credit_notes, credit_note_items, orders, order_items, email_outbox,
--   expense_categories, vendors, expenses, income_categories, income,
--   delete_requests, audit_logs, invoice_reminders, promotions,
--   promotion_products, commission_rules, invoice_commissions,
--   staff_groups, staff_group_members, calendar_events, event_attendees,
--   recurring_invoices, recurring_invoice_items
-- ============================================================
