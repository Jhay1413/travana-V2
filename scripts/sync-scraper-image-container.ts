/**
 * Copy ONE supplier's image-container rule (extraction.imageContainerIncludes)
 * from the seed file into that supplier's supplier_scraper row. Nothing else in
 * the row changes, so hand-made fixes to its other rules survive — unlike
 * `db:seed-supplier-scrapers -- --overwrite`, which replaces every supplier's
 * whole config.
 *
 *   npx tsx --env-file-if-exists=.env scripts/sync-scraper-image-container.ts hoseasons --dry-run
 *   npx tsx --env-file-if-exists=.env scripts/sync-scraper-image-container.ts hoseasons
 */
import { eq } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper } from "../shared/schema";
import { supplierScraperSeed } from "./seed-data/supplier-scrapers";
import { withImageContainer } from "./lib/image-container-patch";

async function main(): Promise<void> {
  const key = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!key || key.startsWith("--")) {
    console.error("Usage: tsx scripts/sync-scraper-image-container.ts <supplier-key> [--dry-run]");
    process.exit(1);
  }
  const seed = supplierScraperSeed.find((s) => s.supplierKey === key);
  if (!seed) {
    console.error(`No seed entry for supplier key "${key}".`);
    process.exit(1);
  }
  const value = (seed.config as { extraction?: { imageContainerIncludes?: unknown } }).extraction?.imageContainerIncludes;

  const rows = await db
    .select({ id: supplier_scraper.id, name: supplier_scraper.supplier_name, config: supplier_scraper.config })
    .from(supplier_scraper)
    .where(eq(supplier_scraper.supplier_key, key));
  if (rows.length !== 1) {
    console.error(`Expected exactly one supplier_scraper row for "${key}", found ${rows.length}. Nothing changed.`);
    process.exit(1);
  }
  const row = rows[0];
  const before = (row.config as { extraction?: { imageContainerIncludes?: unknown } } | null)?.extraction?.imageContainerIncludes;
  console.log(`${row.name} (${key})`);
  console.log(`  before: ${JSON.stringify(before)}`);
  console.log(`  after:  ${JSON.stringify(value)}`);
  if (dryRun) {
    console.log("Dry run. Nothing was changed.");
    return;
  }
  await db
    .update(supplier_scraper)
    .set({ config: withImageContainer(row.config, value), updated_at: new Date() })
    .where(eq(supplier_scraper.id, row.id));
  console.log("Updated. Only extraction.imageContainerIncludes changed.");
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error("FAILED, nothing changed:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
