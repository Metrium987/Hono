-- Migration 00032 : CRM attribution staff + commissions

-- CRM extensions sur customers
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS assigned_to    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS customer_type  TEXT NOT NULL DEFAULT 'client'
    CHECK (customer_type IN ('prospect', 'client', 'vip'));

-- Attribution commerciale sur invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Règles de commission par membre de l'équipe
CREATE TABLE IF NOT EXISTS public.commission_rules (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rate          NUMERIC(5,2) NOT NULL CHECK (rate BETWEEN 0 AND 100),
  applies_from  TIMESTAMPTZ NOT NULL DEFAULT now(),
  applies_to    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id, applies_from)
);

-- Commissions calculées par facture
CREATE TABLE IF NOT EXISTS public.invoice_commissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      NUMERIC(15,2) NOT NULL,
  rate        NUMERIC(5,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (invoice_id)
);

CREATE INDEX IF NOT EXISTS invoice_commissions_user_idx ON public.invoice_commissions(user_id, status);
CREATE INDEX IF NOT EXISTS invoices_assigned_to_idx ON public.invoices(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS customers_assigned_to_idx ON public.customers(assigned_to) WHERE assigned_to IS NOT NULL;

ALTER TABLE public.commission_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped commission_rules" ON public.commission_rules
  FOR ALL USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

ALTER TABLE public.invoice_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped invoice_commissions" ON public.invoice_commissions
  FOR ALL USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
