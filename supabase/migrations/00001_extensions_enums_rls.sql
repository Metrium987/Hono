-- Migration 00001: Extensions, Enums, RLS Helpers & Indexing
-- Apply first. Creates the foundation for all other migrations.

-- ============================================================
-- Extensions
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER DATABASE postgres SET timezone TO 'Pacific/Tahiti';
ALTER DATABASE postgres SET search_path TO public;

-- ============================================================
-- Enums
-- ============================================================

-- Invoice lifecycle
CREATE TYPE invoice_status AS ENUM (
  'draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled', 'refunded'
);

-- Quote lifecycle
CREATE TYPE quote_status AS ENUM (
  'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'converted'
);

-- Order lifecycle
CREATE TYPE order_status AS ENUM (
  'pending', 'processing', 'completed', 'cancelled'
);

-- Discount types
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');

-- Recurring invoice frequencies
CREATE TYPE recurring_frequency AS ENUM (
  'weekly', 'monthly_date', 'monthly_weekday', 'quarterly', 'yearly', 'custom'
);

-- Invoice event types for audit trail
CREATE TYPE invoice_event_type AS ENUM (
  'created', 'sent', 'viewed', 'reminder_sent',
  'payment_recorded', 'payment_deleted', 'status_changed',
  'email_sent', 'pdf_downloaded'
);

-- Email outbox status
CREATE TYPE email_outbox_status AS ENUM ('pending', 'sent', 'failed');

-- Delete request status for Educational Mode
CREATE TYPE delete_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Product types
CREATE TYPE product_type AS ENUM ('product', 'service');

-- Customer source
CREATE TYPE customer_source AS ENUM ('storefront', 'erp', 'import');

-- Inventory movement types (extensible for future warehouses/PO)
CREATE TYPE inventory_movement_type AS ENUM (
  'invoice_deduction',
  'manual_adjustment',
  'initial_stock',
  'credit_note_return',
  'purchase_receipt',    -- Future
  'transfer_out',        -- Future
  'transfer_in'          -- Future
);

-- ============================================================
-- RLS Helper Functions
-- ============================================================

-- Returns team IDs for the authenticated user
CREATE OR REPLACE FUNCTION public.get_teams_for_authenticated_user()
RETURNS SETOF UUID LANGUAGE SQL STABLE AS $$
  SELECT team_id FROM public.team_members
  WHERE user_id = (SELECT auth.uid());
$$;

-- Check granular permission on a module
CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id UUID, p_team_id UUID, p_module TEXT, p_action TEXT
) RETURNS BOOLEAN LANGUAGE SQL STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_members tm
    LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
    WHERE tm.user_id = p_user_id AND tm.team_id = p_team_id
      AND (tm.is_owner = TRUE OR (tr.permissions->p_module ? p_action))
  );
$$;

-- ============================================================
-- Indexing Strategy
-- ============================================================

-- Full-text search indexes (pg_trgm) for fuzzy autocomplete
-- NOTE: These tables must exist first; this migration runs before
-- tables are created, so these are commented out and will be
-- created in their respective module migrations.
-- CREATE INDEX IF NOT EXISTS customers_name_trgm_idx ON public.customers USING GIN (contact_name gin_trgm_ops);
-- CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON public.products USING GIN (name gin_trgm_ops);

-- JSONB expression indexes for permission lookups
-- NOTE: team_roles table created in migration 00002
-- CREATE INDEX IF NOT EXISTS team_roles_permissions_catalog_idx ON public.team_roles USING BTREE ((permissions -> 'catalog'));
