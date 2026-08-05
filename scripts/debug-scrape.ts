/**
 * Debug a single supplier scrape end-to-end using the credentials/config stored
 * in the DB — the exact path the /scrape endpoint uses. Prints the resulting
 * quote (or the error). NEVER prints credentials.
 *
 *   npx tsx --env-file-if-exists=.env scripts/debug-scrape.ts "<deal-url>" <org-uuid> [supplier-key]
 *
 * supplier-key defaults to matching a key/name containing "jet".
 */
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper } from "../shared/schema";
import { scraperService } from "../server/v2/modules/scraper/scraper.service";
import type { ScraperConfig } from "../server/v2/modules/scraper/scraper-engine.types";

async function main(): Promise<void> {
  const url = process.argv[2];
  const orgId = process.argv[3] || process.env.SCRAPER_SEED_ORG_ID;
  let key = process.argv[4];
  if (!url || !orgId) {
    console.error('Usage: tsx scripts/debug-scrape.ts "<deal-url>" <org-uuid> [supplier-key]');
    process.exit(1);
  }

  // Find the target row (by explicit key, else name/key containing "jet").
  const match = key
    ? eq(supplier_scraper.supplier_key, key)
    : or(ilike(supplier_scraper.supplier_key, "%jet%"), ilike(supplier_scraper.supplier_name, "%jet%"));
  const rows = await db
    .select()
    .from(supplier_scraper)
    .where(and(eq(supplier_scraper.org_id, orgId), match));

  if (rows.length === 0) {
    const all = await db.select().from(supplier_scraper).where(eq(supplier_scraper.org_id, orgId));
    console.error(
      `No matching scraper. Available for this org: ${all.map((r) => `${r.supplier_key} (${r.supplier_name})`).join(", ") || "(none)"}`,
    );
    process.exit(1);
  }
  if (rows.length > 1 && !key) {
    console.error(`Multiple matches — pass an explicit key: ${rows.map((r) => r.supplier_key).join(", ")}`);
    process.exit(1);
  }

  const row = rows[0];
  key = row.supplier_key;
  const cfg = (row.config as ScraperConfig) ?? ({} as ScraperConfig);
  console.log("── scraper row (no secrets) ──");
  console.log({
    supplier_key: row.supplier_key,
    supplier_name: row.supplier_name,
    adapter_type: row.adapter_type,
    is_active: row.is_active,
    hasCreds: !!row.encrypted_credentials,
    auth: cfg.auth
      ? {
          type: cfg.auth.type,
          loginUrl: cfg.auth.loginUrl,
          identityHost: cfg.auth.identityHost,
          usernameSelector: cfg.auth.usernameSelector,
          passwordSelector: cfg.auth.passwordSelector,
          abtaSelector: cfg.auth.abtaSelector,
          submitSelector: cfg.auth.submitSelector,
          formSelector: cfg.auth.formSelector,
        }
      : null,
    fetch: cfg.fetch,
    hasExtraction: !!cfg.extraction,
    hasPriceApi: !!cfg.priceApi,
  });

  console.log(`\n── scraping ${key} ──\n${url}\n`);
  const scope = { orgId, branchId: null, orgRole: "owner", userId: "debug-script" } as unknown as Parameters<
    typeof scraperService.scrapeFromUrl
  >[1];
  const started = Date.now();
  try {
    const result = await scraperService.scrapeFromUrl(url, scope, undefined, key);
    console.log(`\n✅ scrape ok in ${Math.round((Date.now() - started) / 1000)}s:\n`);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error(`\n❌ scrape failed in ${Math.round((Date.now() - started) / 1000)}s:`);
    console.error(err instanceof Error ? `${err.name}: ${err.message}` : err);
    process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
