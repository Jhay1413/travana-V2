/**
 * Rebuild scripts/seed-data/supplier-scrapers.ts from the supplier_scraper table.
 *
 * READ-ONLY against the database: one SELECT, no writes, no migrations.
 * Only supplier_key, supplier_name, adapter_type, is_active and config are read.
 * encrypted_credentials and session_state are never selected, and any
 * credential-looking key inside config is stripped as a backstop.
 *
 * Usage:
 *   npx tsx scripts/dump-supplier-scrapers.ts                      # DB wins for every key
 *   npx tsx scripts/dump-supplier-scrapers.ts --keep=easyjet,tui   # keep these from the current seed file
 *   npx tsx scripts/dump-supplier-scrapers.ts --dry-run            # print the plan, write nothing
 *
 * Reads DATABASE_URL from the environment, else from .env (never printed).
 */
import fs from "fs";
import path from "path";
import pg from "pg";
import { fileURLToPath } from "url";
import { supplierScraperSeed, type SupplierScraperSeed } from "./seed-data/supplier-scrapers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SEED_PATH = path.join(__dirname, "seed-data", "supplier-scrapers.ts");
const CREDENTIAL_KEYS = /^(username|password|apiKey|api_key|secret|credentials|cookies?|sessionState)$/i;

const DRY_RUN = process.argv.includes("--dry-run");
const KEEP = new Set(
  (process.argv.find((a) => a.startsWith("--keep="))?.slice("--keep=".length) ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean),
);

function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)\s*$/);
      if (m) return m[1].replace(/^["']|["']$/g, "").replace(/\s+#.*$/, "");
    }
  }
  throw new Error("DATABASE_URL is not set");
}

function stripCredentials(value: unknown, trail: string, found: string[]): unknown {
  if (Array.isArray(value)) return value.map((v, i) => stripCredentials(v, `${trail}[${i}]`, found));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (CREDENTIAL_KEYS.test(k)) {
        found.push(`${trail}.${k}`);
        continue;
      }
      out[k] = stripCredentials(v, `${trail}.${k}`, found);
    }
    return out;
  }
  return value;
}

function render(rows: SupplierScraperSeed[]): string {
  const current = fs.readFileSync(SEED_PATH, "utf8");
  const marker = "export const supplierScraperSeed";
  const head = current.slice(0, current.indexOf(marker));
  if (!head) throw new Error("Could not find the seed array in the current seed file");
  return `${head}${marker}: SupplierScraperSeed[] = ${JSON.stringify(rows, null, 2)} as unknown as SupplierScraperSeed[];\n`;
}

async function main() {
  const client = new pg.Client({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } });
  await client.connect();
  let dbRows: { supplier_key: string; supplier_name: string; adapter_type: string; is_active: boolean; config: unknown }[];
  try {
    await client.query("BEGIN READ ONLY");
    const res = await client.query(
      "select supplier_key, supplier_name, adapter_type, is_active, config from supplier_scraper order by supplier_key",
    );
    dbRows = res.rows;
    await client.query("ROLLBACK");
  } finally {
    await client.end();
  }

  const local = new Map(supplierScraperSeed.map((s) => [s.supplierKey, s]));
  const stripped: string[] = [];
  const merged = new Map<string, SupplierScraperSeed>();
  const plan: string[] = [];

  for (const r of dbRows) {
    if (KEEP.has(r.supplier_key) && local.has(r.supplier_key)) {
      merged.set(r.supplier_key, local.get(r.supplier_key)!);
      plan.push(`  keep     ${r.supplier_key} (local seed)`);
      continue;
    }
    const entry = {
      supplierKey: r.supplier_key,
      supplierName: r.supplier_name,
      adapterType: r.adapter_type,
      isActive: r.is_active,
      config: stripCredentials(r.config ?? {}, r.supplier_key, stripped),
    } as SupplierScraperSeed;
    const before = local.get(r.supplier_key);
    const status = !before ? "new" : JSON.stringify(before) === JSON.stringify(entry) ? "same" : "changed";
    plan.push(`  ${status.padEnd(8)} ${r.supplier_key}`);
    merged.set(r.supplier_key, entry);
  }
  for (const [key, entry] of local) {
    if (!merged.has(key)) {
      merged.set(key, entry);
      plan.push(`  local    ${key} (not in DB, kept from seed)`);
    }
  }

  const rows = [...merged.values()].sort((a, b) => a.supplierKey.localeCompare(b.supplierKey));
  console.log(`${dbRows.length} DB rows, ${rows.length} seed entries:`);
  console.log(plan.join("\n"));
  for (const k of KEEP) if (!local.has(k)) console.log(`  warning: --keep ${k} is not in the current seed file`);
  if (stripped.length) console.log(`Stripped credential-looking keys: ${stripped.join(", ")}`);

  if (DRY_RUN) {
    console.log("Dry run: nothing written.");
    return;
  }
  fs.writeFileSync(SEED_PATH, render(rows));
  console.log(`Wrote ${path.relative(process.cwd(), SEED_PATH)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
