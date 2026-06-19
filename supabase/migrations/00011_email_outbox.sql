-- Migration 00011: Email Outbox
-- Apply after 00010_rpc_total_count.sql

-- ============================================================
-- Email Outbox (transactional email tracking)
-- ============================================================

CREATE TABLE public.email_outbox (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id           UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL,
  to_email          TEXT NOT NULL,
  subject           TEXT NOT NULL,
  body              TEXT,
  related_type      TEXT,
  related_id        UUID,
  status            email_outbox_status DEFAULT 'pending',
  attempts          INTEGER DEFAULT 0,
  last_error        TEXT,
  last_attempted_at TIMESTAMPTZ,
  next_attempt_at   TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  message_id        TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS email_outbox_team_id_idx ON public.email_outbox(team_id);
CREATE INDEX IF NOT EXISTS email_outbox_status_idx ON public.email_outbox(status, next_attempt_at);

CREATE POLICY "Team scoped email_outbox"
  ON public.email_outbox FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));
