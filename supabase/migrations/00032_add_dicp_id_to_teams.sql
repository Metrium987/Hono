-- Migration 00032: Add DICP ID to teams
-- Apply after 00031_fix_jwt_hook_and_numbering.sql
--
-- DICP ID is the French Polynesia equivalent of SIRET in mainland France.
-- It must appear on every B2B invoice PDF alongside N° Tahiti.

ALTER TABLE public.teams
  ADD COLUMN dicp_id TEXT;

COMMENT ON COLUMN public.teams.dicp_id IS 'DICP identifier (French Polynesia fiscal ID, equivalent to SIRET)';
