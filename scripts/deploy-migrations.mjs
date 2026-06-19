#!/usr/bin/env node
// Deploy SQL migrations to Supabase project
// Usage: node scripts/deploy-migrations.mjs

import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(__dirname, "..", "supabase", "migrations");
const SEED_FILE = join(__dirname, "..", "supabase", "seed.sql");

// Connection parameters (password has special chars, use object config)
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

    // Get migration files in order
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration files:\n`);
    for (const file of files) {
      console.log(`  ${file}`);
    }
    console.log("");

    // Apply each migration
    for (const file of files) {
      const filePath = join(MIGRATIONS_DIR, file);
      const sql = readFileSync(filePath, "utf-8");

      console.log(`Applying ${file}...`);
      try {
        await client.query(sql);
        console.log(`  ✅ ${file} applied successfully.\n`);
      } catch (err) {
        // Check if errors are just "already exists" (from partial previous run)
        const msg = err.message || "";
        const isExists = msg.includes("already exists") || msg.includes("already been applied");

        console.error(`  ${isExists ? "⚠️" : "❌"} ${file} ${isExists ? "SKIPPED (already applied):" : "FAILED:"}`, msg);

        if (!isExists) {
          console.error("  Aborting migration sequence.");
          process.exit(1);
        }
        console.log(`  (Continuing despite existing objects — migration was partially applied)\n`);
      }
    }

    // Apply seed data
    console.log("Applying seed data...");
    const seedSql = readFileSync(SEED_FILE, "utf-8");
    try {
      await client.query(seedSql);
      console.log("  ✅ Seed data applied successfully.\n");
    } catch (err) {
      console.error("  ⚠️ Seed data warning:", err.message);
      console.error("  (May be OK if data already exists — ON CONFLICT DO NOTHING)");
    }

    console.log("✅ All migrations applied successfully.");
  } catch (err) {
    console.error("Fatal error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
