-- ============================================================
-- MIGRATION COMPLÉMENT V2 — Hono ERP
-- Fichier : 00040_cendaro_complement.sql
-- Modules ajoutés : containers, payment_evidence, payment_allocation,
--                   cash_closure, exchange_rate
-- Vérifié contre schemacendaro.sql + schemahono.sql + migrations 00001-00039
-- ============================================================
-- Adaptations Cendaro → Hono :
--   workspace_id          → team_id FK public.teams(id)
--   supplier(id)          → public.vendors(id)  (Hono n'a pas de table supplier)
--   payment(id)           → public.invoice_payments(id)  (pas de table POS payment)
--   account_receivable(id)→ public.account_receivables(id)  (créée en 00039)
--   user_profile(id)      → public.users(id)
--   DOUBLE PRECISION      → NUMERIC(15,2) pour montants, NUMERIC(10,2) pour quantités
--   INTEGER quantités     → NUMERIC(10,2)
--   rate_type BCV/VES     → exchange_rate_type générique (official/market/custom)
-- ============================================================


-- ============================================================
-- 1. NOUVEAUX ENUMS
-- ============================================================

-- Containers
DO $$ BEGIN
  CREATE TYPE public.container_status AS ENUM (
    'created', 'in_transit', 'received', 'closed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Clôture de caisse
DO $$ BEGIN
  CREATE TYPE public.closure_status AS ENUM (
    'open', 'closed', 'reviewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Taux de change (adapté PF — sans les taux Venezuela BCV/parallèle)
DO $$ BEGIN
  CREATE TYPE public.exchange_rate_type AS ENUM (
    'official', 'market', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 2. CONTAINERS
-- ============================================================
-- container.supplier_id → public.vendors(id) (équivalent Hono de supplier Cendaro)
-- container_item.product_id / suggested_product_id → public.products(id)
-- container_document.uploaded_by → public.users(id)

-- 2a. containers
CREATE TABLE IF NOT EXISTS public.containers (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                   UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  container_number          TEXT NOT NULL,
  vendor_id                 UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  status                    public.container_status NOT NULL DEFAULT 'created',
  departure_date            TIMESTAMPTZ,
  arrival_date              TIMESTAMPTZ,
  cost_fob                  NUMERIC(15,2),
  notes                     TEXT,
  closed_by                 UUID REFERENCES public.users(id),
  closed_at                 TIMESTAMPTZ,
  packing_list_url          TEXT,
  packing_list_status       TEXT NOT NULL DEFAULT 'none',
  packing_list_processed_at TIMESTAMPTZ,
  packing_list_item_count   INTEGER NOT NULL DEFAULT 0,
  created_by                UUID REFERENCES public.users(id),
  created_at                TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (team_id, container_number)
);

CREATE INDEX IF NOT EXISTS containers_team_idx   ON public.containers(team_id);
CREATE INDEX IF NOT EXISTS containers_status_idx ON public.containers(team_id, status);
CREATE INDEX IF NOT EXISTS containers_vendor_idx ON public.containers(vendor_id);

ALTER TABLE public.containers ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped containers" ON public.containers FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_containers_updated_at
  BEFORE UPDATE ON public.containers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- 2b. container_items
-- Conserve les champs IA de Cendaro : match_type, confidence, suggested_product_id, ai_corrected
-- NUMERIC(10,2) pour quantités (fractions possibles)
-- NUMERIC(15,2) pour unit_cost
CREATE TABLE IF NOT EXISTS public.container_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  container_id         UUID NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  product_id           UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity_expected    NUMERIC(10,2) NOT NULL,
  quantity_received    NUMERIC(10,2) DEFAULT 0,
  unit_cost            NUMERIC(15,2),
  notes                TEXT,
  original_name        TEXT,
  translated_name      TEXT,
  weight_kg            NUMERIC(10,3),
  sku_hint             TEXT,
  category_hint        TEXT,
  match_type           TEXT,
  is_matched           BOOLEAN NOT NULL DEFAULT FALSE,
  confidence           NUMERIC(5,4),
  suggested_product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  ai_corrected         BOOLEAN NOT NULL DEFAULT FALSE,
  image_url            TEXT,
  image_description    TEXT
);

CREATE INDEX IF NOT EXISTS container_items_container_idx ON public.container_items(container_id);
CREATE INDEX IF NOT EXISTS container_items_product_idx   ON public.container_items(product_id);
CREATE INDEX IF NOT EXISTS container_items_matched_idx   ON public.container_items(container_id, is_matched);

ALTER TABLE public.container_items ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped container_items" ON public.container_items FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- 2c. container_documents
CREATE TABLE IF NOT EXISTS public.container_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  container_id  UUID NOT NULL REFERENCES public.containers(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_name     TEXT,
  uploaded_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS container_documents_container_idx ON public.container_documents(container_id);
CREATE INDEX IF NOT EXISTS container_documents_team_idx      ON public.container_documents(team_id);

ALTER TABLE public.container_documents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped container_documents" ON public.container_documents FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 3. PAYMENT EVIDENCE
-- ============================================================
-- Dans Cendaro : payment_id → payment(id) (table POS)
-- Dans Hono : payment_id → public.invoice_payments(id)
-- Permet d'attacher une preuve (scan virement, chèque, photo) à un paiement de facture.
-- Contexte PF : validation manuelle obligatoire, pas de Stripe/PayPal.

CREATE TABLE IF NOT EXISTS public.payment_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  payment_id    UUID NOT NULL REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
  evidence_url  TEXT NOT NULL,
  evidence_type TEXT NOT NULL DEFAULT 'image'
                CHECK (evidence_type IN ('image', 'pdf', 'document')),
  uploaded_by   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_evidence_team_idx    ON public.payment_evidence(team_id);
CREATE INDEX IF NOT EXISTS payment_evidence_payment_idx ON public.payment_evidence(payment_id);

ALTER TABLE public.payment_evidence ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped payment_evidence" ON public.payment_evidence FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 4. PAYMENT ALLOCATION
-- ============================================================
-- Dans Cendaro : payment → account_receivable
-- Dans Hono : invoice_payments → account_receivables (créée en 00039)
-- Permet d'imputer un paiement sur une ou plusieurs créances AR.

CREATE TABLE IF NOT EXISTS public.payment_allocations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  payment_id    UUID NOT NULL REFERENCES public.invoice_payments(id) ON DELETE CASCADE,
  receivable_id UUID NOT NULL REFERENCES public.account_receivables(id) ON DELETE CASCADE,
  amount        NUMERIC(15,2) NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS payment_allocations_team_idx      ON public.payment_allocations(team_id);
CREATE INDEX IF NOT EXISTS payment_allocations_payment_idx   ON public.payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_recv_idx      ON public.payment_allocations(receivable_id);

ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped payment_allocations" ON public.payment_allocations FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- 5. CASH CLOSURE
-- ============================================================
-- Clôture de caisse journalière.
-- closed_by / reviewed_by → public.users(id)

CREATE TABLE IF NOT EXISTS public.cash_closures (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  closure_date   DATE NOT NULL,
  status         public.closure_status NOT NULL DEFAULT 'open',
  total_sales    NUMERIC(15,2) DEFAULT 0,
  total_cash     NUMERIC(15,2) DEFAULT 0,
  total_digital  NUMERIC(15,2) DEFAULT 0,
  expected_total NUMERIC(15,2) DEFAULT 0,
  actual_total   NUMERIC(15,2) DEFAULT 0,
  discrepancy    NUMERIC(15,2) DEFAULT 0,
  notes          TEXT,
  closed_by      UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_closures_team_idx   ON public.cash_closures(team_id);
CREATE INDEX IF NOT EXISTS cash_closures_date_idx   ON public.cash_closures(team_id, closure_date DESC);
CREATE INDEX IF NOT EXISTS cash_closures_status_idx ON public.cash_closures(team_id, status);

ALTER TABLE public.cash_closures ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped cash_closures" ON public.cash_closures FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE TRIGGER trg_cash_closures_updated_at
  BEFORE UPDATE ON public.cash_closures
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ============================================================
-- 6. EXCHANGE RATE
-- ============================================================
-- Taux de change historique par team.
-- Cendaro : rate_type (bcv/parallel/rmb_usd/rmb_bs) — Venezuela-spécifique.
-- Hono PF  : exchange_rate_type (official/market/custom) — générique.
-- 'official' = taux IEOM publié, 'market' = taux constaté, 'custom' = saisi manuellement.
-- Distinct de currencies.exchange_rate_to_xpf (taux actuel) :
-- exchange_rates conserve l'historique des variations.

CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  rate_type   public.exchange_rate_type NOT NULL DEFAULT 'official',
  rate        NUMERIC(15,6) NOT NULL,
  source      TEXT,
  notes       TEXT,
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS exchange_rates_team_idx     ON public.exchange_rates(team_id);
CREATE INDEX IF NOT EXISTS exchange_rates_currency_idx ON public.exchange_rates(team_id, currency_id);
CREATE INDEX IF NOT EXISTS exchange_rates_type_idx     ON public.exchange_rates(team_id, rate_type);
CREATE INDEX IF NOT EXISTS exchange_rates_created_idx  ON public.exchange_rates(team_id, created_at DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Team scoped exchange_rates" ON public.exchange_rates FOR ALL
    USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
    WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ============================================================
-- FIN DE LA MIGRATION
-- ============================================================
-- RÉSUMÉ DES OBJETS CRÉÉS :
--
-- ENUMS (3) :
--   container_status, closure_status, exchange_rate_type
--
-- TABLES CRÉÉES (8) :
--   containers, container_items, container_documents,
--   payment_evidence, payment_allocations,
--   cash_closures,
--   exchange_rates
--
-- FKS NOTABLES ADAPTÉES DEPUIS CENDARO :
--   container.vendor_id          → public.vendors(id)      [≠ supplier]
--   payment_evidence.payment_id  → public.invoice_payments(id)  [≠ payment POS]
--   payment_allocations.payment_id   → public.invoice_payments(id)
--   payment_allocations.receivable_id → public.account_receivables(id)  [00039]
--   exchange_rates.currency_id   → public.currencies(id)
-- ============================================================
