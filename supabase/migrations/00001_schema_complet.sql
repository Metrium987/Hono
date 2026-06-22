-- ============================================================
-- SCHÉMA HONO ERP — Version consolidée 2026-06-20
-- Source de vérité unique. Remplace toutes les migrations 00001–00036.
-- Exécutable sur une base Supabase vierge (auth.users déjà initialisé).
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER DATABASE postgres SET timezone TO 'Pacific/Tahiti';

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.invoice_status AS ENUM (
  'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'
);

CREATE TYPE public.quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'
);

CREATE TYPE public.order_status AS ENUM (
  'pending', 'processing', 'completed', 'cancelled'
);

CREATE TYPE public.discount_type AS ENUM ('percentage', 'fixed');

CREATE TYPE public.recurring_frequency AS ENUM (
  'weekly', 'monthly_date', 'monthly_weekday', 'quarterly', 'yearly', 'custom'
);

CREATE TYPE public.invoice_event_type AS ENUM (
  'created', 'sent', 'viewed', 'reminder_sent',
  'payment_recorded', 'payment_deleted', 'status_changed',
  'email_sent', 'pdf_downloaded'
);

CREATE TYPE public.email_outbox_status AS ENUM ('pending', 'sent', 'failed');

CREATE TYPE public.delete_request_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TYPE public.product_type AS ENUM ('product', 'service');

CREATE TYPE public.customer_source AS ENUM ('storefront', 'erp', 'import');

CREATE TYPE public.inventory_movement_type AS ENUM (
  'invoice_deduction',
  'manual_adjustment',
  'initial_stock',
  'credit_note_return',
  'purchase_receipt',
  'transfer_out',
  'transfer_in'
);

-- ============================================================
-- RLS HELPER FUNCTIONS
-- (defined before tables so they can be referenced in policies)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_teams_for_authenticated_user()
RETURNS SETOF UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT team_id FROM public.team_members
    WHERE user_id = (SELECT auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id UUID, p_team_id UUID, p_module TEXT, p_action TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM public.team_members tm
      LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
      WHERE tm.user_id = p_user_id AND tm.team_id = p_team_id
        AND (tm.is_owner = TRUE OR (tr.permissions->p_module ? p_action))
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND is_owner = TRUE
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.is_educational_mode(p_team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(is_educational_mode, FALSE)
  FROM public.teams
  WHERE id = p_team_id;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- users (synced mirror of auth.users)
CREATE TABLE public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- teams (business entities)
-- Note: default_currency_id FK added after currencies table (circular dep)
CREATE TABLE public.teams (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  email                 TEXT,
  phone                 TEXT,
  address_line1         TEXT,
  address_line2         TEXT,
  city                  TEXT,
  island                TEXT,
  postal_code           TEXT,
  country               TEXT DEFAULT 'French Polynesia',
  n_tahiti              TEXT UNIQUE,
  rcs_number            TEXT,
  tax_id                TEXT,
  dicp_id               TEXT,
  is_franchise_en_base  BOOLEAN DEFAULT FALSE,
  logo_url              TEXT,
  website               TEXT,
  default_currency_id   UUID,
  invoice_prefix        TEXT DEFAULT 'FAC-',
  quote_prefix          TEXT DEFAULT 'DEV-',
  late_fee_fixed        NUMERIC(10,2) DEFAULT 5000,
  bank_name             TEXT,
  bank_rib              TEXT,
  bank_iban             TEXT,
  bank_bic              TEXT,
  timezone              TEXT DEFAULT 'Pacific/Tahiti',
  is_educational_mode   BOOLEAN DEFAULT FALSE,
  created_at            TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- team_roles
CREATE TABLE public.team_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  permissions JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

-- team_members
CREATE TABLE public.team_members (
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role_id     UUID REFERENCES public.team_roles(id) ON DELETE SET NULL,
  is_owner    BOOLEAN DEFAULT FALSE,
  invited_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (team_id, user_id)
);

-- company_invitations
CREATE TABLE public.company_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role_id     UUID REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  token       TEXT NOT NULL UNIQUE,
  is_owner    BOOLEAN DEFAULT FALSE,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  created_by  UUID REFERENCES public.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- api_keys
CREATE TABLE public.api_keys (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  role_id      UUID REFERENCES public.team_roles(id) ON DELETE RESTRICT,
  key_prefix   TEXT NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  name         TEXT NOT NULL,
  description  TEXT,
  is_owner     BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at   TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- tax_rates
CREATE TABLE public.tax_rates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rate        NUMERIC(5,2) NOT NULL,
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

-- currencies
CREATE TABLE public.currencies (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id              UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  code                 TEXT NOT NULL,
  name                 TEXT NOT NULL,
  symbol               TEXT NOT NULL,
  symbol_position      TEXT DEFAULT 'suffix' CHECK (symbol_position IN ('prefix', 'suffix')),
  is_default           BOOLEAN DEFAULT FALSE,
  exchange_rate_to_xpf NUMERIC(15,6) NOT NULL DEFAULT 1.0,
  is_active            BOOLEAN DEFAULT TRUE,
  created_at           TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, code)
);

-- Deferred FK: teams.default_currency_id → currencies (circular dep resolved)
ALTER TABLE public.teams
  ADD CONSTRAINT teams_default_currency_fkey
  FOREIGN KEY (default_currency_id) REFERENCES public.currencies(id)
  ON DELETE SET NULL;

-- payment_methods
CREATE TABLE public.payment_methods (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  display_name TEXT NOT NULL,
  is_active    BOOLEAN DEFAULT TRUE,
  is_online    BOOLEAN DEFAULT FALSE,
  config       JSONB,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

-- product_categories
CREATE TABLE public.product_categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  parent_id   UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  slug        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  sort_order  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, slug)
);

-- product_category_translations
CREATE TABLE public.product_category_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.product_categories(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  UNIQUE(category_id, locale)
);

-- products
CREATE TABLE public.products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id     UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  sku             TEXT,
  type            public.product_type NOT NULL DEFAULT 'product',
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
  embedding       VECTOR(768),
  fts             TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('french', COALESCE(name, '') || ' ' || COALESCE(description, ''))
  ) STORED,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, sku)
);

-- product_translations
CREATE TABLE public.product_translations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  locale            TEXT NOT NULL,
  name              TEXT NOT NULL,
  description       TEXT,
  short_description TEXT,
  UNIQUE(product_id, locale)
);

-- product_images
CREATE TABLE public.product_images (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  position     INTEGER DEFAULT 0,
  alt_text     TEXT,
  UNIQUE(product_id, position)
);

-- inventory_ledger (immutable)
CREATE TABLE public.inventory_ledger (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  location_id      UUID,
  transaction_type public.inventory_movement_type NOT NULL,
  quantity_change  NUMERIC(10,2) NOT NULL,
  running_balance  NUMERIC(10,2) NOT NULL,
  unit_cost        NUMERIC(15,2),
  reference_type   TEXT,
  reference_id     UUID,
  description      TEXT,
  created_by       UUID REFERENCES public.users(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- customers
CREATE TABLE public.customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id             UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES public.users(id) ON DELETE SET NULL,
  company_name        TEXT,
  contact_name        TEXT NOT NULL,
  is_b2b              BOOLEAN DEFAULT FALSE,
  n_tahiti            TEXT,
  email               TEXT,
  phone               TEXT,
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  island              TEXT,
  postal_code         TEXT,
  portal_enabled      BOOLEAN DEFAULT FALSE,
  portal_id           TEXT,
  payment_terms       INTEGER DEFAULT 30,
  notes               TEXT,
  embedding           VECTOR(768),
  consent_recorded    BOOLEAN DEFAULT FALSE,
  consent_recorded_at TIMESTAMPTZ,
  source              public.customer_source DEFAULT 'erp',
  created_at          TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT b2b_requires_tahiti CHECK (is_b2b = FALSE OR n_tahiti IS NOT NULL)
);

-- crm_requests
CREATE TABLE public.crm_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  subject     TEXT NOT NULL,
  message     TEXT NOT NULL,
  status      TEXT DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- crm_notes
CREATE TABLE public.crm_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- portal_users
CREATE TABLE public.portal_users (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id  UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email        TEXT NOT NULL UNIQUE,
  name         TEXT,
  last_login_at TIMESTAMPTZ,
  token_version INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(customer_id, email)
);

-- portal_login_tokens
CREATE TABLE public.portal_login_tokens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES public.portal_users(id) ON DELETE CASCADE,
  token          TEXT NOT NULL UNIQUE,
  expires_at     TIMESTAMPTZ NOT NULL,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- invoice_number_rules (atomic sequence per team)
CREATE TABLE public.invoice_number_rules (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                      UUID UNIQUE NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_pattern              TEXT DEFAULT '{PREFIX}{YEAR}-{SEQUENCE}',
  quote_pattern                TEXT DEFAULT '{PREFIX}{YEAR}-{SEQUENCE}',
  reset_period                 TEXT DEFAULT 'yearly' CHECK (reset_period IN ('yearly', 'monthly', 'never')),
  last_invoice_sequence        INTEGER DEFAULT 0 NOT NULL,
  last_quote_sequence          INTEGER DEFAULT 0 NOT NULL,
  last_credit_note_sequence    INTEGER DEFAULT 0 NOT NULL,
  last_invoice_period_key      TEXT,
  last_quote_period_key        TEXT,
  last_credit_note_period_key  TEXT,
  created_at                   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at                   TIMESTAMPTZ DEFAULT NOW()
);

-- quotes
-- Note: converted_to_invoice_id FK added after invoices table (circular dep)
CREATE TABLE public.quotes (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                 UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id             UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_number            TEXT NOT NULL,
  status                  public.quote_status DEFAULT 'draft',
  subtotal_ht             NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount              NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc               NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id             UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  issue_date              DATE NOT NULL DEFAULT CURRENT_DATE,
  validity_date           DATE,
  converted_to_invoice_id UUID,
  notes                   TEXT,
  created_by              UUID REFERENCES public.users(id),
  created_at              TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, quote_number)
);

-- quote_items
CREATE TABLE public.quote_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id      UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht NUMERIC(15,2) NOT NULL,
  tax_rate_id   UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht NUMERIC(15,2) NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

-- invoices
CREATE TABLE public.invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  quote_id        UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          public.invoice_status DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  service_date    DATE,
  due_date        DATE NOT NULL,
  paid_at         TIMESTAMPTZ,
  subtotal_ht     NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc       NUMERIC(15,2) NOT NULL DEFAULT 0,
  paid_amount     NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id     UUID NOT NULL REFERENCES public.currencies(id) ON DELETE RESTRICT,
  late_fee_fixed  NUMERIC(10,2) DEFAULT 5000,
  legal_vat_mention TEXT,
  legal_mentions  TEXT,
  discount_type   public.discount_type,
  discount_value  NUMERIC(15,2) DEFAULT 0,
  discount_amount NUMERIC(15,2) DEFAULT 0,
  viewed_at       TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  notes           TEXT,
  message         TEXT,
  created_by      UUID REFERENCES public.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,
  UNIQUE(team_id, invoice_number)
);

-- Deferred FK: quotes.converted_to_invoice_id → invoices (circular dep resolved)
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_converted_to_invoice_id_fkey
  FOREIGN KEY (converted_to_invoice_id) REFERENCES public.invoices(id)
  ON DELETE SET NULL;

-- invoice_items
CREATE TABLE public.invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  product_id    UUID REFERENCES public.products(id) ON DELETE SET NULL,
  group_id      UUID,
  description   TEXT NOT NULL,
  quantity      NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht NUMERIC(15,2) NOT NULL,
  tax_rate_id   UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht NUMERIC(15,2) NOT NULL,
  sort_order    INTEGER DEFAULT 0
);

-- invoice_item_groups
CREATE TABLE public.invoice_item_groups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0
);

-- invoice_events (audit trail)
CREATE TABLE public.invoice_events (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type public.invoice_event_type NOT NULL,
  payload    JSONB,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- invoice_payments
CREATE TABLE public.invoice_payments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id        UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  amount            NUMERIC(15,2) NOT NULL,
  currency_id       UUID NOT NULL REFERENCES public.currencies(id),
  payment_method_id UUID NOT NULL REFERENCES public.payment_methods(id),
  reference         TEXT,
  payment_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  notes             TEXT,
  created_by        UUID REFERENCES public.users(id),
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- invoice_number_history
CREATE TABLE public.invoice_number_history (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  old_number TEXT NOT NULL,
  new_number TEXT NOT NULL,
  changed_by UUID REFERENCES public.users(id),
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- credit_notes
CREATE TABLE public.credit_notes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id        UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  invoice_id         UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  credit_note_number TEXT NOT NULL,
  status             TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'issued', 'applied', 'cancelled')),
  issue_date         DATE NOT NULL DEFAULT CURRENT_DATE,
  reason             TEXT,
  subtotal_ht        NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount         NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_ttc          NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency_id        UUID NOT NULL REFERENCES public.currencies(id),
  created_at         TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, credit_note_number)
);

-- credit_note_items
CREATE TABLE public.credit_note_items (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES public.credit_notes(id) ON DELETE CASCADE,
  product_id     UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description    TEXT NOT NULL,
  quantity       NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht  NUMERIC(15,2) NOT NULL,
  tax_rate_id    UUID REFERENCES public.tax_rates(id) ON DELETE RESTRICT,
  line_total_ht  NUMERIC(15,2) NOT NULL
);

-- orders
CREATE TABLE public.orders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  source      TEXT DEFAULT 'storefront' CHECK (source IN ('storefront', 'erp')),
  status      public.order_status DEFAULT 'pending',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- order_items
CREATE TABLE public.order_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
  description     TEXT NOT NULL,
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_ht   NUMERIC(15,2),
  special_request TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- email_outbox
CREATE TABLE public.email_outbox (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id          UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind             TEXT NOT NULL,
  to_email         TEXT NOT NULL,
  subject          TEXT NOT NULL,
  body             TEXT,
  related_type     TEXT,
  related_id       UUID,
  status           public.email_outbox_status DEFAULT 'pending',
  attempts         INTEGER DEFAULT 0,
  last_error       TEXT,
  last_attempted_at TIMESTAMPTZ,
  next_attempt_at  TIMESTAMPTZ,
  sent_at          TIMESTAMPTZ,
  message_id       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- expense_categories
CREATE TABLE public.expense_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

-- vendors
CREATE TABLE public.vendors (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  contact_name TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  n_tahiti     TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- expenses
CREATE TABLE public.expenses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  vendor_id    UUID REFERENCES public.vendors(id) ON DELETE SET NULL,
  vendor_name  TEXT,
  description  TEXT NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  currency_id  UUID NOT NULL REFERENCES public.currencies(id),
  expense_date DATE NOT NULL,
  receipt_url  TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- income_categories
CREATE TABLE public.income_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(team_id, name)
);

-- income (non-invoice revenue)
CREATE TABLE public.income (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  category_id  UUID REFERENCES public.income_categories(id) ON DELETE SET NULL,
  description  TEXT NOT NULL,
  amount       NUMERIC(15,2) NOT NULL,
  currency_id  UUID NOT NULL REFERENCES public.currencies(id),
  income_date  DATE NOT NULL,
  customer_id  UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  receipt_url  TEXT,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- delete_requests (Educational Mode)
CREATE TABLE public.delete_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id      UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewed_by  UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status       public.delete_request_status NOT NULL DEFAULT 'pending',
  table_name   TEXT NOT NULL,
  record_id    UUID NOT NULL,
  reason       TEXT,
  review_notes TEXT,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- audit_logs (immutable)
CREATE TABLE public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id  UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS teams_n_tahiti_idx ON public.teams(n_tahiti);
CREATE INDEX IF NOT EXISTS team_roles_team_id_idx ON public.team_roles(team_id);
CREATE INDEX IF NOT EXISTS team_roles_permissions_catalog_idx ON public.team_roles USING BTREE ((permissions -> 'catalog'));
CREATE INDEX IF NOT EXISTS team_roles_permissions_invoices_idx ON public.team_roles USING BTREE ((permissions -> 'invoices'));
CREATE INDEX IF NOT EXISTS team_members_user_id_idx ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS company_invitations_team_id_idx ON public.company_invitations(team_id);
CREATE INDEX IF NOT EXISTS company_invitations_token_idx ON public.company_invitations(token);
CREATE INDEX IF NOT EXISTS api_keys_team_id_idx ON public.api_keys(team_id);
CREATE INDEX IF NOT EXISTS tax_rates_team_id_idx ON public.tax_rates(team_id);
CREATE INDEX IF NOT EXISTS currencies_team_id_idx ON public.currencies(team_id);
CREATE INDEX IF NOT EXISTS payment_methods_team_id_idx ON public.payment_methods(team_id);
CREATE INDEX IF NOT EXISTS product_categories_team_id_idx ON public.product_categories(team_id);
CREATE INDEX IF NOT EXISTS product_categories_parent_id_idx ON public.product_categories(parent_id);
CREATE INDEX IF NOT EXISTS cat_translations_category_idx ON public.product_category_translations(category_id);
CREATE INDEX IF NOT EXISTS products_team_id_idx ON public.products(team_id);
CREATE INDEX IF NOT EXISTS products_team_category_idx ON public.products(team_id, category_id);
CREATE INDEX IF NOT EXISTS products_team_active_published_idx ON public.products(team_id, is_active, is_published);
CREATE INDEX IF NOT EXISTS products_embedding_idx ON public.products USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
CREATE INDEX IF NOT EXISTS products_fts_idx ON public.products USING GIN (fts);
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS product_translations_product_idx ON public.product_translations(product_id);
CREATE INDEX IF NOT EXISTS product_images_position_idx ON public.product_images(product_id, position);
CREATE INDEX IF NOT EXISTS inventory_ledger_team_product_idx ON public.inventory_ledger(team_id, product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_ledger_product_idx ON public.inventory_ledger(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_ledger_reference_idx ON public.inventory_ledger(reference_type, reference_id) WHERE reference_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_team_id_idx ON public.customers(team_id);
CREATE INDEX IF NOT EXISTS customers_team_name_idx ON public.customers(team_id, contact_name);
CREATE UNIQUE INDEX IF NOT EXISTS customers_portal_id_idx ON public.customers(portal_id) WHERE portal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS customers_embedding_idx ON public.customers USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);
CREATE INDEX IF NOT EXISTS crm_requests_team_id_idx ON public.crm_requests(team_id);
CREATE INDEX IF NOT EXISTS crm_requests_customer_idx ON public.crm_requests(team_id, customer_id);
CREATE INDEX IF NOT EXISTS crm_notes_team_id_idx ON public.crm_notes(team_id);
CREATE INDEX IF NOT EXISTS crm_notes_customer_idx ON public.crm_notes(team_id, customer_id);
CREATE INDEX IF NOT EXISTS portal_users_customer_idx ON public.portal_users(customer_id);
CREATE INDEX IF NOT EXISTS portal_users_auth_user_id_idx ON public.portal_users(auth_user_id);
CREATE INDEX IF NOT EXISTS portal_login_tokens_token_idx ON public.portal_login_tokens(token);
CREATE INDEX IF NOT EXISTS invoice_number_rules_team_idx ON public.invoice_number_rules(team_id);
CREATE INDEX IF NOT EXISTS quotes_team_id_idx ON public.quotes(team_id);
CREATE INDEX IF NOT EXISTS quotes_team_status_idx ON public.quotes(team_id, status);
CREATE INDEX IF NOT EXISTS quotes_customer_idx ON public.quotes(team_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS invoices_team_id_idx ON public.invoices(team_id);
CREATE INDEX IF NOT EXISTS invoices_team_status_idx ON public.invoices(team_id, status);
CREATE INDEX IF NOT EXISTS invoices_customer_id_idx ON public.invoices(team_id, customer_id);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON public.invoices(team_id, due_date);
CREATE INDEX IF NOT EXISTS invoices_created_idx ON public.invoices(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoices_active_idx ON public.invoices(team_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON public.invoices(created_by);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_item_groups_invoice_idx ON public.invoice_item_groups(invoice_id);
CREATE INDEX IF NOT EXISTS invoice_events_invoice_idx ON public.invoice_events(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_events_created_by ON public.invoice_events(created_by);
CREATE INDEX IF NOT EXISTS invoice_payments_invoice_idx ON public.invoice_payments(invoice_id, payment_date);
CREATE INDEX IF NOT EXISTS invoice_number_history_invoice_idx ON public.invoice_number_history(invoice_id, created_at DESC);
CREATE INDEX IF NOT EXISTS invoice_number_history_old_number_idx ON public.invoice_number_history(old_number);
CREATE INDEX IF NOT EXISTS credit_notes_team_id_idx ON public.credit_notes(team_id);
CREATE INDEX IF NOT EXISTS credit_notes_invoice_idx ON public.credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS credit_note_items_note_idx ON public.credit_note_items(credit_note_id);
CREATE INDEX IF NOT EXISTS orders_team_id_idx ON public.orders(team_id);
CREATE INDEX IF NOT EXISTS orders_team_status_idx ON public.orders(team_id, status);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(team_id, customer_id);
CREATE INDEX IF NOT EXISTS email_outbox_team_id_idx ON public.email_outbox(team_id);
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON public.email_outbox(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS expense_categories_team_id_idx ON public.expense_categories(team_id);
CREATE INDEX IF NOT EXISTS vendors_team_id_idx ON public.vendors(team_id);
CREATE INDEX IF NOT EXISTS expenses_team_id_idx ON public.expenses(team_id);
CREATE INDEX IF NOT EXISTS expenses_team_date_idx ON public.expenses(team_id, expense_date DESC);
CREATE INDEX IF NOT EXISTS expenses_category_idx ON public.expenses(team_id, category_id);
CREATE INDEX IF NOT EXISTS income_categories_team_id_idx ON public.income_categories(team_id);
CREATE INDEX IF NOT EXISTS income_team_id_idx ON public.income(team_id);
CREATE INDEX IF NOT EXISTS income_team_date_idx ON public.income(team_id, income_date DESC);
CREATE INDEX IF NOT EXISTS income_category_idx ON public.income(team_id, category_id);
CREATE INDEX IF NOT EXISTS delete_requests_team_idx ON public.delete_requests(team_id, status);
CREATE INDEX IF NOT EXISTS delete_requests_record_idx ON public.delete_requests(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_team_idx ON public.audit_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

-- users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own data" ON public.users FOR SELECT USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own data" ON public.users FOR UPDATE USING ((SELECT auth.uid()) = id);

-- teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view their teams" ON public.teams FOR SELECT
  USING (id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Team owners can update their teams" ON public.teams FOR UPDATE
  USING (public.is_team_owner(id));
CREATE POLICY "Allow authenticated users to create teams" ON public.teams FOR INSERT
  TO authenticated WITH CHECK (true);

-- team_roles
ALTER TABLE public.team_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view roles" ON public.team_roles FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Team owners can manage roles" ON public.team_roles FOR ALL
  USING (public.is_team_owner(team_id));

-- team_members
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view members" ON public.team_members FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Team owners can manage members" ON public.team_members FOR ALL
  USING (public.is_team_owner(team_id));
CREATE POLICY "Allow team creator to insert first member" ON public.team_members FOR INSERT
  TO authenticated WITH CHECK (
    user_id = auth.uid()
    AND NOT EXISTS (SELECT 1 FROM public.team_members WHERE team_id = team_members.team_id)
  );

-- company_invitations
ALTER TABLE public.company_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped company_invitations" ON public.company_invitations FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team members can view API keys" ON public.api_keys FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Team owners can manage API keys" ON public.api_keys FOR ALL
  USING (public.is_team_owner(team_id));

-- tax_rates
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped tax_rates" ON public.tax_rates FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- currencies
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped currencies" ON public.currencies FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- payment_methods
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped payment_methods" ON public.payment_methods FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- product_categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped product_categories" ON public.product_categories FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- product_category_translations
ALTER TABLE public.product_category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product category translations"
  ON public.product_category_translations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.product_categories pc
    JOIN public.team_members tm ON tm.team_id = pc.team_id
    WHERE pc.id = product_category_translations.category_id AND tm.user_id = auth.uid()
  ));

-- products
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped products" ON public.products FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Storefront can view published products" ON public.products FOR SELECT
  USING (is_active = TRUE AND is_published = TRUE);

-- product_translations
ALTER TABLE public.product_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product translations"
  ON public.product_translations FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.team_members tm ON tm.team_id = p.team_id
    WHERE p.id = product_translations.product_id AND tm.user_id = auth.uid()
  ));

-- product_images
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's product images"
  ON public.product_images FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.products p
    JOIN public.team_members tm ON tm.team_id = p.team_id
    WHERE p.id = product_images.product_id AND tm.user_id = auth.uid()
  ));

-- inventory_ledger
ALTER TABLE public.inventory_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped inventory_ledger" ON public.inventory_ledger FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped customers" ON public.customers FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- crm_requests
ALTER TABLE public.crm_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped crm_requests" ON public.crm_requests FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- crm_notes
ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped crm_notes" ON public.crm_notes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- portal_users
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal: email lookup" ON public.portal_users FOR SELECT USING (true);
CREATE POLICY "Portal: view own record" ON public.portal_users FOR SELECT
  USING (auth.uid() = auth_user_id);
CREATE POLICY "Portal: insert own record" ON public.portal_users FOR INSERT
  WITH CHECK (auth.uid() = auth_user_id);

-- portal_login_tokens
ALTER TABLE public.portal_login_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Portal: create login token" ON public.portal_login_tokens FOR INSERT
  WITH CHECK (portal_user_id IN (
    SELECT id FROM public.portal_users WHERE auth_user_id = auth.uid()
  ));
CREATE POLICY "Portal: verify login token" ON public.portal_login_tokens FOR SELECT
  USING (true);
CREATE POLICY "Portal: mark token as used" ON public.portal_login_tokens FOR UPDATE
  USING (portal_user_id IN (
    SELECT id FROM public.portal_users WHERE auth_user_id = auth.uid()
  ));

-- invoice_number_rules
ALTER TABLE public.invoice_number_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped invoice_number_rules" ON public.invoice_number_rules FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- quotes
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped quotes" ON public.quotes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Educational Mode blocks edits to finalized quotes" ON public.quotes FOR UPDATE
  USING (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('accepted', 'rejected', 'expired', 'converted'))
  WITH CHECK (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('accepted', 'rejected', 'expired', 'converted'));
CREATE POLICY "Educational Mode blocks deletes of finalized quotes" ON public.quotes FOR DELETE
  USING (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('accepted', 'rejected', 'expired', 'converted'));

-- quote_items
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's quote items" ON public.quote_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.team_members tm ON tm.team_id = q.team_id
    WHERE q.id = quote_items.quote_id AND tm.user_id = auth.uid()
  ));

-- invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped invoices" ON public.invoices FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Educational Mode blocks edits to finalized invoices" ON public.invoices FOR UPDATE
  USING (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('paid', 'sent', 'overdue'))
  WITH CHECK (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('paid', 'sent', 'overdue'));
CREATE POLICY "Educational Mode blocks deletes of finalized invoices" ON public.invoices FOR DELETE
  USING (public.is_educational_mode(team_id) = FALSE OR status NOT IN ('paid', 'sent', 'overdue'));

-- invoice_items
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice items" ON public.invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.team_members tm ON tm.team_id = i.team_id
    WHERE i.id = invoice_items.invoice_id AND tm.user_id = auth.uid()
  ));

-- invoice_item_groups
ALTER TABLE public.invoice_item_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice item groups" ON public.invoice_item_groups FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.team_members tm ON tm.team_id = i.team_id
    WHERE i.id = invoice_item_groups.invoice_id AND tm.user_id = auth.uid()
  ));

-- invoice_events
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped invoice_events" ON public.invoice_events FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
  ));

-- invoice_payments
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped invoice_payments" ON public.invoice_payments FOR ALL
  USING (invoice_id IN (
    SELECT id FROM public.invoices
    WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
  ));

-- invoice_number_history
ALTER TABLE public.invoice_number_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's invoice number history" ON public.invoice_number_history FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.invoices i
    JOIN public.team_members tm ON tm.team_id = i.team_id
    WHERE i.id = invoice_number_history.invoice_id AND tm.user_id = auth.uid()
  ));

-- credit_notes
ALTER TABLE public.credit_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped credit_notes" ON public.credit_notes FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- credit_note_items
ALTER TABLE public.credit_note_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's credit note items" ON public.credit_note_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.credit_notes cn
    JOIN public.team_members tm ON tm.team_id = cn.team_id
    WHERE cn.id = credit_note_items.credit_note_id AND tm.user_id = auth.uid()
  ));

-- orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ERP team scoped orders" ON public.orders FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Portal users see own orders" ON public.orders FOR SELECT
  USING (customer_id IN (
    SELECT pu.customer_id FROM public.portal_users pu WHERE pu.email = (SELECT auth.email())
  ));

-- order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their team's order items" ON public.order_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    JOIN public.team_members tm ON tm.team_id = o.team_id
    WHERE o.id = order_items.order_id AND tm.user_id = auth.uid()
  ));

-- email_outbox
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped email_outbox" ON public.email_outbox FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped expense_categories" ON public.expense_categories FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- vendors
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped vendors" ON public.vendors FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped expenses" ON public.expenses FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- income_categories
ALTER TABLE public.income_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped income_categories" ON public.income_categories FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- income
ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped income" ON public.income FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- delete_requests
ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped delete_requests" ON public.delete_requests FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- audit_logs (read-only for team, immutable)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped audit_logs" ON public.audit_logs FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "Team owners can insert audit_logs" ON public.audit_logs FOR INSERT
  WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));
CREATE POLICY "No update on audit_logs" ON public.audit_logs FOR UPDATE USING (false);
CREATE POLICY "No delete on audit_logs" ON public.audit_logs FOR DELETE USING (false);

-- ============================================================
-- FUNCTIONS & RPC
-- ============================================================

-- JWT hook: inject team_id, role_name, is_owner, permissions into access token
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = '' AS $$
DECLARE
  v_user_id UUID;
  v_claims  jsonb;
BEGIN
  v_user_id := (event ->> 'user_id')::UUID;

  SELECT jsonb_build_object(
    'app_metadata', jsonb_build_object(
      'team_id',     tm.team_id,
      'role_name',   tr.name,
      'is_owner',    tm.is_owner,
      'permissions', tr.permissions
    )
  ) INTO v_claims
  FROM public.team_members tm
  LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  IF v_claims IS NULL THEN
    RETURN jsonb_set(event, '{claims}', event -> 'claims' || '{}'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', event -> 'claims' || v_claims);
END;
$$;

-- Sync new auth user to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER SECURITY DEFINER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.raw_user_meta_data->>'avatar_url');
  RETURN NEW;
END;
$$;

-- Invoice numbering (atomic, per-team, per-year — no cross-year pollution)
CREATE OR REPLACE FUNCTION public.generate_next_invoice_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prefix TEXT; v_year TEXT; v_sequence INTEGER;
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

-- Quote numbering
CREATE OR REPLACE FUNCTION public.generate_next_quote_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_prefix TEXT; v_year TEXT; v_sequence INTEGER;
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

-- Credit note numbering
CREATE OR REPLACE FUNCTION public.generate_next_credit_note_number(p_team_id UUID)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_year TEXT; v_sequence INTEGER;
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

-- API key verification (returns team context + permissions)
CREATE OR REPLACE FUNCTION public.verify_api_key(p_token_hash TEXT)
RETURNS TABLE (
  team_id     UUID,
  role_id     UUID,
  key_id      UUID,
  key_name    TEXT,
  permissions JSONB,
  is_owner    BOOLEAN
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.team_id, ak.role_id, ak.id, ak.name,
    tr.permissions, ak.is_owner
  FROM public.api_keys ak
  LEFT JOIN public.team_roles tr ON ak.role_id = tr.id
  WHERE ak.key_hash = p_token_hash
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
  LIMIT 1;
END;
$$;

-- Convert quote to invoice (atomic: number + invoice + items + event in one transaction)
CREATE OR REPLACE FUNCTION public.convert_quote_to_invoice(p_quote_id UUID, p_team_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_invoice_id     UUID;
  v_invoice_number TEXT;
  v_quote          RECORD;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE id = p_quote_id AND team_id = p_team_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF v_quote.status = 'converted' THEN RAISE EXCEPTION 'Quote already converted to invoice'; END IF;
  IF v_quote.status IN ('rejected', 'expired') THEN
    RAISE EXCEPTION 'Cannot convert a rejected or expired quote';
  END IF;

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

  UPDATE public.quotes SET
    status = 'converted',
    converted_to_invoice_id = v_invoice_id,
    updated_at = NOW()
  WHERE id = p_quote_id;

  INSERT INTO public.invoice_events (invoice_id, event_type, payload, created_at)
  VALUES (v_invoice_id, 'created',
    jsonb_build_object('source', 'quote_conversion', 'quote_id', p_quote_id, 'quote_number', v_quote.quote_number),
    NOW());

  RETURN jsonb_build_object('invoice_id', v_invoice_id, 'invoice_number', v_invoice_number);
END; $$;

-- Atomic invoice item replace (delete + insert in one transaction)
CREATE OR REPLACE FUNCTION public.replace_invoice_items(
  p_invoice_id UUID, p_team_id UUID, p_items JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE id = p_invoice_id AND team_id = p_team_id) THEN
    RAISE EXCEPTION 'Invoice not found or access denied';
  END IF;

  DELETE FROM public.invoice_items WHERE invoice_id = p_invoice_id;

  INSERT INTO public.invoice_items (invoice_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
  SELECT p_invoice_id,
    NULLIF(item->>'product_id', '')::UUID,
    item->>'description',
    (item->>'quantity')::NUMERIC,
    (item->>'unit_price_ht')::NUMERIC,
    NULLIF(item->>'tax_rate_id', '')::UUID,
    (item->>'line_total_ht')::NUMERIC,
    (item->>'sort_order')::INT
  FROM jsonb_array_elements(p_items) AS item;
END; $$;

-- Atomic quote item replace
CREATE OR REPLACE FUNCTION public.replace_quote_items(
  p_quote_id UUID, p_team_id UUID, p_items JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.quotes WHERE id = p_quote_id AND team_id = p_team_id) THEN
    RAISE EXCEPTION 'Quote not found or access denied';
  END IF;

  DELETE FROM public.quote_items WHERE quote_id = p_quote_id;

  INSERT INTO public.quote_items (quote_id, product_id, description, quantity, unit_price_ht, tax_rate_id, line_total_ht, sort_order)
  SELECT p_quote_id,
    NULLIF(item->>'product_id', '')::UUID,
    item->>'description',
    (item->>'quantity')::NUMERIC,
    (item->>'unit_price_ht')::NUMERIC,
    NULLIF(item->>'tax_rate_id', '')::UUID,
    (item->>'line_total_ht')::NUMERIC,
    (item->>'sort_order')::INT
  FROM jsonb_array_elements(p_items) AS item;
END; $$;

-- Low stock products with pagination
CREATE OR REPLACE FUNCTION public.get_low_stock_products(
  p_team_id UUID, p_page INT DEFAULT 1, p_limit INT DEFAULT 50
) RETURNS TABLE (
  id UUID, name TEXT, sku TEXT, current_stock NUMERIC,
  low_stock_alert INTEGER, unit TEXT, category_id UUID, total_count BIGINT
) LANGUAGE plpgsql STABLE AS $$
DECLARE v_offset INT;
BEGIN
  v_offset := (GREATEST(p_page, 1) - 1) * p_limit;
  RETURN QUERY
  SELECT p.id, p.name, p.sku, p.current_stock, p.low_stock_alert, p.unit, p.category_id,
    COUNT(*) OVER()::BIGINT AS total_count
  FROM public.products p
  WHERE p.team_id = p_team_id AND p.track_stock = TRUE
    AND p.low_stock_alert IS NOT NULL AND p.current_stock <= p.low_stock_alert::NUMERIC
  ORDER BY p.current_stock ASC, p.name ASC
  LIMIT p_limit OFFSET v_offset;
END; $$;

-- Seed default data on team creation (XPF + EUR, PF TVA rates, payment methods)
CREATE OR REPLACE FUNCTION public.initialize_team(p_team_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.currencies (team_id, code, name, symbol, symbol_position, is_default, exchange_rate_to_xpf, is_active)
  VALUES
    (p_team_id, 'XPF', 'Franc Pacifique', 'F', 'suffix', TRUE,  1.000000, TRUE),
    (p_team_id, 'EUR', 'Euro',             '€', 'suffix', FALSE, 119.332000, TRUE)
  ON CONFLICT (team_id, code) DO NOTHING;

  INSERT INTO public.tax_rates (team_id, name, rate, description, is_active)
  VALUES
    (p_team_id, 'Exonéré',  0.00, 'Taux 0% — exportations, franchise en base', TRUE),
    (p_team_id, 'TVA 1%',   1.00, 'Taux réduit 1% — produits de 1ère nécessité', TRUE),
    (p_team_id, 'TVA 5%',   5.00, 'Taux intermédiaire 5%', TRUE),
    (p_team_id, 'TVA 13%', 13.00, 'Taux normal 13% — services', TRUE),
    (p_team_id, 'TVA 16%', 16.00, 'Taux normal 16% — biens', TRUE)
  ON CONFLICT (team_id, name) DO NOTHING;

  INSERT INTO public.payment_methods (team_id, name, display_name, is_active)
  VALUES
    (p_team_id, 'cash',          'Espèces',           TRUE),
    (p_team_id, 'bank_transfer', 'Virement bancaire',  TRUE),
    (p_team_id, 'check',         'Chèque',             TRUE),
    (p_team_id, 'card',          'Carte bancaire',     TRUE)
  ON CONFLICT DO NOTHING;
END; $$;

-- Vector similarity search — products
CREATE OR REPLACE FUNCTION public.match_products(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT DEFAULT 20,
  p_team_id       UUID DEFAULT NULL
) RETURNS TABLE(
  id UUID, name TEXT, description TEXT, similarity FLOAT,
  unit_price_ht NUMERIC, category_id UUID, is_active BOOLEAN
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_team_id IS NULL THEN RAISE EXCEPTION 'p_team_id is required'; END IF;
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT p.id, COALESCE(pt.name, p.name), pt.description,
    1 - (p.embedding <=> query_embedding) AS similarity,
    p.price_ht, p.category_id, p.is_active
  FROM public.products p
  LEFT JOIN public.product_translations pt ON pt.product_id = p.id AND pt.locale = 'fr'
  WHERE p.embedding IS NOT NULL AND p.team_id = p_team_id
    AND 1 - (p.embedding <=> query_embedding) > match_threshold
  ORDER BY p.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- Vector similarity search — customers
CREATE OR REPLACE FUNCTION public.match_customers(
  query_embedding VECTOR(768),
  match_threshold FLOAT DEFAULT 0.7,
  match_count     INT DEFAULT 20,
  p_team_id       UUID DEFAULT NULL
) RETURNS TABLE(
  id UUID, company_name TEXT, contact_name TEXT,
  email TEXT, phone TEXT, n_tahiti TEXT, similarity FLOAT
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF p_team_id IS NULL THEN RAISE EXCEPTION 'p_team_id is required'; END IF;
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  SELECT c.id, c.company_name, c.contact_name, c.email, c.phone, c.n_tahiti,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.customers c
  WHERE c.embedding IS NOT NULL AND c.team_id = p_team_id
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END; $$;

-- Hybrid search — products (trigram + RRF)
CREATE OR REPLACE FUNCTION public.hybrid_search_products(
  p_team_id UUID, p_query TEXT, p_limit INT DEFAULT 10, p_threshold FLOAT DEFAULT 0.1
) RETURNS TABLE (
  id UUID, name TEXT, description TEXT, price_ht NUMERIC,
  sku TEXT, type TEXT, current_stock INT, is_active BOOLEAN, similarity FLOAT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  WITH trgm AS (
    SELECT p.id,
      ROW_NUMBER() OVER (ORDER BY GREATEST(
        similarity(p.name, p_query),
        similarity(COALESCE(p.sku, ''), p_query),
        similarity(COALESCE(p.description, ''), p_query)
      ) DESC) AS rn
    FROM public.products p
    WHERE p.team_id = p_team_id AND p.is_active = true
      AND (p.name % p_query OR COALESCE(p.sku, '') % p_query
        OR COALESCE(p.description, '') % p_query
        OR p.name ILIKE '%' || p_query || '%'
        OR COALESCE(p.sku, '') ILIKE '%' || p_query || '%')
  ),
  rrf AS (
    SELECT id, SUM(1.0 / (60 + rn)) AS rrf_score
    FROM trgm GROUP BY id ORDER BY rrf_score DESC LIMIT p_limit
  )
  SELECT p.id, p.name, p.description, p.price_ht, p.sku, p.type::TEXT,
    p.current_stock::INT, p.is_active, r.rrf_score::FLOAT
  FROM rrf r JOIN public.products p ON p.id = r.id
  ORDER BY r.rrf_score DESC;
END; $$;

-- Hybrid search — customers (trigram + RRF)
CREATE OR REPLACE FUNCTION public.hybrid_search_customers(
  p_team_id UUID, p_query TEXT, p_limit INT DEFAULT 10
) RETURNS TABLE (
  id UUID, company_name TEXT, contact_name TEXT,
  email TEXT, phone TEXT, n_tahiti TEXT, is_b2b BOOLEAN, similarity FLOAT
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF current_setting('role', true) <> 'service_role' AND NOT EXISTS (
    SELECT 1 FROM public.team_members WHERE team_id = p_team_id AND user_id = (SELECT auth.uid())
  ) THEN RAISE EXCEPTION 'Access denied'; END IF;

  RETURN QUERY
  WITH trgm AS (
    SELECT c.id,
      ROW_NUMBER() OVER (ORDER BY GREATEST(
        similarity(COALESCE(c.company_name, ''), p_query),
        similarity(c.contact_name, p_query),
        similarity(COALESCE(c.email, ''), p_query)
      ) DESC) AS rn
    FROM public.customers c
    WHERE c.team_id = p_team_id
      AND (COALESCE(c.company_name, '') % p_query OR c.contact_name % p_query
        OR COALESCE(c.email, '') % p_query
        OR COALESCE(c.n_tahiti, '') ILIKE '%' || p_query || '%'
        OR c.contact_name ILIKE '%' || p_query || '%'
        OR COALESCE(c.company_name, '') ILIKE '%' || p_query || '%')
  ),
  rrf AS (
    SELECT id, SUM(1.0 / (60 + rn)) AS rrf_score
    FROM trgm GROUP BY id ORDER BY rrf_score DESC LIMIT p_limit
  )
  SELECT c.id, c.company_name, c.contact_name, c.email, c.phone,
    c.n_tahiti, c.is_b2b, r.rrf_score::FLOAT
  FROM rrf r JOIN public.customers c ON c.id = r.id
  ORDER BY r.rrf_score DESC;
END; $$;

-- Generic updated_at setter
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- Immutable ledger guard
CREATE OR REPLACE FUNCTION public.prevent_ledger_mutation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Inventory ledger records are immutable. Create an adjustment transaction instead.';
END; $$;

-- Payment status auto-update (with draft/cancelled/refunded guard)
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_total_paid    NUMERIC(15,2);
  v_total_ttc     NUMERIC(15,2);
  v_invoice_id    UUID;
  v_current_status public.invoice_status;
BEGIN
  v_invoice_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT status INTO v_current_status FROM public.invoices WHERE id = v_invoice_id;

  IF v_current_status IN ('draft', 'cancelled', 'refunded') THEN
    SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
    FROM public.invoice_payments WHERE invoice_id = v_invoice_id;
    UPDATE public.invoices SET paid_amount = v_total_paid WHERE id = v_invoice_id;
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM public.invoice_payments WHERE invoice_id = v_invoice_id;

  SELECT total_ttc INTO v_total_ttc FROM public.invoices WHERE id = v_invoice_id;

  UPDATE public.invoices SET
    paid_amount = v_total_paid,
    status = CASE
      WHEN v_total_paid >= v_total_ttc THEN 'paid'::public.invoice_status
      WHEN v_total_paid > 0            THEN 'partial'::public.invoice_status
      WHEN due_date < CURRENT_DATE     THEN 'overdue'::public.invoice_status
      ELSE 'sent'::public.invoice_status
    END,
    paid_at = CASE WHEN v_total_paid >= v_total_ttc THEN NOW() ELSE NULL END
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END; $$;

-- Stock deduction on invoice finalization
CREATE OR REPLACE FUNCTION public.deduct_invoice_stock()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_item RECORD; v_new_balance NUMERIC(10,2);
BEGIN
  IF (OLD.status NOT IN ('sent', 'paid') AND NEW.status IN ('sent', 'paid')) THEN
    FOR v_item IN
      SELECT ii.product_id, ii.quantity, p.current_stock, p.track_stock
      FROM public.invoice_items ii
      JOIN public.products p ON ii.product_id = p.id
      WHERE ii.invoice_id = NEW.id AND p.track_stock = TRUE
    LOOP
      v_new_balance := COALESCE(v_item.current_stock, 0) - v_item.quantity;
      UPDATE public.products SET current_stock = v_new_balance WHERE id = v_item.product_id;
      INSERT INTO public.inventory_ledger (
        team_id, product_id, transaction_type, quantity_change,
        running_balance, reference_type, reference_id, description
      ) VALUES (
        NEW.team_id, v_item.product_id, 'invoice_deduction',
        -v_item.quantity, v_new_balance, 'invoice', NEW.id,
        'Invoice ' || NEW.invoice_number || ' — line item deduction'
      );
    END LOOP;
  END IF;
  RETURN NEW;
END; $$;

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER trg_inventory_ledger_immutable
  BEFORE UPDATE OR DELETE ON public.inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.prevent_ledger_mutation();

CREATE TRIGGER trg_invoice_payment_aiud
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

CREATE TRIGGER trg_invoice_stock_deduction
  AFTER UPDATE OF status ON public.invoices
  FOR EACH ROW
  WHEN (OLD.status NOT IN ('sent', 'paid') AND NEW.status IN ('sent', 'paid'))
  EXECUTE FUNCTION public.deduct_invoice_stock();

CREATE TRIGGER trg_teams_updated_at    BEFORE UPDATE ON public.teams    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_quotes_updated_at   BEFORE UPDATE ON public.quotes   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated_at   BEFORE UPDATE ON public.orders   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_income_updated_at   BEFORE UPDATE ON public.income   FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_vendors_updated_at  BEFORE UPDATE ON public.vendors  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW public.active_invoices WITH (security_invoker = true) AS
  SELECT * FROM public.invoices WHERE deleted_at IS NULL;

-- ============================================================
-- STORAGE
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('product-images', 'product-images', true, 5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read product images"
  ON storage.objects FOR SELECT USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated upload product images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated update product images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated delete product images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND auth.uid() IS NOT NULL);

-- ============================================================
-- GRANTS
-- ============================================================

-- JWT hook access for Supabase auth service
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON public.team_members TO supabase_auth_admin;
GRANT SELECT ON public.team_roles TO supabase_auth_admin;
GRANT SELECT ON public.users TO supabase_auth_admin;

-- Application RPCs callable by authenticated users
GRANT EXECUTE ON FUNCTION public.initialize_team(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search_products TO authenticated;
GRANT EXECUTE ON FUNCTION public.hybrid_search_customers TO authenticated;
