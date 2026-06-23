-- Migration 00049: payment_proofs — preuve de paiement soumise par le client depuis le portail

CREATE TABLE public.payment_proofs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount      NUMERIC(15,2) NOT NULL,
  reference   TEXT,
  notes       TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- RLS
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

-- Staff (team members) can see and manage all proofs for their team
CREATE POLICY "Team members can view payment proofs"
  ON public.payment_proofs FOR SELECT
  USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Team members can update payment proofs"
  ON public.payment_proofs FOR UPDATE
  USING (
    team_id IN (SELECT team_id FROM public.team_members WHERE user_id = auth.uid())
  );

-- Index for fast queries by staff (pending proofs)
CREATE INDEX payment_proofs_team_status_idx ON public.payment_proofs (team_id, status);
CREATE INDEX payment_proofs_invoice_idx ON public.payment_proofs (invoice_id);

-- Also add order_id reference to quotes for traceability (if not exists)
-- This allows linking an auto-created order back to its source quote
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'quote_id'
  ) THEN
    ALTER TABLE public.orders ADD COLUMN quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;
  END IF;
END $$;
