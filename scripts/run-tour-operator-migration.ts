/**
 * Runs scripts/migrate-tour-operators-to-catalogue.sql against DATABASE_URL
 * without needing psql. Uses the app's own pg pool (node-postgres), so the same
 * .env the server uses is enough.
 *
 *   npm run db:migrate-tour-operators -- --dry-run   # read-only report, run this first
 *   npm run db:migrate-tour-operators                # the real thing (one transaction)
 *
 * The SQL file is split at its "-- MIGRATION" marker: the part above is the
 * read-only DRY RUN, the part below is the transactional migration. On any
 * error inside the migration the runner issues ROLLBACK, so nothing half-applies.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../server/v2/config/database";
import type { QueryResult } from "pg";

const SQL_PATH = resolve(dirname(fileURLToPath(import.meta.url)), "migrate-tour-operators-to-catalogue.sql");
const MARKER = /^-- MIGRATION\s+\(one transaction\)/m;

function splitScript(text: string): { dryRun: string; migration: string } {
  const match = MARKER.exec(text);
  if (!match) throw new Error(`Marker "-- MIGRATION (one transaction)" not found in ${SQL_PATH}`);
  const cut = text.lastIndexOf("-- ====", match.index);
  return { dryRun: text.slice(0, cut), migration: text.slice(cut) };
}

function asArray(result: QueryResult | QueryResult[]): QueryResult[] {
  return Array.isArray(result) ? result : [result];
}

function printResults(results: QueryResult[]): void {
  let n = 0;
  for (const r of results) {
    if (!r.fields || r.fields.length === 0) continue;
    n += 1;
    console.log(`\n--- result ${n}: ${r.rowCount ?? r.rows.length} row(s)`);
    if (r.rows.length === 0) console.log("(none)");
    else console.table(r.rows);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. Run with: npm run db:migrate-tour-operators (it loads .env).");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const { dryRun: dryRunSql, migration } = splitScript(readFileSync(SQL_PATH, "utf8"));
  const client = await pool.connect();
  try {
    console.log(`DRY RUN against ${new URL(process.env.DATABASE_URL).host} ...`);
    printResults(asArray(await client.query(dryRunSql)));
    if (dryRun) {
      console.log("\nDry run only. Nothing was changed. Re-run without --dry-run to migrate.");
      return;
    }
    console.log("\nRunning the migration (one transaction) ...");
    try {
      await client.query(migration);
      console.log("Migration committed. Next: npm run db:migrate (migrations/0061 is already generated and idempotent).");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err: unknown) => {
  console.error("\nFAILED — nothing was committed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
