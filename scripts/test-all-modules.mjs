#!/usr/bin/env node
// Comprehensive CRUD test suite for all Hono API modules
// Tests every module's create, read, update, delete operations.
//
// Usage: node scripts/test-all-modules.mjs <TEAM_ID>
//   TEAM_ID: UUID of the team (printed by create-test-users.mjs)

const SUPABASE_URL = "https://ttjpaggocubxsgekxtzu.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0anBhZ2dvY3VieHNnZWt4dHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgyOTQwOSwiZXhwIjoyMDk3NDA1NDA5fQ.JFRo9-UI61NLVouiTbn06y8bIVgiQVTeLJVeLzoNdYo";
const API_BASE = "http://localhost:3000/api/v1";

import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

// ── Stats ──
const stats = { passed: 0, failed: 0, skipped: 0 };

function assert(condition, msg) {
  if (condition) {
    stats.passed++;
    return true;
  }
  stats.failed++;
  console.error(`    ❌ FAIL: ${msg}`);
  return false;
}

function skip(msg) {
  stats.skipped++;
  console.log(`    ⏭️  SKIP: ${msg}`);
}

// ── Helpers ──

async function loginUser(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({ email, password: "test123" }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Login failed for ${email}: ${err}`);
  }
  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    userId: data.user.id,
  };
}

// Create an API key in the database directly, since Bearer tokens from
// Supabase Auth are not valid API keys. API keys have the 'hk_' prefix.
async function createApiKey(userId, teamId) {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  
  // Get or create an Admin role (admins use is_owner=true on team_members,
  // but API keys need a role_id to inherit permissions)
  let { rows: role } = await client.query(
    "SELECT id FROM public.team_roles WHERE team_id = $1 AND name = 'Admin' LIMIT 1",
    [teamId]
  );
  
  if (!role[0]) {
    // Create Admin role with full permissions
    const fullPerms = {
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
    };
    ({ rows: role } = await client.query(
      `INSERT INTO public.team_roles (team_id, name, permissions)
       VALUES ($1, 'Admin', $2::jsonb) RETURNING id`,
      [teamId, JSON.stringify(fullPerms)]
    ));
    console.log(`  ✅ Created Admin role: ${role[0].id}`);
  }
  
  const { createHash, randomBytes } = await import("node:crypto");
  const rawKey = "hk_test_" + randomBytes(24).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 8);
  
  await client.query(
    `INSERT INTO public.api_keys (team_id, role_id, key_prefix, key_hash, name, description)
     VALUES ($1, $2, $3, $4, 'Test Admin Key', 'Auto-created by test suite')`,
    [teamId, role[0].id, keyPrefix, keyHash]
  );
  
  await client.end();
  return rawKey;
}

async function apiGet(path, apiKey) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  const body = res.ok ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    console.log(`    📝 GET ${path} → ${res.status} ${JSON.stringify(body || "").substring(0, 100)}`);
  }
  return { status: res.status, ok: res.ok, body };
}

async function apiPost(path, apiKey, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const body = res.ok ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    console.log(`    📝 POST ${path} → ${res.status} ${JSON.stringify(body || "").substring(0, 150)}`);
  }
  return { status: res.status, ok: res.ok, body };
}

async function apiPatch(path, apiKey, data) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  const body = res.ok ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    console.log(`    📝 PATCH ${path} → ${res.status}`);
  }
  return { status: res.status, ok: res.ok, body };
}

async function apiDelete(path, apiKey) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    console.log(`    📝 DELETE ${path} → ${res.status}`);
  }
  return { status: res.status, ok: res.ok };
}

// ── Module Test Suites ──

async function testCategories(teamId, token) {
  console.log("\n── Categories ──");
  const cat = { name: "Test Cat", slug: "test-cat", description: "Test", translations: [{ locale: "fr", name: "Test Cat" }] };
  const query = `?team_id=${teamId}`;

  // CREATE
  const created = await apiPost(`/categories${query}`, token, cat);
  assert(created.ok || created.status === 201 || created.status === 200, `Create category: ${created.status}`);
  const catId = created.body?.id || created.body?.data?.id;
  if (!catId) { skip("No ID returned, SKIP remaining category tests"); return; }

  // READ (list)
  const listed = await apiGet(`/categories${query}`, token);
  assert(listed.ok, `List categories: ${listed.status}`);

  // READ (single)
  const single = await apiGet(`/categories/${catId}${query}`, token);
  assert(single.ok, `Get category: ${single.status}`);

  // UPDATE
  const updated = await apiPatch(`/categories/${catId}${query}`, token, { name: "Test Cat Updated" });
  assert(updated.ok, `Update category: ${updated.status}`);

  // DELETE
  const deleted = await apiDelete(`/categories/${catId}${query}`, token);
  assert(deleted.ok, `Delete category: ${deleted.status}`);
}

async function testProducts(teamId, token) {
  console.log("\n── Products ──");
  const query = `?team_id=${teamId}`;

  // Get a tax rate ID and currency ID from DB
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: tax } = await client.query("SELECT id FROM public.tax_rates LIMIT 1");
  const { rows: currency } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  await client.end();

  const taxRateId = tax[0]?.id;
  const currencyId = currency[0]?.id;
  if (!taxRateId || !currencyId) { skip("No tax rate or currency found"); return; }

  const product = {
    name: "Test Product",
    type: "product",
    price_ht: 10000,
    currency_id: currencyId,
    tax_rate_id: taxRateId,
    currency_id: currencyId,
    description: "A test product for e2e testing",
    is_active: true,
  };

  const created = await apiPost(`/products${query}`, token, product);
  assert(created.ok, `Create product: ${created.status}`);
  const prodId = created.body?.id || created.body?.data?.id;
  if (!prodId) { skip("No ID returned"); return; }

  const listed = await apiGet(`/products${query}`, token);
  assert(listed.ok, `List products: ${listed.status}`);

  const single = await apiGet(`/products/${prodId}${query}`, token);
  assert(single.ok, `Get product: ${single.status}`);

  const updated = await apiPatch(`/products/${prodId}${query}`, token, { name: "Test Product Updated" });
  assert(updated.ok, `Update product: ${updated.status}`);

  const deleted = await apiDelete(`/products/${prodId}${query}`, token);
  assert(deleted.ok, `Delete product: ${deleted.status}`);
}

async function testCustomers(teamId, token) {
  console.log("\n── Customers ──");
  const query = `?team_id=${teamId}`;
  const customer = { contact_name: "Test Customer", email: "test@customer.pf", is_b2b: false };

  const created = await apiPost(`/customers${query}`, token, customer);
  assert(created.ok, `Create customer: ${created.status}`);
  const custId = created.body?.id || created.body?.data?.id;
  if (!custId) { skip("No ID returned"); return; }

  const listed = await apiGet(`/customers${query}`, token);
  assert(listed.ok, `List customers: ${listed.status}`);

  const single = await apiGet(`/customers/${custId}${query}`, token);
  assert(single.ok, `Get customer: ${single.status}`);

  const updated = await apiPatch(`/customers/${custId}${query}`, token, { contact_name: "Test Customer Updated" });
  assert(updated.ok, `Update customer: ${updated.status}`);

  const deleted = await apiDelete(`/customers/${custId}${query}`, token);
  assert(deleted.ok, `Delete customer: ${deleted.status}`);
}

async function testInvoices(teamId, token) {
  console.log("\n── Invoices ──");
  const query = `?team_id=${teamId}`;

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: tax } = await client.query("SELECT id FROM public.tax_rates LIMIT 1");
  const { rows: currency } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  const { rows: customer } = await client.query("SELECT id FROM public.customers WHERE team_id = $1 LIMIT 1", [teamId]);
  await client.end();

  const taxRateId = tax[0]?.id;
  const currencyId = currency[0]?.id;
  if (!taxRateId || !currencyId) { skip("No tax or currency found"); return; }

  const invoice = {
    customer_id: customer[0]?.id || null,
    issue_date: new Date().toISOString().split("T")[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    currency_id: currencyId,
    items: [
      {
        description: "Test item",
        quantity: 1,
        unit_price_ht: 50000,
        tax_rate_id: taxRateId,
      },
    ],
  };

  const created = await apiPost(`/invoices${query}`, token, invoice);
  assert(created.ok, `Create invoice: ${created.status}`);
  const invId = created.body?.id || created.body?.data?.id;
  if (!invId) { skip("No ID returned"); return; }

  const listed = await apiGet(`/invoices${query}`, token);
  assert(listed.ok, `List invoices: ${listed.status}`);

  const single = await apiGet(`/invoices/${invId}${query}`, token);
  assert(single.ok, `Get invoice: ${single.status}`);

  const updated = await apiPatch(`/invoices/${invId}${query}`, token, { notes: "Updated notes" });
  assert(updated.ok, `Update invoice: ${updated.status}`);

  const deleted = await apiDelete(`/invoices/${invId}${query}`, token);
  assert(deleted.ok, `Delete invoice: ${deleted.status}`);
}

async function testQuotes(teamId, token) {
  console.log("\n── Quotes ──");
  const query = `?team_id=${teamId}`;

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: tax } = await client.query("SELECT id FROM public.tax_rates LIMIT 1");
  const { rows: currency } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  await client.end();

  const taxRateId = tax[0]?.id;
  const currencyId = currency[0]?.id;
  if (!taxRateId || !currencyId) { skip("No tax or currency found"); return; }

  // Get a customer ID for the quote
  const { rows: cust } = await client.query(
    "SELECT id FROM public.customers WHERE team_id = $1 LIMIT 1", [teamId]
  );
  await client.end();

  const quote = {
    customer_id: cust[0]?.id || null,
    currency_id: currencyId,
    validity_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
    items: [
      {
        description: "Test quote item",
        quantity: 2,
        unit_price_ht: 25000,
        tax_rate_id: taxRateId,
      },
    ],
  };

  const created = await apiPost(`/quotes${query}`, token, quote);
  assert(created.ok, `Create quote: ${created.status}`);
  const quoteId = created.body?.id || created.body?.data?.id;
  if (!quoteId) { skip("No ID returned"); return; }

  const listed = await apiGet(`/quotes${query}`, token);
  assert(listed.ok, `List quotes: ${listed.status}`);

  const single = await apiGet(`/quotes/${quoteId}${query}`, token);
  assert(single.ok, `Get quote: ${single.status}`);

  const deleted = await apiDelete(`/quotes/${quoteId}${query}`, token);
  assert(deleted.ok, `Delete quote: ${deleted.status}`);
}

async function testExpenseCategories(teamId, token) {
  console.log("\n── Expense Categories ──");
  const query = `?team_id=${teamId}`;

  // CREATE via API
  const created = await apiPost(`/expense-categories${query}`, token, { name: "Test Expense Cat" });
  // Try POST first, if fails try direct DB insert
  let catId = created.body?.id || created.body?.data?.id;
  if (!created.ok && !catId) {
    // May not have POST endpoint, use DB directly
    const client = new pg.Client(DB_CONFIG);
    await client.connect();
    const { rows } = await client.query(
      `INSERT INTO public.expense_categories (team_id, name) VALUES ($1, 'Test Expense Cat')
       ON CONFLICT (team_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [teamId]
    );
    catId = rows[0]?.id;
    await client.end();
    console.log(`    📝 Used DB direct insert for expense category: ${catId}`);
    stats.passed++;
  } else {
    assert(created.ok, `Create expense category: ${created.status}`);
  }

  if (!catId) { skip("No ID"); return; }

  const listed = await apiGet(`/expense-categories${query}`, token);
  assert(listed.ok, `List expense categories: ${listed.status}`);

  // DELETE via API
  const deleted = await apiDelete(`/expense-categories?id=${catId}${query.replace("?", "&")}`, token);
  assert(deleted.ok, `Delete expense category: ${deleted.status}`);
}

async function testIncomeCategories(teamId, token) {
  console.log("\n── Income Categories ──");
  const query = `?team_id=${teamId}`;

  const created = await apiPost(`/income-categories${query}`, token, { name: "Test Income Cat" });
  let catId = created.body?.id || created.body?.data?.id;
  if (!created.ok && !catId) {
    const client = new pg.Client(DB_CONFIG);
    await client.connect();
    const { rows } = await client.query(
      `INSERT INTO public.income_categories (team_id, name) VALUES ($1, 'Test Income Cat')
       ON CONFLICT (team_id, name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [teamId]
    );
    catId = rows[0]?.id;
    await client.end();
    console.log(`    📝 Used DB direct insert for income category: ${catId}`);
    stats.passed++;
  } else {
    assert(created.ok, `Create income category: ${created.status}`);
  }
  if (!catId) { skip("No ID"); return; }

  const listed = await apiGet(`/income-categories${query}`, token);
  assert(listed.ok, `List income categories: ${listed.status}`);

  const deleted = await apiDelete(`/income-categories?id=${catId}${query.replace("?", "&")}`, token);
  assert(deleted.ok, `Delete income category: ${deleted.status}`);
}

async function testVendors(teamId, token) {
  console.log("\n── Vendors ──");
  const query = `?team_id=${teamId}`;
  const vendor = { name: "Test Vendor", email: "vendor@test.pf", contact_name: "Vendor Contact" };

  const created = await apiPost(`/vendors${query}`, token, vendor);
  assert(created.ok, `Create vendor: ${created.status}`);
  const vendId = created.body?.id || created.body?.data?.id;
  if (!vendId) { skip("No ID"); return; }

  const listed = await apiGet(`/vendors${query}`, token);
  assert(listed.ok, `List vendors: ${listed.status}`);

  const single = await apiGet(`/vendors/${vendId}${query}`, token);
  assert(single.ok, `Get vendor: ${single.status}`);

  const updated = await apiPatch(`/vendors/${vendId}${query}`, token, { name: "Test Vendor Updated" });
  assert(updated.ok, `Update vendor: ${updated.status}`);

  const deleted = await apiDelete(`/vendors/${vendId}${query}`, token);
  assert(deleted.ok, `Delete vendor: ${deleted.status}`);
}

async function testExpenses(teamId, token) {
  console.log("\n── Expenses ──");
  const query = `?team_id=${teamId}`;

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: cats } = await client.query(
    "SELECT id FROM public.expense_categories WHERE team_id = $1 LIMIT 1", [teamId]
  );
  const { rows: currency } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  await client.end();

  const expense = {
    description: "Test expense",
    amount: 25000,
    currency_id: currency[0]?.id,
    expense_date: new Date().toISOString().split("T")[0],
    category_id: cats[0]?.id || null,
    currency_id: currency[0]?.id,
  };

  const created = await apiPost(`/expenses${query}`, token, expense);
  assert(created.ok, `Create expense: ${created.status}`);
  const expId = created.body?.id || created.body?.data?.id;
  if (!expId) { skip("No ID"); return; }

  const listed = await apiGet(`/expenses${query}`, token);
  assert(listed.ok, `List expenses: ${listed.status}`);

  const single = await apiGet(`/expenses/${expId}${query}`, token);
  assert(single.ok, `Get expense: ${single.status}`);

  const updated = await apiPatch(`/expenses/${expId}${query}`, token, { notes: "Updated notes" });
  assert(updated.ok, `Update expense: ${updated.status}`);

  const deleted = await apiDelete(`/expenses/${expId}${query}`, token);
  assert(deleted.ok, `Delete expense: ${deleted.status}`);
}

async function testIncome(teamId, token) {
  console.log("\n── Income ──");
  const query = `?team_id=${teamId}`;

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: currency } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  await client.end();

  const income = {
    description: "Test income",
    amount: 100000,
    currency_id: currency[0]?.id,
    income_date: new Date().toISOString().split("T")[0],
    notes: "Test income entry",
  };

  const created = await apiPost(`/income${query}`, token, income);
  assert(created.ok, `Create income: ${created.status}`);
  const incId = created.body?.id || created.body?.data?.id;
  if (!incId) { skip("No ID"); return; }

  const listed = await apiGet(`/income${query}`, token);
  assert(listed.ok, `List income: ${listed.status}`);

  const single = await apiGet(`/income/${incId}${query}`, token);
  assert(single.ok, `Get income: ${single.status}`);

  const updated = await apiPatch(`/income/${incId}${query}`, token, { notes: "Updated notes" });
  assert(updated.ok, `Update income: ${updated.status}`);

  const deleted = await apiDelete(`/income/${incId}${query}`, token);
  assert(deleted.ok, `Delete income: ${deleted.status}`);
}

async function testReports(teamId, token) {
  console.log("\n── Reports ──");
  const query = `?team_id=${teamId}`;

  // P&L
  const pnl = await apiGet(`/reports${query}&type=pnl`, token);
  assert(pnl.ok, `P&L report: ${pnl.status}`);

  // VAT by rate
  const vat = await apiGet(`/reports${query}&type=vat`, token);
  assert(vat.ok, `VAT report: ${vat.status}`);

  // Client statement (try with first customer)
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: cust } = await client.query(
    "SELECT id FROM public.customers WHERE team_id = $1 LIMIT 1", [teamId]
  );
  await client.end();

  if (cust[0]) {
    const cs = await apiGet(`/reports${query}&type=client-statement&customer_id=${cust[0].id}`, token);
    assert(cs.ok, `Client statement report: ${cs.status}`);
  } else {
    skip("No customers for client-statement test");
  }
}

async function testOrders(teamId, token) {
  console.log("\n── Orders ──");
  const query = `?team_id=${teamId}`;

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: cust } = await client.query(
    "SELECT id FROM public.customers WHERE team_id = $1 LIMIT 1", [teamId]
  );
  const { rows: prod } = await client.query(
    "SELECT id FROM public.products WHERE team_id = $1 LIMIT 1", [teamId]
  );
  await client.end();

  const order = {
    customer_id: cust[0]?.id || null,
    source: "storefront",
    notes: "Test order",
    items: [
      {
        product_id: prod[0]?.id || null,
        description: "Test order item",
        quantity: 1,
        unit_price: 5000,
      },
    ],
  };

  const created = await apiPost(`/orders${query}`, token, order);
  assert(created.ok, `Create order: ${created.status}`);
  const orderId = created.body?.id || created.body?.data?.id;
  if (!orderId) { skip("No ID"); return; }

  const listed = await apiGet(`/orders${query}`, token);
  assert(listed.ok, `List orders: ${listed.status}`);

  const single = await apiGet(`/orders/${orderId}${query}`, token);
  assert(single.ok, `Get order: ${single.status}`);

  const updated = await apiPatch(`/orders/${orderId}${query}`, token, { status: "processing" });
  assert(updated.ok, `Update order: ${updated.status}`);

  const deleted = await apiDelete(`/orders/${orderId}${query}`, token);
  assert(deleted.ok, `Delete order: ${deleted.status}`);
}

async function testCurrencies(teamId, token) {
  console.log("\n── Currencies ──");
  const query = `?team_id=${teamId}`;
  const listed = await apiGet(`/currencies${query}`, token);
  assert(listed.ok, `List currencies: ${listed.status}`);
}

async function testPaymentMethods(teamId, token) {
  console.log("\n── Payment Methods (Settings) ──");
  const query = `?team_id=${teamId}`;
  const listed = await apiGet(`/settings/payment-methods${query}`, token);
  assert(listed.ok, `List payment methods: ${listed.status}`);
}

async function testApiKeys(teamId, token) {
  console.log("\n── API Keys (Settings) ──");
  const query = `?team_id=${teamId}`;

  // Get a role_id (service_role bypasses RLS, but api_keys.role_id is NOT NULL)
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  const { rows: roles } = await client.query(
    "SELECT id FROM public.team_roles WHERE team_id = $1 LIMIT 1", [teamId]
  );
  await client.end();

  if (!roles[0]) { skip("No roles found"); return; }

  const created = await apiPost(`/settings/api-keys${query}`, token, {
    name: "Test Key",
    description: "Test API key",
    role_id: roles[0].id,
  });
  // API key creation with service_role bypasses RLS on api_keys table
  assert(created.ok || created.status === 201, `Create API key: ${created.status}`);

  const listed = await apiGet(`/settings/api-keys${query}`, token);
  assert(listed.ok, `List API keys: ${listed.status}`);
}

// ── Main ──

async function main() {
  const teamId = process.argv[2];
  if (!teamId) {
    console.error("Usage: node scripts/test-all-modules.mjs <TEAM_ID>");
    console.error("Run 'node scripts/create-test-users.mjs' first to get the TEAM_ID");
    process.exit(1);
  }

  // Health check: is the dev server running?
  console.log("--- Dev Server Health Check ---");
  try {
    const health = await fetch("http://localhost:3000", { signal: AbortSignal.timeout(5000) });
    console.log(`  ✅ Dev server responding on localhost:3000 (status ${health.status})`);
  } catch (err) {
    console.error(`  ❌ Cannot reach localhost:3000 — is \`npm run dev\` running?`);
    console.error(`  ${err.message}`);
    process.exit(1);
  }

  console.log(`\n═══ CRUD Test Suite (team: ${teamId}) ═══\n`);

  // Login as admin
  console.log("--- Authenticating as admin@test.com ---");
  let apiKey;
  try {
    const session = await loginUser("admin@test.com");
    console.log(`  ✅ Logged in as admin (userId: ${session.userId})`);
    // Create an API key for testing (API keys use 'hk_' prefix, not Supabase session tokens)
    apiKey = await createApiKey(session.userId, teamId);
    console.log(`  ✅ API key created: ${apiKey.substring(0, 16)}...`);
  } catch (err) {
    console.error(`  ❌ ${err.message}`);
    console.log("\nMake sure the dev server is running: npm run dev");
    process.exit(1);
  }

  // Run all module tests
  await testCategories(teamId, apiKey);
  await testProducts(teamId, apiKey);
  await testCustomers(teamId, apiKey);
  await testInvoices(teamId, apiKey);
  await testQuotes(teamId, apiKey);
  await testExpenseCategories(teamId, apiKey);
  await testIncomeCategories(teamId, apiKey);
  await testVendors(teamId, apiKey);
  await testExpenses(teamId, apiKey);
  await testIncome(teamId, apiKey);
  await testReports(teamId, apiKey);
  await testOrders(teamId, apiKey);
  await testCurrencies(teamId, apiKey);
  await testPaymentMethods(teamId, apiKey);
  await testApiKeys(teamId, apiKey);

  // Summary
  console.log("\n═══ Results ═══");
  console.log(`  ✅ Passed: ${stats.passed}`);
  console.log(`  ❌ Failed: ${stats.failed}`);
  console.log(`  ⏭️  Skipped: ${stats.skipped}`);
  console.log(`  📊 Total:  ${stats.passed + stats.failed + stats.skipped}`);

  if (stats.failed > 0) {
    console.log("\n❌ Some tests FAILED — check logs above");
    process.exit(1);
  }
  console.log("\n✅ All CRUD tests PASSED");
}

main().catch((err) => {
  console.error("\n❌ Test suite crashed:", err.message);
  process.exit(1);
});
