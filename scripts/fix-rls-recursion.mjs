#!/usr/bin/env node
// Fix: recreate get_teams_for_authenticated_user as SECURITY DEFINER
// to avoid RLS infinite recursion in all API endpoints
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

await client.query(`
CREATE OR REPLACE FUNCTION public.get_teams_for_authenticated_user()
RETURNS SETOF UUID LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY SELECT team_id FROM public.team_members
    WHERE user_id = (SELECT auth.uid());
END;
$$;
`);

console.log("✅ get_teams_for_authenticated_user recreated as SECURITY DEFINER");
await client.end();
