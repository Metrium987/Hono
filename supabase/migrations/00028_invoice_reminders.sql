-- Migration 00028 : invoice_reminders table for dunning / relance client

CREATE TABLE IF NOT EXISTS public.invoice_reminders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  invoice_id  UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  level       SMALLINT NOT NULL CHECK (level BETWEEN 1 AND 3),
  -- 1 = rappel amiable, 2 = relance ferme, 3 = mise en demeure
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email_to    TEXT NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invoice_reminders_invoice_idx ON public.invoice_reminders(invoice_id, sent_at DESC);
CREATE INDEX IF NOT EXISTS invoice_reminders_team_idx   ON public.invoice_reminders(team_id, sent_at DESC);

ALTER TABLE public.invoice_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team scoped invoice_reminders" ON public.invoice_reminders
  FOR ALL USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
