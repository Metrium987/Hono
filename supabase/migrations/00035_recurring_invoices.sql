-- Facturation récurrente
CREATE TABLE public.recurring_invoices (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id                UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  customer_id            UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  currency_id            UUID REFERENCES public.currencies(id),
  frequency              public.recurring_frequency NOT NULL DEFAULT 'monthly_date',
  interval_count         INT NOT NULL DEFAULT 1,
  start_date             DATE NOT NULL,
  end_date               DATE,
  next_generation_date   DATE NOT NULL,
  last_generated_at      TIMESTAMPTZ,
  prefix                 TEXT,
  payment_terms          INT DEFAULT 30,
  notes                  TEXT,
  is_active              BOOLEAN NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at             TIMESTAMPTZ DEFAULT now(),
  created_by             UUID REFERENCES auth.users(id)
);

CREATE TABLE public.recurring_invoice_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_invoice_id  UUID NOT NULL REFERENCES public.recurring_invoices(id) ON DELETE CASCADE,
  product_id            UUID REFERENCES public.products(id),
  description           TEXT NOT NULL,
  quantity              NUMERIC(12,4) NOT NULL DEFAULT 1,
  unit_price_ht         NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate_id           UUID REFERENCES public.tax_rates(id),
  position              INT DEFAULT 0
);

-- RLS
ALTER TABLE public.recurring_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped recurring_invoices" ON public.recurring_invoices FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()))
  WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));

ALTER TABLE public.recurring_invoice_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped recurring_invoice_items" ON public.recurring_invoice_items FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.recurring_invoices ri
    WHERE ri.id = recurring_invoice_id
    AND ri.team_id IN (SELECT public.get_teams_for_authenticated_user())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.recurring_invoices ri
    WHERE ri.id = recurring_invoice_id
    AND ri.team_id IN (SELECT public.get_teams_for_authenticated_user())
  ));

CREATE INDEX recurring_invoices_team_active_idx ON public.recurring_invoices(team_id, is_active, next_generation_date);
