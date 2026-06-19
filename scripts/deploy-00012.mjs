#!/usr/bin/env node
// One-off: Deploy only migration 00012 (orders + order_items)
// Usage: node scripts/deploy-00012.mjs

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_FILE = join(__dirname, "..", "supabase", "migrations", "00012_orders_storefront.sql");

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

  try {
    console.log("Connecting to Supabase database...");
    await client.connect();
    console.log("Connected successfully.\n");

    const sql = readFileSync(MIGRATION_FILE, "utf-8");
    console.log("Applying 00012_orders_storefront.sql...");
    
    await client.query(sql);
    
    console.log("  ✅ Migration 00012 applied successfully.\n");

    // Verify tables exist
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('orders', 'order_items')
      ORDER BY table_name;
    `);
    
    console.log("Tables created:");
    for (const t of tables) {
      console.log(`  ✅ public.${t.table_name}`);
    }
    
    console.log("\n✅ Migration 00012 deployment complete.");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
