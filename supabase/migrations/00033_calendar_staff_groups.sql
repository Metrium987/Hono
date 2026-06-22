-- Migration 00033 : Agenda + Groupes Staff

CREATE TABLE IF NOT EXISTS public.staff_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT NOT NULL DEFAULT '#6366f1',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.staff_group_members (
  group_id  UUID NOT NULL REFERENCES public.staff_groups(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  event_type  TEXT NOT NULL DEFAULT 'meeting'
    CHECK (event_type IN ('meeting', 'call', 'task', 'reminder', 'other')),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  location    TEXT,
  created_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id    UUID REFERENCES public.staff_groups(id) ON DELETE SET NULL,
  is_all_day  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.event_attendees (
  event_id  UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status    TEXT NOT NULL DEFAULT 'invited'
    CHECK (status IN ('invited', 'confirmed', 'declined')),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS calendar_events_team_starts_idx ON public.calendar_events(team_id, starts_at);
CREATE INDEX IF NOT EXISTS calendar_events_group_idx ON public.calendar_events(group_id) WHERE group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS calendar_events_customer_idx ON public.calendar_events(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS staff_group_members_user_idx ON public.staff_group_members(user_id);

ALTER TABLE public.staff_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped staff_groups" ON public.staff_groups
  FOR ALL USING (team_id IN (SELECT public.get_teams_for_authenticated_user()));

ALTER TABLE public.staff_group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped staff_group_members" ON public.staff_group_members
  FOR ALL USING (
    group_id IN (
      SELECT id FROM public.staff_groups
      WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
    )
  );

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
-- Events without group_id are visible to all team members.
-- Events with group_id are only visible to members of that group.
CREATE POLICY "Group scoped calendar_events" ON public.calendar_events
  FOR ALL USING (
    team_id IN (SELECT public.get_teams_for_authenticated_user())
    AND (
      group_id IS NULL
      OR group_id IN (
        SELECT group_id FROM public.staff_group_members WHERE user_id = auth.uid()
      )
    )
  );

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Team scoped event_attendees" ON public.event_attendees
  FOR ALL USING (
    event_id IN (
      SELECT id FROM public.calendar_events
      WHERE team_id IN (SELECT public.get_teams_for_authenticated_user())
        AND (
          group_id IS NULL
          OR group_id IN (
            SELECT group_id FROM public.staff_group_members WHERE user_id = auth.uid()
          )
        )
    )
  );
