-- Migration 00034 — pg_cron : relances automatiques quotidiennes
-- Appelle l'Edge Function auto-remind chaque jour à 08h00 heure Tahiti (UTC-10 → 18:00 UTC)
--
-- PRÉREQUIS : activer pg_cron + pg_net dans le dashboard Supabase
--   Database → Extensions → pg_cron ✓  et  pg_net ✓
--
-- Après ce push, enregistrer le job via SQL Editor ou Supabase Dashboard → Cron Jobs :
--
--   SELECT cron.schedule(
--     'auto-remind-overdue',
--     '0 18 * * *',
--     $$ SELECT net.http_post(
--       url     := 'https://ttjpaggocubxsgekxtzu.supabase.co/functions/v1/auto-remind',
--       headers := jsonb_build_object(
--         'Authorization', 'Bearer <SERVICE_ROLE_KEY>',
--         'Content-Type',  'application/json'
--       ),
--       body    := '{}'::jsonb
--     ) $$
--   );

-- Ajouter la colonne sent_by nullable si pas déjà nullable
-- (la relance auto n'a pas d'utilisateur associé)
ALTER TABLE public.invoice_reminders
  ALTER COLUMN sent_by DROP NOT NULL;

-- Index pour accélérer la requête quotidienne du cron
CREATE INDEX IF NOT EXISTS idx_invoice_reminders_invoice_sent
  ON public.invoice_reminders(invoice_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_overdue_cron
  ON public.invoices(due_date, status, deleted_at)
  WHERE deleted_at IS NULL AND status IN ('sent', 'overdue');
