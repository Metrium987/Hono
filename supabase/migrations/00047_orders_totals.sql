-- Migration 00047 — Totaux commandes
-- Ajoute currency_id, totaux HT/TTC et line_total_ht sur orders/order_items
-- Sans ces colonnes, la valeur d'une commande est recalculée côté client à chaque fois

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS currency_id     UUID REFERENCES public.currencies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subtotal_ht     NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_amount      NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ttc       NUMERIC(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(15,2) NOT NULL DEFAULT 0;

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS line_total_ht NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS sort_order    INT NOT NULL DEFAULT 0;

-- Backfill line_total_ht pour les lignes existantes
UPDATE public.order_items
SET line_total_ht = COALESCE(unit_price_ht, 0) * COALESCE(quantity, 1)
WHERE line_total_ht IS NULL;

ALTER TABLE public.order_items
  ALTER COLUMN line_total_ht SET NOT NULL,
  ALTER COLUMN line_total_ht SET DEFAULT 0;

-- Index FK pour performance
CREATE INDEX IF NOT EXISTS orders_currency_idx ON public.orders(currency_id);

COMMENT ON COLUMN public.orders.subtotal_ht  IS 'Somme des line_total_ht arrondis';
COMMENT ON COLUMN public.orders.total_ttc    IS 'subtotal_ht + tax_amount - discount_amount';
COMMENT ON COLUMN public.orders.currency_id  IS 'Devise utilisée pour les prix HT';
