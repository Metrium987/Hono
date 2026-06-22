-- Index manquant sur recurring_invoice_items pour les lookups par recurring_invoice_id
CREATE INDEX IF NOT EXISTS recurring_invoice_items_recurring_invoice_id_idx
  ON public.recurring_invoice_items(recurring_invoice_id);

-- Trigger updated_at sur recurring_invoices (colonne existante mais jamais mise à jour)
CREATE OR REPLACE TRIGGER set_recurring_invoices_updated_at
  BEFORE UPDATE ON public.recurring_invoices
  FOR EACH ROW EXECUTE FUNCTION moddatetime(updated_at);
