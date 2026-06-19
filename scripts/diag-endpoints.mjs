#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import pg from "pg";

const TEAM_ID = "285eaab4-44b4-4027-b65c-a1ebe7195678";
const API = "http://localhost:3000/api/v1";

async function main() {
  const client = new pg.Client({
    host: "db.ttjpaggocubxsgekxtzu.supabase.co",
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: "qXm8a@H8*k?nKcC",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: role } = await client.query(
    "SELECT id FROM public.team_roles WHERE name = 'Admin' LIMIT 1"
  );
  const rawKey = "hk_diag_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  await client.query("DELETE FROM public.api_keys WHERE name = 'diag'");
  await client.query(
    "INSERT INTO public.api_keys (team_id,role_id,key_prefix,key_hash,name) VALUES ($1,$2,$3,$4,'diag')",
    [TEAM_ID, role[0].id, rawKey.substring(0, 8), keyHash]
  );
  await client.end();

  const q = `?team_id=${TEAM_ID}`;
  const headers = { Authorization: `Bearer ${rawKey}` };

  const tests = [
    { name: "GET /categories", method: "GET", path: `/categories${q}` },
    { name: "POST /categories", method: "POST", path: `/categories${q}`, body: { name: "TestCat" } },
    { name: "POST /products", method: "POST", path: `/products${q}`, body: { name: "TestProd", type: "product", price_ht: 1000 } },
    { name: "POST /customers", method: "POST", path: `/customers${q}`, body: { contact_name: "TestCust", email: "t@t.pf" } },
    { name: "GET /currencies", method: "GET", path: `/currencies${q}` },
    { name: "GET /expense-categories", method: "GET", path: `/expense-categories${q}` },
    { name: "GET /income-categories", method: "GET", path: `/income-categories${q}` },
    { name: "POST /vendors", method: "POST", path: `/vendors${q}`, body: { name: "TestVendor" } },
    { name: "POST /expenses", method: "POST", path: `/expenses${q}`, body: { description: "Test", amount: 1000, expense_date: "2026-01-01" } },
    { name: "POST /income", method: "POST", path: `/income${q}`, body: { description: "Test", amount: 1000, income_date: "2026-01-01" } },
    { name: "GET /settings/payment-methods", method: "GET", path: `/settings/payment-methods${q}` },
    { name: "POST /settings/api-keys", method: "POST", path: `/settings/api-keys${q}`, body: { name: "TestKey" } },
    { name: "GET /reports?type=pnl", method: "GET", path: `/reports${q}&type=pnl` },
  ];

  for (const t of tests) {
    const opts = { method: t.method || "GET", headers: { ...headers } };
    if (t.body) {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(t.body);
    }
    try {
      const res = await fetch(`${API}${t.path}`, opts);
      const text = await res.text();
      console.log(`${t.name} → ${res.status}: ${text.substring(0, 250)}`);
    } catch (err) {
      console.log(`${t.name} → ERROR: ${err.message}`);
    }
  }
}

main().catch(console.error);
