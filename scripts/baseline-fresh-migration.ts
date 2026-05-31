/**
 * Baseline a freshly-generated migration against an EXISTING database.
 *
 * After you squash history and run `npm run db:generate`, the new 0000 is a
 * full CREATE-everything migration. On a DB that already has those tables,
 * `npm run db:migrate` would try to run it and fail ("relation already exists").
 *
 * This script marks every migration currently in migrations/meta/_journal.json
 * as ALREADY APPLIED by inserting its row into drizzle.__drizzle_migrations
 * (the same table/format drizzle-kit uses). drizzle decides what to run by
 * timestamp, so once the latest journal entry's `when` is recorded, `migrate`
 * skips it and only runs genuinely newer migrations going forward.
 *
 * Run order on an existing DB:
 *   1. npm run db:generate
 *   2. npx tsx scripts/baseline-fresh-migration.ts     <-- this file
 *   3. npm run db:migrate            (no-op now; proves clean state)
 *   4. psql "$DATABASE_URL" -f scripts/backfill-after-fresh-migration.sql
 *
 * Idempotent: re-running won't create duplicate rows (guarded by hash).
 */
import pg from "pg";
import crypto from "crypto";
import fs from "fs";
import path from "path";

let dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) throw new Error("DATABASE_URL is not set");
// tolerate a `psql '...'` wrapped value, like scripts/migrate.ts does
if (dbUrl.startsWith("psql ")) {
  dbUrl = dbUrl.replace(/^psql\s+'?/, "").replace(/'$/, "");
}

const MIGRATIONS_DIR = path.resolve(process.cwd(), "migrations");
const JOURNAL = path.join(MIGRATIONS_DIR, "meta", "_journal.json");

interface JournalEntry { idx: number; version: string; when: number; tag: string; breakpoints: boolean; }

async function main() {
  if (!fs.existsSync(JOURNAL)) {
    throw new Error(`No journal at ${JOURNAL}. Run \`npm run db:generate\` first.`);
  }
  const journal = JSON.parse(fs.readFileSync(JOURNAL, "utf8")) as { entries: JournalEntry[] };
  if (!journal.entries?.length) throw new Error("Journal has no entries — nothing to baseline.");

  const pool = new pg.Pool({
    connectionString: dbUrl,
    ssl: dbUrl.includes("localhost") || dbUrl.includes("127.0.0.1") ? false : { rejectUnauthorized: false },
  });
  const client = await pool.connect();
  try {
    await client.query('CREATE SCHEMA IF NOT EXISTS "drizzle"');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    for (const entry of journal.entries) {
      const sqlPath = path.join(MIGRATIONS_DIR, `${entry.tag}.sql`);
      if (!fs.existsSync(sqlPath)) {
        console.warn(`  skip: ${entry.tag}.sql not found`);
        continue;
      }
      // drizzle hashes the full raw .sql file content with sha256
      const content = fs.readFileSync(sqlPath, "utf8");
      const hash = crypto.createHash("sha256").update(content).digest("hex");

      const exists = await client.query(
        'SELECT 1 FROM "drizzle"."__drizzle_migrations" WHERE hash = $1 LIMIT 1',
        [hash],
      );
      if ((exists.rowCount ?? 0) > 0) {
        console.log(`  already baselined: ${entry.tag}`);
        continue;
      }
      await client.query(
        'INSERT INTO "drizzle"."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when],
      );
      console.log(`  baselined: ${entry.tag}  (when=${entry.when})`);
    }

    console.log("\n✓ Baseline complete. `npm run db:migrate` will now skip these and only run newer migrations.");
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Baseline failed:", err);
  process.exit(1);
});
