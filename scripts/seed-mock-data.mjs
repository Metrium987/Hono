#!/usr/bin/env node
// Seed comprehensive mock data for all Hono ERP modules
// Usage: node scripts/seed-mock-data.mjs <TEAM_ID>
//   TEAM_ID: printed by create-test-users.mjs

import pg from "pg";

const DB_CONFIG = {
  host: "db.ttjpaggocubxsgekxtzu.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: "qXm8a@H8*k?nKcC",
  ssl: { rejectUnauthorized: false },
};

const CATEGORIES = [
  "Électronique", "Informatique", "Mobilier", "Fournitures de bureau",
  "Services", "Alimentation", "Vêtements", "Sport & Loisirs",
];

const EXPENSE_CATEGORIES = [
  "Fournitures de bureau", "Services externes", "Loyer & Charges",
  "Déplacements", "Frais bancaires", "Communication",
  "Entretien & Réparations", "Assurances",
];

const INCOME_CATEGORIES = [
  "Subventions", "Prestations diverses", "Consulting",
  "Ventes diverses", "Commissions",
];

const PRODUCTS = [
  { name: "Ordinateur Portable Pro", type: "product", price: 450000, desc: "PC portable 16 Go RAM, 512 Go SSD" },
  { name: "Écran 27\" 4K", type: "product", price: 185000, desc: "Écran IPS UltraSharp 27 pouces" },
  { name: "Clavier Mécanique", type: "product", price: 25000, desc: "Clavier mécanique RGB switches Cherry MX" },
  { name: "Souris Sans Fil", type: "product", price: 12000, desc: "Souris ergonomique Logitech MX Master" },
  { name: "Casque Audio Pro", type: "product", price: 35000, desc: "Casque Bose réduction de bruit" },
  { name: "Webcam HD 1080p", type: "product", price: 15000, desc: "Webcam Logitech C920" },
  { name: "Conception site web", type: "service", price: 350000, desc: "Site vitrine responsive 5 pages" },
  { name: "Maintenance informatique", type: "service", price: 120000, desc: "Forfait maintenance mensuel" },
  { name: "Formation Excel Avancé", type: "service", price: 85000, desc: "Formation 2 jours sur site" },
  { name: "Audit Sécurité", type: "service", price: 250000, desc: "Audit complet infrastructure réseau" },
];

const VENDORS = [
  { name: "Bureau Plus", contact: "Jean Dupont", email: "jean@bureauplus.pf" },
  { name: "Tech Supply PF", contact: "Marie Teai", email: "marie@techsupply.pf" },
  { name: "Pacific Logistics", contact: "Pierre Chan", email: "pierre@pacificlogistics.pf" },
  { name: "Services Pro PF", contact: "Lea Mana", email: "lea@servicespro.pf" },
  { name: "Fournitures Générales", contact: "Tahia Nui", email: "tahia@fournitures.pf" },
];

const CLIENTS = [
  { name: "SARL Tahiti Services", email: "contact@tahitiservices.pf", is_b2b: true, n_tahiti: "T123456" },
  { name: "Pacific Tech SARL", email: "info@pacifictech.pf", is_b2b: true, n_tahiti: "T234567" },
  { name: "Marae Voyages", email: "contact@maraevoyages.pf", is_b2b: true, n_tahiti: "T345678" },
  { name: "Jean Dupont", email: "jean.dupont@gmail.com", is_b2b: false },
  { name: "Sophie Maheata", email: "sophie.m@mail.pf", is_b2b: false },
];

const EXPENSES = [
  { desc: "Achat fournitures bureau", amount: 15250, cat: "Fournitures de bureau", vendor: "Bureau Plus" },
  { desc: "Facture électricité août", amount: 45000, cat: "Loyer & Charges" },
  { desc: "Abonnement internet pro", amount: 12000, cat: "Communication", vendor: "Pacific Logistics" },
  { desc: "Maintenance climatisation", amount: 35000, cat: "Entretien & Réparations", vendor: "Services Pro PF" },
  { desc: "Fournitures impressions", amount: 8900, cat: "Fournitures de bureau", vendor: "Fournitures Générales" },
  { desc: "Frais bancaires mensuels", amount: 4500, cat: "Frais bancaires" },
  { desc: "Déplacement Moorea", amount: 28000, cat: "Déplacements" },
  { desc: "Assurance responsabilité civile", amount: 65000, cat: "Assurances" },
  { desc: "Cartouches toner", amount: 32000, cat: "Fournitures de bureau", vendor: "Tech Supply PF" },
  { desc: "Nettoyage locaux", amount: 18000, cat: "Services externes" },
];

const INCOME = [
  { desc: "Subvention DGAE 2026", amount: 500000, cat: "Subventions" },
  { desc: "Prestation conseil ERP", amount: 350000, cat: "Consulting" },
  { desc: "Commission partenaire", amount: 85000, cat: "Commissions" },
  { desc: "Vente mobilier bureau", amount: 120000, cat: "Ventes diverses" },
];

// ── Main ──

async function main() {
  const teamId = process.argv[2];
  if (!teamId) {
    console.error("Usage: node scripts/seed-mock-data.mjs <TEAM_ID>");
    process.exit(1);
  }

  console.log(`═══ Seeding Mock Data (team: ${teamId}) ═══\n`);

  const client = new pg.Client(DB_CONFIG);
  await client.connect();
  console.log("✅ Connected to database\n");

  // Get reference data IDs
  const { rows: taxRates } = await client.query("SELECT id, rate FROM public.tax_rates ORDER BY rate");
  const { rows: currencies } = await client.query("SELECT id, code FROM public.currencies");
  const { rows: paymentMethods } = await client.query("SELECT id, name FROM public.payment_methods");

  const defaultCurrency = currencies[0];
  const tva16 = taxRates.find((t) => t.rate === 16) || taxRates[0];
  const tva13 = taxRates.find((t) => t.rate === 13) || taxRates[0];
  const tva5 = taxRates.find((t) => t.rate === 5) || taxRates[0];

  // 1. Product Categories
  console.log("--- 1. Product Categories ---");
  const catIds = {};
  for (const name of CATEGORIES) {
    const { rows } = await client.query(
      `INSERT INTO public.product_categories (team_id, name, slug)
       VALUES ($1, $2, LOWER(REPLACE($2, ' ', '-')))
       ON CONFLICT (team_id, slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [teamId, name]
    );
    catIds[name] = rows[0].id;
    process.stdout.write(".");
  }
  console.log(` ${CATEGORIES.length} categories created`);

  // 2. Customers
  console.log("\n--- 2. Customers ---");
  const custIds = {};
  for (const c of CLIENTS) {
    const { rows } = await client.query(
      // Check if customer already exists by email
      const { rows: existing } = await client.query(
        "SELECT id FROM public.customers WHERE team_id = $1 AND email = $2 LIMIT 1",
        [teamId, c.email]
      );
      if (existing.length > 0) {
        custIds[c.name] = existing[0].id;
        process.stdout.write("s");
      } else {
        const { rows } = await client.query(
          `INSERT INTO public.customers (team_id, name, email, is_b2b, n_tahiti)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [teamId, c.name, c.email, c.is_b2b, c.n_tahiti || null]
        );
        custIds[c.name] = rows[0].id;
        process.stdout.write(".");
      }
  }
  console.log(` ${Object.keys(custIds).length} customers created`);

  // 3. Products
  console.log("\n--- 3. Products ---");
  const prodIds = [];
  for (const p of PRODUCTS) {
    // Map to a category
    const catNames = Object.keys(catIds);
    const catIdx = prodIds.length % catNames.length;
    const catName = catNames[catIdx];
    const taxRate = p.type === "service" ? tva13 : tva16;

    const { rows } = await client.query(
      `INSERT INTO public.products (team_id, category_id, type, name, description, price_ht, currency_id, tax_rate_id, is_active, track_stock)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
       RETURNING id`,
      [
        teamId, catIds[catName], p.type, p.name, p.desc,
        p.price, defaultCurrency.id, taxRate.id,
        p.type === "product",
      ]
    );
    if (rows[0]) {
      prodIds.push(rows[0].id);
      process.stdout.write(".");
    }
  }
  console.log(` ${prodIds.length} products created`);

  // 4. Expense Categories
  console.log("\n--- 4. Expense Categories ---");
  const expCatIds = {};
  for (const name of EXPENSE_CATEGORIES) {
    const { rows } = await client.query(
      `INSERT INTO public.expense_categories (team_id, name)
       VALUES ($1, $2) ON CONFLICT (team_id, name) DO NOTHING RETURNING id`,
      [teamId, name]
    );
    if (rows[0]) {
      expCatIds[name] = rows[0].id;
      process.stdout.write(".");
    }
  }
  console.log(` ${Object.keys(expCatIds).length} expense categories created`);

  // 5. Vendors
  console.log("\n--- 5. Vendors ---");
  const vendIds = {};
  for (const v of VENDORS) {
    const { rows } = await client.query(
      `INSERT INTO public.vendors (team_id, name, contact_name, email)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (team_id, name) DO UPDATE SET contact_name = EXCLUDED.contact_name
       RETURNING id`,
      [teamId, v.name, v.contact, v.email]
    );
    if (rows[0]) {
      vendIds[v.name] = rows[0].id;
      process.stdout.write(".");
    }
  }
  console.log(` ${Object.keys(vendIds).length} vendors created`);

  // 6. Income Categories
  console.log("\n--- 6. Income Categories ---");
  const incCatIds = {};
  for (const name of INCOME_CATEGORIES) {
    const { rows } = await client.query(
      `INSERT INTO public.income_categories (team_id, name)
       VALUES ($1, $2) ON CONFLICT (team_id, name) DO NOTHING RETURNING id`,
      [teamId, name]
    );
    if (rows[0]) {
      incCatIds[name] = rows[0].id;
      process.stdout.write(".");
    }
  }
  console.log(` ${Object.keys(incCatIds).length} income categories created`);

  // 7. Expenses
  console.log("\n--- 7. Expenses ---");
  let expCount = 0;
  for (let i = 0; i < EXPENSES.length; i++) {
    const e = EXPENSES[i];
    const catId = expCatIds[e.cat] || null;
    const vendId = e.vendor ? (vendIds[e.vendor] || null) : null;
    const daysAgo = Math.floor(Math.random() * 90);
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];

    await client.query(
      `INSERT INTO public.expenses (team_id, category_id, vendor_id, description, amount, currency_id, expense_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [teamId, catId, vendId, e.desc, e.amount, defaultCurrency.id, date]
    );
    expCount++;
    process.stdout.write(".");
  }
  console.log(` ${expCount} expenses created`);

  // 8. Income
  console.log("\n--- 8. Income ---");
  let incCount = 0;
  for (const i of INCOME) {
    const catId = incCatIds[i.cat] || null;
    const daysAgo = Math.floor(Math.random() * 60);
    const date = new Date(Date.now() - daysAgo * 86400000).toISOString().split("T")[0];

    await client.query(
      `INSERT INTO public.income (team_id, category_id, description, amount, currency_id, income_date)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [teamId, catId, i.desc, i.amount, defaultCurrency.id, date]
    );
    incCount++;
    process.stdout.write(".");
  }
  console.log(` ${incCount} income entries created`);

  // Summary
  const { rows: summary } = await client.query(`
    SELECT 'products' as tbl, COUNT(*) as cnt FROM public.products WHERE team_id = $1
    UNION ALL SELECT 'customers', COUNT(*) FROM public.customers WHERE team_id = $1
    UNION ALL SELECT 'expense_categories', COUNT(*) FROM public.expense_categories WHERE team_id = $1
    UNION ALL SELECT 'income_categories', COUNT(*) FROM public.income_categories WHERE team_id = $1
    UNION ALL SELECT 'vendors', COUNT(*) FROM public.vendors WHERE team_id = $1
    UNION ALL SELECT 'expenses', COUNT(*) FROM public.expenses WHERE team_id = $1
    UNION ALL SELECT 'income', COUNT(*) FROM public.income WHERE team_id = $1
  `, [teamId]);

  console.log("\n\n═══ Seed Summary ═══");
  for (const row of summary) {
    console.log(`  ${row.tbl.padEnd(22)} ${row.cnt}`);
  }

  await client.end();
  console.log("\n✅ Mock data seeded successfully!");
}

main().catch((err) => {
  console.error("\n❌ Seed failed:", err.message);
  process.exit(1);
});
