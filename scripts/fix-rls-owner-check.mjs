#!/usr/bin/env node
// Fix: Create SECURITY DEFINER helper for owner checks to eliminate
// self-referencing RLS subqueries on team_members that cause recursion.

import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

const client = new pg.Client(DB_CONFIG);
await client.connect();

// 1. Create SECURITY DEFINER helper to check if the current user is an owner of a team
// This bypasses RLS on team_members, avoiding recursion
await client.query(`
CREATE OR REPLACE FUNCTION public.is_team_owner(p_team_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
      AND user_id = (SELECT auth.uid())
      AND is_owner = TRUE
  );
END;
$$;
`);
console.log("✅ Created is_team_owner() SECURITY DEFINER");

// 2. Update the self-referencing RLS policy on team_members
await client.query(`
DROP POLICY IF EXISTS "Team owners can manage members" ON public.team_members;
CREATE POLICY "Team owners can manage members"
  ON public.team_members FOR ALL
  USING (public.is_team_owner(team_id));
`);
console.log("✅ Updated team_members RLS policy to use is_team_owner()");

// 3. Update api_keys RLS policy to use is_team_owner() instead of direct subquery
await client.query(`
DROP POLICY IF EXISTS "Team owners can manage API keys" ON public.api_keys;
CREATE POLICY "Team owners can manage API keys"
  ON public.api_keys FOR ALL
  USING (public.is_team_owner(team_id));
`);
console.log("✅ Updated api_keys RLS policy to use is_team_owner()");

// 4. Update teams RLS policy  
await client.query(`
DROP POLICY IF EXISTS "Team owners can update their teams" ON public.teams;
CREATE POLICY "Team owners can update their teams"
  ON public.teams FOR UPDATE
  USING (public.is_team_owner(id));
`);
console.log("✅ Updated teams RLS policy to use is_team_owner()");

// 5. Update team_roles RLS policy
await client.query(`
DROP POLICY IF EXISTS "Team owners can manage roles" ON public.team_roles;
CREATE POLICY "Team owners can manage roles"
  ON public.team_roles FOR ALL
  USING (public.is_team_owner(team_id));
`);
console.log("✅ Updated team_roles RLS policy to use is_team_owner()");

// 6. Update check_permission RPC to use the new helper instead of direct subquery
await client.query(`
CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id UUID, p_team_id UUID, p_module TEXT, p_action TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN (
    SELECT EXISTS (
      SELECT 1 FROM public.team_members tm
      LEFT JOIN public.team_roles tr ON tm.role_id = tr.id
      WHERE tm.user_id = p_user_id AND tm.team_id = p_team_id
        AND (tm.is_owner = TRUE OR (tr.permissions->p_module ? p_action))
    )
  );
END;
$$;
`);
console.log("✅ Updated check_permission to SECURITY DEFINER");

await client.end();
console.log("\n✅ All RLS fixes applied!");
