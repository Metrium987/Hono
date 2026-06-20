-- Phase 2.5: Educational Mode RLS enforcement
-- Source: Ressource/plan/07_architecture_decisions_resolved.md (lines 51-71)
-- Source: Ressource/KIMI/KIMIFIX.md #21

-- 1. Helper function: returns true if the team is in Educational Mode
CREATE OR REPLACE FUNCTION public.is_educational_mode(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(is_educational_mode, FALSE)
  FROM public.teams
  WHERE id = p_team_id;
$$;

-- 2. RLS Policy: block UPDATE on finalized invoices in Educational Mode
CREATE POLICY "Educational Mode blocks edits to finalized invoices"
  ON public.invoices
  FOR UPDATE
  USING (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('paid', 'sent', 'overdue')
  )
  WITH CHECK (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('paid', 'sent', 'overdue')
  );

-- 3. RLS Policy: block DELETE on finalized invoices in Educational Mode
CREATE POLICY "Educational Mode blocks deletes of finalized invoices"
  ON public.invoices
  FOR DELETE
  USING (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('paid', 'sent', 'overdue')
  );

-- 4. RLS Policy: block UPDATE on paid/sent quotes in Educational Mode
CREATE POLICY "Educational Mode blocks edits to finalized quotes"
  ON public.quotes
  FOR UPDATE
  USING (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('accepted', 'rejected', 'expired', 'converted')
  )
  WITH CHECK (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('accepted', 'rejected', 'expired', 'converted')
  );

-- 5. RLS Policy: block DELETE on finalized quotes in Educational Mode
CREATE POLICY "Educational Mode blocks deletes of finalized quotes"
  ON public.quotes
  FOR DELETE
  USING (
    public.is_educational_mode(team_id) = FALSE
    OR status NOT IN ('accepted', 'rejected', 'expired', 'converted')
  );
