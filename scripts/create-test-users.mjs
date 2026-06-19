#!/usr/bin/env node
// Create 5 test users in Supabase Auth + assign team roles
// Usage: node scripts/create-test-users.mjs
//
// Users created:
//   admin@test.com     → team owner (Admin)
//   manager@test.com   → Manager role
//   salesman@test.com  → Salesperson role
//   accountant@test.com → Accountant role
//   customer@test.com  → Portal user (Client, no team_members)

const SUPABASE_URL = "https://ttjpaggocubxsgekxtzu.supabase.co";
const SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0anBhZ2dvY3VieHNnZWt4dHp1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MTgyOTQwOSwiZXhwIjoyMDk3NDA1NDA5fQ.JFRo9-UI61NLVouiTbn06y8bIVgiQVTeLJVeLzoNdYo";

import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

const USERS = [
  { email: "admin@test.com", full_name: "Admin User", role: "admin" },
  { email: "manager@test.com", full_name: "Manager User", role: "manager" },
  { email: "salesman@test.com", full_name: "Salesman User", role: "salesperson" },
  { email: "accountant@test.com", full_name: "Accountant User", role: "accountant" },
  { email: "customer@test.com", full_name: "Customer User", role: "customer" },
];

const PASSWORD = "test123";

const ROLE_PERMISSIONS = {
  admin: {
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
  },
  manager: {
    catalog: ["read", "write"],
    clients: ["read", "write"],
    quotes: ["read", "write"],
    invoices: ["read", "write"],
    orders: ["read", "write"],
    expenses: ["read", "write"],
    reports: ["read"],
    currencies: ["read"],
    taxes: ["read"],
    payments: ["read"],
  },
  salesperson: {
    catalog: ["read", "write"],
    clients: ["read"],
    quotes: ["read", "write"],
    invoices: ["read"],
    orders: ["read"],
  },
  accountant: {
    invoices: ["read", "write"],
    payments: ["read", "write"],
    reports: ["read", "write"],
    expenses: ["read", "write"],
    taxes: ["read"],
  },
};

// ── Helpers ──

async function createAuthUser(email, password, fullName) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    // If user already exists, try to fetch them
    if (res.status === 409 || data?.msg?.includes("already")) {
      console.log(`  ⚠️  ${email} already exists, fetching...`);
      const existing = await fetch(
        `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY } }
      );
      const existingData = await existing.json();
      if (existingData?.users?.length > 0) {
        return { id: existingData.users[0].id, email, created: false };
      }
      throw new Error(`Cannot find existing user: ${email}`);
    }
    throw new Error(`Failed to create user ${email}: ${JSON.stringify(data)}`);
  }
  console.log(`  ✅ ${email} created (id: ${data.id})`);
  return { id: data.id, email, created: true };
}

// ── Main ──

async function main() {
  console.log("═══ Creating Test Users ═══\n");

  // 1. Create auth users
  console.log("--- Step 1: Create Auth Users ---");
  const createdUsers = [];
  for (const u of USERS) {
    const result = await createAuthUser(u.email, PASSWORD, u.full_name);
    createdUsers.push({ ...result, role: u.role, full_name: u.full_name });
  }

  // 2. Connect to DB for team/role setup
  console.log("\n--- Step 2: Connect to Database ---");
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  console.log("  ✅ Connected to Supabase DB");

  // 3. Create a team (if not exists)
  console.log("\n--- Step 3: Create Team ---");
  let { rows: existingTeams } = await client.query(
    "SELECT id FROM public.teams WHERE name = 'Hono Test Team' LIMIT 1"
  );
  let teamId;
  if (existingTeams.length > 0) {
    teamId = existingTeams[0].id;
    console.log(`  ⚠️  Using existing team: ${teamId}`);
  } else {
    const adminUser = createdUsers.find((u) => u.role === "admin");
    const { rows } = await client.query(
      `INSERT INTO public.teams (name, email, n_tahiti, invoice_prefix, quote_prefix)
       VALUES ('Hono Test Team', 'admin@test.com', 'T999999', 'FAC-', 'DEV-')
       RETURNING id`
    );
    teamId = rows[0].id;
    console.log(`  ✅ Team created: ${teamId}`);
  }

  // 4. Create roles (if not exists)
  console.log("\n--- Step 4: Create Team Roles ---");
  const roleMap = {};
  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    let { rows } = await client.query(
      "SELECT id FROM public.team_roles WHERE team_id = $1 AND name = $2 LIMIT 1",
      [teamId, roleName.charAt(0).toUpperCase() + roleName.slice(1)]
    );
    if (rows.length > 0) {
      roleMap[roleName] = rows[0].id;
      console.log(`  ⚠️  ${roleName} role already exists: ${rows[0].id}`);
    } else {
      const capitalized = roleName.charAt(0).toUpperCase() + roleName.slice(1);
      ({ rows } = await client.query(
        `INSERT INTO public.team_roles (team_id, name, permissions)
         VALUES ($1, $2, $3::jsonb) RETURNING id`,
        [teamId, capitalized, JSON.stringify(permissions)]
      ));
      roleMap[roleName] = rows[0].id;
      console.log(`  ✅ ${roleName} role created: ${rows[0].id}`);
    }
  }

  // 5. Assign team_members (ERP users)
  console.log("\n--- Step 5: Assign Team Members ---");
  for (const u of createdUsers) {
    if (u.role === "customer") {
      console.log(`  ⏭️  ${u.email} is a portal user — skipping team_members`);
      continue;
    }
    const isOwner = u.role === "admin";
    const roleId = roleMap[u.role];
    // Check if already a member
    const { rows: existing } = await client.query(
      "SELECT 1 FROM public.team_members WHERE team_id = $1 AND user_id = $2",
      [teamId, u.id]
    );
    if (existing.length > 0) {
      console.log(`  ⚠️  ${u.email} already in team_members`);
      continue;
    }
    await client.query(
      `INSERT INTO public.team_members (team_id, user_id, role_id, is_owner)
       VALUES ($1, $2, $3, $4)`,
      [teamId, u.id, roleId, isOwner]
    );
    console.log(`  ✅ ${u.email} → ${u.role} ${isOwner ? "(owner)" : ""}`);
  }

  // 6. Create portal user for customer
  console.log("\n--- Step 6: Create Portal User for customer@test.com ---");
  const customerUser = createdUsers.find((u) => u.role === "customer");
  
  // Check if customer already has a portal_user entry
  const { rows: existingPortal } = await client.query(
    "SELECT id FROM public.customers WHERE email = $1 LIMIT 1",
    [customerUser.email]
  );

  if (existingPortal.length === 0) {
    // Create a customer record first (uses contact_name, not name)
    const { rows: newCustomer } = await client.query(
      `INSERT INTO public.customers (team_id, contact_name, email, is_b2b)
       VALUES ($1, 'Customer User', $2, FALSE)
       RETURNING id`,
      [teamId, customerUser.email]
    );
    const customerId = newCustomer[0].id;

    // Create portal_user entry
    const { rows: existingPortalUser } = await client.query(
      "SELECT 1 FROM public.portal_users WHERE user_id = $1",
      [customerUser.id]
    );
    if (existingPortalUser.length === 0) {
      await client.query(
        `INSERT INTO public.portal_users (customer_id, email, name)
         VALUES ($1, $2, $3)`,
        [customerId, customerUser.email, customerUser.full_name]
      );
      console.log(`  ✅ Portal user created for ${customerUser.email}`);
    } else {
      console.log(`  ⚠️  Portal user already exists for ${customerUser.email}`);
    }
  } else {
    console.log(`  ⚠️  Customer record already exists for ${customerUser.email}`);
  }

  // 7. Set up default config for the team (tax rates, currencies, payment methods)
  console.log("\n--- Step 7: Verify Team Configuration ---");
  const { rows: taxes } = await client.query(
    "SELECT COUNT(*) as cnt FROM public.tax_rates WHERE team_id = $1 OR team_id IS NULL",
    [teamId]
  );
  console.log(`  📊 Tax rates available: ${taxes[0].cnt}`);

  const { rows: currencies } = await client.query(
    "SELECT COUNT(*) as cnt FROM public.currencies WHERE team_id = $1 OR team_id IS NULL",
    [teamId]
  );
  console.log(`  📊 Currencies available: ${currencies[0].cnt}`);

  const { rows: paymentMethods } = await client.query(
    "SELECT COUNT(*) as cnt FROM public.payment_methods WHERE team_id = $1 OR team_id IS NULL",
    [teamId]
  );
  console.log(`  📊 Payment methods available: ${paymentMethods[0].cnt}`);

  await client.end();
  console.log("\n═══ User Setup Complete ═══");
  console.log(`Team ID: ${teamId}`);
  console.log("Users:");
  for (const u of createdUsers) {
    console.log(`  ${u.email.padEnd(25)} ${u.role.padEnd(15)} password: ${PASSWORD}`);
  }
  console.log("\nNext: Run 'node scripts/test-all-modules.mjs <TEAM_ID>'");
}

main().catch((err) => {
  console.error("\n❌ Setup failed:", err.message);
  process.exit(1);
});
