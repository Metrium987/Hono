#!/usr/bin/env node
// Test Phase 7: expenses + income + reports flow end-to-end
import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

async function main() {
  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  console.log("✅ Connected to Supabase\n");

  // 1. Verify tables exist
  console.log("--- 1. Tables ---");
  for (const table of ["expense_categories", "vendors", "expenses", "income_categories", "income"]) {
    const { rows } = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) as exists`,
      [table]
    );
    console.log(`  ${table}: ${rows[0].exists ? "✅ EXISTS" : "❌ MISSING"}`);
  }

  // 2. Get a team ID and currency ID for testing
  const { rows: teams } = await client.query("SELECT id FROM public.teams LIMIT 1");
  if (teams.length === 0) {
    console.log("\n❌ No teams found in database. Create a team first.");
    await client.end();
    return;
  }
  const teamId = teams[0].id;
  console.log(`\n--- 2. Using team: ${teamId} ---`);

  const { rows: currencies } = await client.query("SELECT id FROM public.currencies LIMIT 1");
  const currencyId = currencies[0]?.id;

  // 3. Test expense categories CRUD
  console.log("\n--- 3. Expense Categories ---");
  await client.query(
    `INSERT INTO public.expense_categories (team_id, name) VALUES ($1, 'Fournitures de bureau') ON CONFLICT (team_id, name) DO NOTHING`,
    [teamId]
  );
  await client.query(
    `INSERT INTO public.expense_categories (team_id, name) VALUES ($1, 'Services externes') ON CONFLICT (team_id, name) DO NOTHING`,
    [teamId]
  );
  const { rows: expCats } = await client.query(
    "SELECT id, name FROM public.expense_categories WHERE team_id = $1 ORDER BY name",
    [teamId]
  );
  console.log(`  Created ${expCats.length} categories: ${expCats.map((c) => c.name).join(", ")}`);

  // 4. Test vendors CRUD
  console.log("\n--- 4. Vendors ---");
  await client.query(
    `INSERT INTO public.vendors (team_id, name, contact_name, email) VALUES ($1, 'Bureau Plus', 'Jean Dupont', 'jean@bureauplus.pf') ON CONFLICT DO NOTHING`,
    [teamId]
  );
  const { rows: vendors } = await client.query(
    "SELECT id, name FROM public.vendors WHERE team_id = $1 ORDER BY name",
    [teamId]
  );
  console.log(`  Created vendor: ${vendors.map((v) => v.name).join(", ")}`);

  // 5. Test expenses CRUD
  console.log("\n--- 5. Expenses ---");
  const expCatId = expCats[0]?.id;
  const vendorId = vendors[0]?.id;

  await client.query(
    `INSERT INTO public.expenses (team_id, category_id, vendor_id, vendor_name, description, amount, currency_id, expense_date, notes)
     VALUES ($1, $2, $3, NULL, 'Achat fournitures bureau', 15000.00, $4, CURRENT_DATE, 'Facture n°FAC-2024-001')`,
    [teamId, expCatId, vendorId, currencyId]
  );
  await client.query(
    `INSERT INTO public.expenses (team_id, category_id, vendor_id, description, amount, currency_id, expense_date)
     VALUES ($1, $2, NULL, 'Prestation comptable', 45000.00, $3, CURRENT_DATE - 15)`,
    [teamId, expCatId, currencyId]
  );

  const { rows: expenses } = await client.query(
    `SELECT e.id, e.description, e.amount, e.expense_date, ec.name as category_name, v.name as vendor_name
     FROM public.expenses e
     LEFT JOIN public.expense_categories ec ON ec.id = e.category_id
     LEFT JOIN public.vendors v ON v.id = e.vendor_id
     WHERE e.team_id = $1
     ORDER BY e.expense_date DESC`,
    [teamId]
  );
  console.log(`  Created ${expenses.length} expenses:`);
  for (const exp of expenses) {
    console.log(`    - ${exp.description} | ${exp.amount} F | ${exp.expense_date?.toISOString().split("T")[0]} | ${exp.category_name || "No cat"}`);
  }

  // 6. Test income categories CRUD
  console.log("\n--- 6. Income Categories ---");
  await client.query(
    `INSERT INTO public.income_categories (team_id, name) VALUES ($1, 'Subventions') ON CONFLICT (team_id, name) DO NOTHING`,
    [teamId]
  );
  await client.query(
    `INSERT INTO public.income_categories (team_id, name) VALUES ($1, 'Prestations diverses') ON CONFLICT (team_id, name) DO NOTHING`,
    [teamId]
  );
  const { rows: incCats } = await client.query(
    "SELECT id, name FROM public.income_categories WHERE team_id = $1 ORDER BY name",
    [teamId]
  );
  console.log(`  Created ${incCats.length} categories: ${incCats.map((c) => c.name).join(", ")}`);

  // 7. Test income CRUD
  console.log("\n--- 7. Income ---");
  const incCatId = incCats[0]?.id;

  await client.query(
    `INSERT INTO public.income (team_id, category_id, description, amount, currency_id, income_date)
     VALUES ($1, $2, 'Subvention annuelle', 250000.00, $3, CURRENT_DATE)`,
    [teamId, incCatId, currencyId]
  );
  await client.query(
    `INSERT INTO public.income (team_id, description, amount, currency_id, income_date)
     VALUES ($1, 'Prestation de conseil', 75000.00, $2, CURRENT_DATE - 30)`,
    [teamId, currencyId]
  );

  const { rows: income } = await client.query(
    `SELECT i.id, i.description, i.amount, i.income_date, ic.name as category_name
     FROM public.income i
     LEFT JOIN public.income_categories ic ON ic.id = i.category_id
     WHERE i.team_id = $1
     ORDER BY i.income_date DESC`,
    [teamId]
  );
  console.log(`  Created ${income.length} income entries:`);
  for (const inc of income) {
    console.log(`    - ${inc.description} | ${inc.amount} F | ${inc.income_date?.toISOString().split("T")[0]} | ${inc.category_name || "No cat"}`);
  }

  // 8. Test reports: aggregate queries
  console.log("\n--- 8. Report Queries ---");

  const { rows: pnlRevenue } = await client.query(
    `SELECT COALESCE(SUM(total_ttc::numeric), 0) as total FROM public.invoices
     WHERE team_id = $1 AND status IN ('paid', 'partial', 'sent')`,
    [teamId]
  );
  console.log(`  Invoiced revenue: ${pnlRevenue[0]?.total || 0} F`);

  const { rows: pnlExpenses } = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM public.expenses WHERE team_id = $1`,
    [teamId]
  );
  console.log(`  Total expenses: ${pnlExpenses[0]?.total || 0} F`);

  const { rows: pnlOtherIncome } = await client.query(
    `SELECT COALESCE(SUM(amount), 0) as total FROM public.income WHERE team_id = $1`,
    [teamId]
  );
  console.log(`  Other income: ${pnlOtherIncome[0]?.total || 0} F`);

  const invoiceRev = parseFloat(pnlRevenue[0]?.total) || 0;
  const otherInc = parseFloat(pnlOtherIncome[0]?.total) || 0;
  const totalExp = parseFloat(pnlExpenses[0]?.total) || 0;
  const netIncome = invoiceRev + otherInc - totalExp;
  const margin = invoiceRev > 0 ? Math.round((netIncome / invoiceRev) * 100) : 0;

  console.log(`\n  📊 P&L Summary:`);
  console.log(`     Revenue: ${(invoiceRev + otherInc).toLocaleString("fr-FR")} F`);
  console.log(`     Expenses: ${totalExp.toLocaleString("fr-FR")} F`);
  console.log(`     Net Income: ${netIncome.toLocaleString("fr-FR")} F`);
  console.log(`     Margin: ${margin}%`);

  await client.end();
  console.log("\n✅ Phase 7 end-to-end test PASSED");
}

main().catch((err) => {
  console.error("❌ Test failed:", err.message);
  process.exit(1);
});
