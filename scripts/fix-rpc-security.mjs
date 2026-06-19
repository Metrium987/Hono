#!/usr/bin/env node
// Fix: recreate verify_api_key as SECURITY DEFINER to avoid RLS recursion
import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

const SQL = `
CREATE OR REPLACE FUNCTION public.verify_api_key(p_token_hash TEXT)
RETURNS TABLE (
  team_id UUID,
  role_id UUID,
  key_id UUID,
  key_name TEXT,
  permissions JSONB,
  is_owner BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.team_id,
    ak.role_id,
    ak.id,
    ak.name,
    tr.permissions,
    COALESCE(tm.is_owner, FALSE)
  FROM public.api_keys ak
  LEFT JOIN public.team_roles tr ON ak.role_id = tr.id
  LEFT JOIN public.team_members tm ON tm.team_id = ak.team_id AND tm.role_id = ak.role_id AND tm.is_owner = TRUE
  WHERE ak.key_hash = p_token_hash
    AND ak.revoked_at IS NULL
    AND (ak.expires_at IS NULL OR ak.expires_at > NOW())
  LIMIT 1;
END;
$$;
`;

const client = new pg.Client(DB_CONFIG);
await client.connect();
await client.query(SQL);
console.log("✅ verify_api_key recreated as SECURITY DEFINER");
await client.end();
