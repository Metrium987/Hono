#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const SB_URL = "https://ttjpaggocubxsgekxtzu.supabase.co";
const ANON_KEY = "sb_publishable_ElkGhtM2Nizz5lTUJ3Fchw_acif_8Po";
const TEAM_ID = "285eaab4-44b4-4027-b65c-a1ebe7195678";

const client = new pg.Client({
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
});
await client.connect();

// Get Admin role
const { rows: role } = await client.query(
  "SELECT id FROM public.team_roles WHERE name = 'Admin' LIMIT 1"
);

// Create fresh key
const rawKey = "hk_test_" + randomBytes(24).toString("hex");
const keyHash = createHash("sha256").update(rawKey).digest("hex");

await client.query("DELETE FROM public.api_keys WHERE name = 'Test Admin Key'");
await client.query(
  "INSERT INTO public.api_keys (team_id, role_id, key_prefix, key_hash, name) VALUES ($1, $2, $3, $4, $5)",
  [TEAM_ID, role[0].id, rawKey.substring(0, 8), keyHash, "Test Admin Key"]
);

console.log("KEY:", rawKey);
console.log("HASH:", keyHash.substring(0, 30) + "...");

// Test via Supabase REST API (what the app actually uses)
const rpcRes = await fetch(SB_URL + "/rest/v1/rpc/verify_api_key", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    apikey: ANON_KEY,
    Authorization: "Bearer " + ANON_KEY,
  },
  body: JSON.stringify({ p_token_hash: keyHash }),
});
const rpcBody = await rpcRes.text();
console.log("RPC status:", rpcRes.status);
console.log("RPC body:", rpcBody.substring(0, 500));

// Now test via actual API endpoint on localhost
console.log("\n--- Testing API endpoint ---");
const apiRes = await fetch("http://localhost:3000/api/v1/categories?team_id=" + TEAM_ID, {
  headers: { Authorization: "Bearer " + rawKey },
});
const apiBody = await apiRes.text();
console.log("API status:", apiRes.status);
console.log("API body:", apiBody.substring(0, 500));

await client.end();
