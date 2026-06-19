-- Migration 00006: Post-deploy fixes
-- Addresses code review feedback:
--   1. products.current_stock INTEGER → NUMERIC(10,2) (match inventory_ledger.quantity_change)
--   2. customers.portal_id UNIQUE constraint removed (redundant with partial unique index)

-- Fix 1: Align current_stock type with inventory_ledger precision
ALTER TABLE public.products
  ALTER COLUMN current_stock TYPE NUMERIC(10,2)
  USING current_stock::NUMERIC(10,2);

ALTER TABLE public.products
  ALTER COLUMN current_stock SET DEFAULT 0;

COMMENT ON COLUMN public.products.current_stock IS
  'Denormalized cached value — source of truth is inventory_ledger. Matches ledger precision.';

-- Fix 2: Remove redundant UNIQUE constraint on portal_id
-- The partial unique index customers_portal_id_idx (WHERE portal_id IS NOT NULL)
-- already enforces uniqueness without blocking multiple NULL rows.
ALTER TABLE public.customers
  DROP CONSTRAINT IF EXISTS customers_portal_id_key;
