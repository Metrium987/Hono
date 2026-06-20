-- Migration 00033: Phase 2 — DB Corrections
-- Apply after 00032_add_dicp_id_to_teams.sql
--
-- Contains:
--   2.1 — Drop orphan invoice_recurring columns (table never created)
--   2.3 — Create delete_requests table for Educational Mode
--   2.4 — Create audit_logs table for CRUD traceability

-- ============================================================
-- 2.1 Drop orphan columns invoice_recurring_id / recurring_sequence
-- ============================================================
-- invoice_recurring table was never created, leaving dangling columns.
-- These will be re-created properly in Phase 8.1 (recurring invoices).

DROP INDEX IF EXISTS public.invoices_recurring_idx;

ALTER TABLE public.invoices
  DROP COLUMN IF EXISTS invoice_recurring_id CASCADE,
  DROP COLUMN IF EXISTS recurring_sequence CASCADE;

-- ============================================================
-- 2.3 Delete Requests (Educational Mode)
-- ============================================================
-- Enum delete_request_status already created in 00001.

CREATE TABLE public.delete_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id         UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  requested_by    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reviewed_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  status          delete_request_status NOT NULL DEFAULT 'pending',
  table_name      TEXT NOT NULL,
  record_id       UUID NOT NULL,
  reason          TEXT,
  review_notes    TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delete_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS delete_requests_team_idx ON public.delete_requests(team_id, status);
CREATE INDEX IF NOT EXISTS delete_requests_record_idx ON public.delete_requests(table_name, record_id);

CREATE POLICY "Team scoped delete_requests"
  ON public.delete_requests FOR ALL
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- ============================================================
-- 2.4 Audit Logs (application-level CRUD traceability)
-- ============================================================

CREATE TABLE public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id       UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,          -- e.g. 'INSERT', 'UPDATE', 'DELETE'
  table_name    TEXT NOT NULL,          -- e.g. 'invoices', 'customers'
  record_id     UUID,                   -- the affected record
  old_values    JSONB,                  -- snapshot before change
  new_values    JSONB,                  -- snapshot after change
  ip_address    INET,
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS audit_logs_team_idx ON public.audit_logs(team_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_table_record_idx ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_user_idx ON public.audit_logs(user_id);

CREATE POLICY "Team scoped audit_logs"
  ON public.audit_logs FOR SELECT
  USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Only owners / admins can insert audit logs (or triggers)
CREATE POLICY "Team owners can insert audit_logs"
  ON public.audit_logs FOR INSERT
  WITH CHECK (team_id IN (SELECT public.get_teams_for_authenticated_user()));

-- Audit logs are immutable: no update or delete
CREATE POLICY "No update on audit_logs"
  ON public.audit_logs FOR UPDATE
  USING (false);
CREATE POLICY "No delete on audit_logs"
  ON public.audit_logs FOR DELETE
  USING (false);
