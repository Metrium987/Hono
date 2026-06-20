-- 00026_currency_constraints.sql
-- Phase 4.5: Apply missing constraints on currencies.exchange_rate_to_xpf.
--
-- The earlier 00022_fix_nullable_columns.sql fixed team_id nullability on
-- tax_rates/currencies/payment_methods but skipped exchange_rate_to_xpf.
-- Some rows may have NULL; backfill to the neutral 1.0 (identity rate) before
-- applying NOT NULL so the migration cannot fail on existing data.
--
-- Idempotent: safe to re-run (UPDATE is a no-op once no NULLs remain).

-- 1. Backfill any NULL exchange rates to the identity rate (1.0 = no conversion).
UPDATE currencies
SET exchange_rate_to_xpf = 1.0
WHERE exchange_rate_to_xpf IS NULL;

-- 2. Set DEFAULT for future inserts.
ALTER TABLE currencies
  ALTER COLUMN exchange_rate_to_xpf SET DEFAULT 1.0;

-- 3. Enforce non-null.
ALTER TABLE currencies
  ALTER COLUMN exchange_rate_to_xpf SET NOT NULL;
