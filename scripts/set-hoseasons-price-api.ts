/**
 * Add the price-API config to an existing Hoseasons supplier_scraper row.
 *
 * Hoseasons prices a lodge through an authed JSON endpoint
 * (HoseasonsRequestHandler.ashx) keyed by a numeric WebsiteID that lives on the
 * property page — not in the deal URL. This patches the row's `config` JSONB to
 * turn on the price-API path (server/v2/modules/scraper/adapters/price-api.ts):
 * after login the scraper opens the param-less property page, discovers the
 * WebsiteID, fires the AJAX with the deal's dates, and reads the price.
 *
 * It ONLY merges config.priceApi (and ensures config.fetch.apiPath so the page's
 * own AJAX is intercepted). Credentials and auth selectors are left untouched.
 *
 * Idempotent. Run with the app's DB reachable:
 *
 *   npx tsx --env-file-if-exists=.env scripts/set-hoseasons-price-api.ts <org-uuid> [supplier-key]
 *
 * supplier-key defaults to matching a key/name containing "hoseasons".
 */
import { and, eq, ilike, or } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper } from "../shared/schema";
import type { PriceApiConfig, ScraperConfig } from "../server/v2/modules/scraper/scraper-engine.types";

const PRICE_API: PriceApiConfig = {
  apiPathMatch: "HoseasonsRequestHandler.ashx",
  idParam: "WebsiteID",
  urlTemplate:
    "/HoseasonsRequestHandler.ashx?method=SERVICE-RESULT-AJAX&start={start}&range=28&nights={nights}&adult={adult}&child={child}&infant={infant}&pets={pets}&AccInfo=true&WebsiteID={websiteId}&BookingPageName=booking",
  currency: "GBP",
};

async function main(): Promise<void> {
  const orgId = process.argv[2] || process.env.SCRAPER_SEED_ORG_ID;
  const key = process.argv[3];
  if (!orgId) {
    console.error("Usage: tsx scripts/set-hoseasons-price-api.ts <org-uuid> [supplier-key]");
    process.exit(1);
  }

  const match = key
    ? eq(supplier_scraper.supplier_key, key)
    : or(ilike(supplier_scraper.supplier_key, "%hoseasons%"), ilike(supplier_scraper.supplier_name, "%hoseasons%"));

  const rows = await db
    .select()
    .from(supplier_scraper)
    .where(and(eq(supplier_scraper.org_id, orgId), match));

  if (rows.length === 0) {
    console.error(`No Hoseasons supplier_scraper row found for org ${orgId}.`);
    process.exit(1);
  }
  if (rows.length > 1) {
    console.error(
      `Found ${rows.length} matching rows — pass an explicit supplier-key. Candidates: ${rows
        .map((r) => r.supplier_key)
        .join(", ")}`,
    );
    process.exit(1);
  }

  const row = rows[0];
  const existing = (row.config ?? {}) as Partial<ScraperConfig>;
  const nextConfig: ScraperConfig = {
    ...(existing as ScraperConfig),
    fetch: {
      strategy: existing.fetch?.strategy ?? "intercept",
      apiPath: existing.fetch?.apiPath || "HoseasonsRequestHandler.ashx",
      originPrefix: existing.fetch?.originPrefix ?? "",
    },
    priceApi: PRICE_API,
  };

  await db
    .update(supplier_scraper)
    .set({ config: nextConfig, updated_at: new Date() })
    .where(eq(supplier_scraper.id, row.id));

  console.log(`Patched price-API config into "${row.supplier_name}" (key=${row.supplier_key}) for org ${orgId}.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
