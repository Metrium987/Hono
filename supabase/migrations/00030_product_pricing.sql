-- Migration 00030 : prix de revient + référence fournisseur + snapshot coût sur les lignes de facture

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS cost_price    NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS supplier_ref  TEXT;

-- Snapshot du coût au moment de la facturation (audit-proof — si cost_price change, l'historique reste cohérent)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS cost_price_snapshot NUMERIC(15,2);

COMMENT ON COLUMN public.products.cost_price    IS 'Prix de revient — confidentiel, jamais exposé côté vitrine';
COMMENT ON COLUMN public.products.supplier_ref  IS 'Référence article chez le fournisseur — confidentiel';
COMMENT ON COLUMN public.invoice_items.cost_price_snapshot IS 'Prix de revient au moment de la facture — figé pour audit';
