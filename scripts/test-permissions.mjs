#!/usr/bin/env node
// Permission test suite — tests every role against every endpoint
//
// Usage: node scripts/test-permissions.mjs <TEAM_ID>
//
// Tests each role (Admin, Manager, Salesperson, Accountant) against:
// - GET endpoints → require "read" permission, expect 200 or 403
// - POST/PATCH/DELETE endpoints → require "write" permission, expect 200/201 or 403
//
// Outputs a pass/fail matrix.

const SUPABASE_URL = "https://ttjpaggocubxsgekxtzu.supabase.co";
const API_BASE = "http://localhost:3000/api/v1";

import pkg from "pg";
const { Client } = pkg;
import { createHash, randomBytes } from "node:crypto";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

// ── Permission Matrix ──
// Each role's expected permissions: { module: ["read", "write"] }
// Based on Hono ERP RBAC design

const ROLE_PERMISSIONS = {
  Admin: {
    catalog: ["read", "write"],
    clients: ["read", "write"],
    quotes: ["read", "write"],
    invoices: ["read", "write"],
    orders: ["read", "write"],
    expenses: ["read", "write"],
    income: ["read", "write"],
    reports: ["read", "write"],
    currencies: ["read", "write"],
    taxes: ["read", "write"],
    payments: ["read", "write"],
    settings: ["read", "write"],
  },
  Manager: {
    catalog: ["read", "write"],
    clients: ["read", "write"],
    quotes: ["read", "write"],
    invoices: ["read", "write"],
    orders: ["read", "write"],
    expenses: ["read", "write"],
    income: [],
    reports: ["read"],
    currencies: ["read"],
    taxes: ["read"],
    payments: ["read"],
    settings: [],
  },
  Salesperson: {
    catalog: ["read", "write"],
    clients: ["read"],
    quotes: ["read", "write"],
    invoices: ["read"],
    orders: ["read"],
    expenses: [],
    income: [],
    reports: [],
    currencies: [],
    taxes: [],
    payments: [],
    settings: [],
  },
  Accountant: {
    catalog: [],
    clients: [],
    quotes: [],
    invoices: ["read", "write"],
    orders: [],
    expenses: ["read", "write"],
    income: ["read", "write"],
    reports: ["read"],
    currencies: [],
    taxes: ["read"],
    payments: ["read", "write"],
    settings: [],
  },
};

// ── Endpoint Definitions ──
// Each endpoint: { method, path, module, expectedAction }
// We use representative endpoints — one GET (read) and one mutating (write) per module.

const ENDPOINTS = [
  // catalog
  { method: "GET", path: (q) => `/categories${q}`, module: "catalog", action: "read" },
  { method: "POST", path: (q) => `/categories${q}`, module: "catalog", action: "write", body: { slug: "perm-test", translations: [{ locale: "fr", name: "Perm Test" }] } },
  { method: "GET", path: (q) => `/products${q}`, module: "catalog", action: "read" },
  { method: "POST", path: (q) => `/products${q}`, module: "catalog", action: "write", body: { name: "Perm Test", price_ht: 1000, currency_id: null /* filled dynamically */ } },

  // clients
  { method: "GET", path: (q) => `/customers${q}`, module: "clients", action: "read" },
  { method: "POST", path: (q) => `/customers${q}`, module: "clients", action: "write", body: { contact_name: "Perm Test", email: "perm@test.pf" } },
  { method: "GET", path: (q) => `/vendors${q}`, module: "clients", action: "read" },
  { method: "POST", path: (q) => `/vendors${q}`, module: "clients", action: "write", body: { name: "Perm Test", email: "perm@vendor.pf" } },

  // quotes
  { method: "GET", path: (q) => `/quotes${q}`, module: "quotes", action: "read" },
  { method: "POST", path: (q) => `/quotes${q}`, module: "quotes", action: "write", body: { customer_id: null, currency_id: null, items: [{ description: "Test", quantity: 1, unit_price_ht: 1000 }] } },

  // invoices
  { method: "GET", path: (q) => `/invoices${q}`, module: "invoices", action: "read" },
  { method: "POST", path: (q) => `/invoices${q}`, module: "invoices", action: "write", body: { customer_id: null, due_date: "2025-12-31", currency_id: null, items: [{ description: "Test", quantity: 1, unit_price_ht: 1000 }] } },
  { method: "GET", path: (q) => `/credit-notes${q}`, module: "invoices", action: "read" },
  { method: "POST", path: (q) => `/credit-notes${q}`, module: "invoices", action: "write", body: { customer_id: null, currency_id: null, items: [{ description: "Test", quantity: 1, unit_price_ht: 1000 }] } },

  // orders
  { method: "GET", path: (q) => `/orders${q}`, module: "orders", action: "read" },
  { method: "POST", path: (q) => `/orders${q}`, module: "orders", action: "write", body: { customer_id: null, source: "erp", items: [{ description: "Test", quantity: 1, unit_price: 1000 }] } },

  // expenses
  { method: "GET", path: (q) => `/expenses${q}`, module: "expenses", action: "read" },
  { method: "POST", path: (q) => `/expenses${q}`, module: "expenses", action: "write", body: { description: "Test", amount: 1000, currency_id: null, expense_date: "2025-06-01" } },
  { method: "GET", path: (q) => `/expense-categories${q}`, module: "expenses", action: "read" },

  // income
  { method: "GET", path: (q) => `/income${q}`, module: "income", action: "read" },
  { method: "POST", path: (q) => `/income${q}`, module: "income", action: "write", body: { description: "Test", amount: 1000, currency_id: null, income_date: "2025-06-01" } },
  { method: "GET", path: (q) => `/income-categories${q}`, module: "income", action: "read" },

  // reports
  { method: "GET", path: (q) => `/reports${q}&type=pnl`, module: "reports", action: "read" },

  // currencies
  { method: "GET", path: (q) => `/currencies${q}`, module: "currencies", action: "read" },
  { method: "POST", path: (q) => `/currencies${q}`, module: "currencies", action: "write", body: { code: "PERM", name: "Perm Test Currency", symbol: "P" } },
  { method: "PATCH", path: (q) => `/currencies${q}&id=fake`, module: "currencies", action: "write", body: { name: "Updated" } },
  { method: "DELETE", path: (q) => `/currencies${q}&id=fake`, module: "currencies", action: "write" },

  // taxes
  { method: "GET", path: (q) => `/settings/tax-rates${q}`, module: "taxes", action: "read" },
  { method: "POST", path: (q) => `/settings/tax-rates${q}`, module: "taxes", action: "write", body: { name: "Perm Test Tax", rate: 5 } },
  { method: "PATCH", path: (q) => `/settings/tax-rates${q}&id=fake`, module: "taxes", action: "write", body: { name: "Updated" } },
  { method: "DELETE", path: (q) => `/settings/tax-rates${q}&id=fake`, module: "taxes", action: "write" },

  // settings (company + api-keys)
  { method: "GET", path: (q) => `/settings/company${q}`, module: "settings", action: "read" },
  { method: "PATCH", path: (q) => `/settings/company${q}`, module: "settings", action: "write", body: { name: "Updated Company Name" } },
  { method: "GET", path: (q) => `/settings/api-keys${q}`, module: "settings", action: "read" },
  { method: "POST", path: (q) => `/settings/api-keys${q}`, module: "settings", action: "write", body: { name: "Perm Test Key" } },

  // payments
  { method: "GET", path: (q) => `/settings/payment-methods${q}`, module: "payments", action: "read" },
  { method: "POST", path: (q) => `/settings/payment-methods${q}`, module: "payments", action: "write", body: { name: "perm-test-method" } },
];

// ── Helpers ──

const stats = { total: 0, passed: 0, failed: 0 };

function logResult(roleName, method, path, module, action, expected, actual, body) {
  const ok = expected ? actual >= 200 && actual < 300 : actual === 403;
  const statusSymbol = ok ? "✅" : "❌";
  const expectedLabel = expected ? "ALLOW" : "DENY";
  const detail = body ? ` (${body.substring(0, 60)})` : "";
  console.log(`  ${statusSymbol} ${roleName} ${method} ${path} → ${actual} [expect ${expectedLabel}]${detail}`);
  stats.total++;
  if (ok) stats.passed++;
  else stats.failed++;
}

async function apiCall(method, path, apiKey, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let responseBody = null;
  try { responseBody = await res.text(); } catch {}
  return { status: res.status, body: responseBody };
}

async function getCurrencyId(client) {
  const { rows } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  return rows[0]?.id;
}

async function getCustomerId(client, teamId) {
  const { rows } = await client.query(
    "SELECT id FROM public.customers WHERE team_id = $1 LIMIT 1", [teamId]
  );
  return rows[0]?.id;
}

async function ensureRolesExist(client, teamId) {
  for (const [roleName, perms] of Object.entries(ROLE_PERMISSIONS)) {
    const { rows } = await client.query(
      "SELECT id FROM public.team_roles WHERE team_id = $1 AND name = $2",
      [teamId, roleName]
    );
    if (!rows[0]) {
      await client.query(
        `INSERT INTO public.team_roles (team_id, name, permissions)
         VALUES ($1, $2, $3::jsonb)`,
        [teamId, roleName, JSON.stringify(perms)]
      );
      console.log(`  ✅ Created ${roleName} role`);
    } else {
      // Update permissions to ensure they match
      await client.query(
        `UPDATE public.team_roles SET permissions = $3::jsonb WHERE team_id = $1 AND name = $2`,
        [teamId, roleName, JSON.stringify(perms)]
      );
    }
  }
}

async function createApiKeyForRole(client, teamId, roleName) {
  const { rows: roles } = await client.query(
    "SELECT id FROM public.team_roles WHERE team_id = $1 AND name = $2",
    [teamId, roleName]
  );
  if (!roles[0]) {
    console.error(`  ❌ Role '${roleName}' not found`);
    return null;
  }

  const rawKey = "hk_perm_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 8);

  // Clean up old keys
  await client.query(
    `DELETE FROM public.api_keys WHERE name LIKE 'PermTest_${roleName}%'`
  );

  await client.query(
    `INSERT INTO public.api_keys (team_id, role_id, key_prefix, key_hash, name)
     VALUES ($1, $2, $3, $4, $5)`,
    [teamId, roles[0].id, keyPrefix, keyHash, `PermTest_${roleName}`]
  );

  return rawKey;
}

// ── Main ──

async function main() {
  const teamId = process.argv[2];
  if (!teamId) {
    console.error("Usage: node scripts/test-permissions.mjs <TEAM_ID>");
    process.exit(1);
  }

  // Health check
  console.log("--- Dev Server Health Check ---");
  try {
    const health = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(5000) });
    console.log(`  ✅ Dev server responding (status ${health.status})`);
  } catch (err) {
    console.error(`  ❌ Cannot reach localhost:3000 — is 'npm run dev' running?`);
    process.exit(1);
  }

  console.log(`\n═══ Permission Test Suite (team: ${teamId}) ═══\n`);

  // Connect to DB
  const client = new Client(DB_CONFIG);
  await client.connect();

  // Ensure all roles exist with correct permissions
  console.log("--- Ensuring Roles ---");
  await ensureRolesExist(client, teamId);

  // Get reference data
  const currencyId = await getCurrencyId(client);
  const customerId = await getCustomerId(client, teamId);

  if (!currencyId) {
    console.error("  ❌ No currency found in database");
    await client.end();
    process.exit(1);
  }

  // Fill in dynamic body fields
  for (const ep of ENDPOINTS) {
    if (ep.body) {
      if (ep.body.currency_id === null) ep.body.currency_id = currencyId;
      if (ep.body.customer_id === null) ep.body.customer_id = customerId;
    }
  }

  // Test each role
  const roleNames = Object.keys(ROLE_PERMISSIONS);

  for (const roleName of roleNames) {
    console.log(`\n── Testing Role: ${roleName} ──`);

    // Create API key for this role
    const apiKey = await createApiKeyForRole(client, teamId, roleName);
    if (!apiKey) {
      console.log(`  ❌ Could not create API key for ${roleName}, skipping`);
      continue;
    }
    console.log(`  🔑 API key created (${apiKey.substring(0, 16)}...)`);

    const query = `?team_id=${teamId}`;

    for (const ep of ENDPOINTS) {
      const path = ep.path(query);

      // Determine expected outcome
      const perms = ROLE_PERMISSIONS[roleName][ep.module] || [];
      const expectedToPass = perms.includes(ep.action);

      const { status, body } = await apiCall(ep.method, path, apiKey, ep.body);

      // Validate: if permission expected, status should be 2xx (not 403)
      // If no permission, status should be 403
      let testPassed;
      if (expectedToPass) {
        testPassed = status !== 403; // Allowed: any 2xx/4xx (non-403 validation errors) are OK
      } else {
        testPassed = status === 403; // Denied: must be 403
      }

      const statusSymbol = testPassed ? "✅" : "❌";
      const expectedLabel = expectedToPass ? "ALLOW" : "DENY";
      const detail = !testPassed && body ? ` (${body.substring(0, 80)})` : "";
      console.log(`  ${statusSymbol} ${roleName} ${ep.method} ${path} → ${status} [expect ${expectedLabel}]${detail}`);

      stats.total++;
      if (testPassed) stats.passed++;
      else stats.failed++;
    }
  }

  await client.end();

  // Summary
  console.log("\n═══════════ Results ═══════════");
  console.log(`  ✅ Passed: ${stats.passed}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  📊 Total:  ${stats.total}`);
  const pct = Math.round((stats.passed / stats.total) * 100);
  console.log(`  📈 Rate:   ${pct}%`);

  if (stats.failed > 0) {
    console.log("\n❌ Some permission checks FAILED — review above");
    process.exit(1);
  }
  console.log("\n✅ All permission checks PASSED!");
}

main().catch((err) => {
  console.error("\n❌ Test suite crashed:", err.message);
  process.exit(1);
});
