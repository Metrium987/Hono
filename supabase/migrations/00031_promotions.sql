-- Migration 00031 : système de promotions / remises commerciales

CREATE TABLE IF NOT EXISTS public.promotions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percent', 'fixed_amount')),
  discount_value  NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  applies_to      TEXT NOT NULL DEFAULT 'selected_products'
                  CHECK (applies_to IN ('selected_products', 'all_products', 'category')),
  category_id     UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  starts_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at         TIMESTAMPTZ,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.promotion_products (
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  product_id   UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  PRIMARY KEY (promotion_id, product_id)
);

CREATE INDEX IF NOT EXISTS promotions_team_active_idx ON public.promotions(team_id, is_active, starts_at, ends_at);
CREATE INDEX IF NOT EXISTS promotion_products_promo_idx ON public.promotion_products(promotion_id);
CREATE INDEX IF NOT EXISTS promotion_products_product_idx ON public.promotion_products(product_id);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped promotions" ON public.promotions
  FOR ALL USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

ALTER TABLE public.promotion_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped promotion_products" ON public.promotion_products
  FOR ALL USING (
    promotion_id IN (
      SELECT id FROM public.promotions
      WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
    )
  );
