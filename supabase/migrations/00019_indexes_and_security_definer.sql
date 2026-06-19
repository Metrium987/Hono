-- Phase 4.1: Add missing indexes
CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_invoices_created_by ON invoices(created_by);
CREATE INDEX IF NOT EXISTS idx_invoice_events_created_by ON invoice_events(created_by);

-- Phase 4.2: Add SECURITY DEFINER to critical functions
-- These functions run with caller permissions by default, which can break when RLS is enforced.
CREATE OR REPLACE FUNCTION generate_next_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  year_prefix TEXT;
  next_num INT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(invoice_number, '-', 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number LIKE year_prefix || '-%';
  RETURN year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION generate_next_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  year_prefix TEXT;
  next_num INT;
BEGIN
  year_prefix := TO_CHAR(CURRENT_DATE, 'YYYY');
  SELECT COALESCE(MAX(CAST(SPLIT_PART(quote_number, '-', 2) AS INTEGER)), 0) + 1
  INTO next_num
  FROM quotes
  WHERE quote_number LIKE year_prefix || '-%';
  RETURN year_prefix || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  user_id TEXT;
  claims JSONB;
BEGIN
  user_id := event->>'user_id';
  claims := event->'claims';
  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata', '{}'::jsonb) || jsonb_build_object('user_id', user_id));
  RETURN jsonb_build_object('claims', claims);
END;
$$;
