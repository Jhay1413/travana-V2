/**
 * Seed the platform-wide supplier scraper configs.
 *
 * Source of truth: scripts/seed-data/supplier-scrapers.ts — deepLink patterns
 * and extraction specs exported from a working database. These describe how to
 * READ each portal, which is the same everywhere, so the table is NOT org-scoped
 * and one seed serves the whole platform.
 *
 * Credentials are never seeded. Trade-portal logins belong to a specific agency
 * and must not travel between environments; the capture flow doesn't use them.
 *
 * Idempotent. A supplier_key that already exists is SKIPPED by default, so
 * re-running never clobbers a spec someone has fixed by hand. Pass --overwrite
 * to replace existing configs with the seed's.
 *
 * Usage:
 *   npm run db:seed-supplier-scrapers                # insert missing only
 *   npm run db:seed-supplier-scrapers -- --overwrite # replace existing too
 *   npm run db:seed-supplier-scrapers -- --dry-run   # show the plan, write nothing
 *
 * To refresh the seed data from a database you've curated:
 *   select supplier_key, supplier_name, adapter_type, is_active, config
 *     from supplier_scraper order by supplier_key;
 * then write those rows into scripts/seed-data/supplier-scrapers.ts.
 */
import { eq } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper } from "../shared/schema";
import { supplierScraperSeed } from "./seed-data/supplier-scrapers";

const OVERWRITE = process.argv.includes("--overwrite");
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const existing = await db
    .select({ id: supplier_scraper.id, supplier_key: supplier_scraper.supplier_key })
    .from(supplier_scraper);
  const byKey = new Map(existing.map((r) => [r.supplier_key, r.id]));

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const s of supplierScraperSeed) {
    const rules = Object.keys((s.config as { extraction?: { fields?: object } })?.extraction?.fields ?? {}).length;
    const current = byKey.get(s.supplierKey);

    if (current && !OVERWRITE) {
      console.log(`  skip     ${s.supplierKey.padEnd(16)} already present`);
      skipped++;
      continue;
    }

    if (current) {
      console.log(`  overwrite ${s.supplierKey.padEnd(15)} ${rules} field rules`);
      if (!DRY_RUN) {
        await db
          .update(supplier_scraper)
          .set({
            supplier_name: s.supplierName,
            adapter_type: s.adapterType,
            is_active: s.isActive,
            config: s.config,
            updated_at: new Date(),
          })
          .where(eq(supplier_scraper.id, current));
      }
      updated++;
      continue;
    }

    console.log(`  insert   ${s.supplierKey.padEnd(16)} ${rules} field rules`);
    if (!DRY_RUN) {
      await db.insert(supplier_scraper).values({
        supplier_key: s.supplierKey,
        supplier_name: s.supplierName,
        adapter_type: s.adapterType,
        is_active: s.isActive,
        config: s.config,
        // No credentials, by design — see the header.
        encrypted_credentials: null,
      });
    }
    inserted++;
  }

  console.log(
    `\n${DRY_RUN ? "[dry run] " : ""}${inserted} inserted, ${updated} overwritten, ${skipped} skipped.`,
  );
  if (skipped > 0 && !OVERWRITE) {
    console.log("Re-run with --overwrite to replace the existing configs.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
