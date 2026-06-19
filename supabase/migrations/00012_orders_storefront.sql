-- Migration 00012: Orders & Storefront
-- Apply after 00011_email_outbox.sql

-- ============================================================
-- Orders (storefront submissions & ERP orders)
-- ============================================================

CREATE TABLE public.orders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id   UUID NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  source        TEXT DEFAULT 'storefront' CHECK (source IN ('storefront', 'erp')),
  status        order_status DEFAULT 'pending',
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS orders_team_id_idx ON public.orders(team_id);
CREATE INDEX IF NOT EXISTS orders_team_status_idx ON public.orders(team_id, status);
CREATE INDEX IF NOT EXISTS orders_customer_idx ON public.orders(team_id, customer_id);

-- ERP team members
CREATE POLICY "ERP team scoped orders"
  ON public.orders FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Portal users: see own orders via customer_id
CREATE POLICY "Portal users see own orders"
  ON public.orders FOR SELECT
  USING (customer_id IN (
    SELECT pu.customer_id FROM public.portal_users pu
    WHERE pu.email = (SELECT auth.email())
  ));

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

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items(order_id);
