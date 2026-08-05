/**
 * Runs the REAL DOM extraction (captureRenderedDom + runExtractionSpec, incl. the
 * new image + destination-airport logic) against a live supplier page, using a
 * RAW column read so it works before the session_state migration is applied.
 * Prints the resulting quote. No secrets printed.
 *
 *   npx tsx --env-file-if-exists=.env scripts/debug-extract.ts "<deal-url>" <org-uuid> <supplier-key>
 */
import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { decrypt } from "../server/v2/utils/encryption";
import { buildContext } from "../server/v2/modules/scraper/adapters/dom.adapter";
import { scrapeViaDom, captureRenderedDom, captureFlightModal } from "../server/v2/modules/easyjet/easyjet-browser";
import { runExtractionSpec } from "../server/v2/modules/scraper/extraction/extraction.interpreter";
import type { ResolvedScraper, ScraperConfig, ScraperCredentials } from "../server/v2/modules/scraper/scraper-engine.types";

async function main(): Promise<void> {
  const url = process.argv[2];
  const orgId = process.argv[3];
  const key = process.argv[4];
  if (!url || !orgId || !key) {
    console.error('Usage: tsx scripts/debug-extract.ts "<url>" <org-uuid> <supplier-key>');
    process.exit(1);
  }

  const res = await db.execute(
    sql`SELECT config, encrypted_credentials, supplier_name, supplier_key FROM supplier_scraper WHERE org_id = ${orgId} AND supplier_key = ${key} LIMIT 1`,
  );
  const row = (res as unknown as { rows?: Record<string, unknown>[] }).rows?.[0] ?? (res as unknown as Record<string, unknown>[])[0];
  if (!row) {
    console.error("no scraper row");
    process.exit(1);
  }
  const config = (row.config as ScraperConfig) ?? ({} as ScraperConfig);
  const credentials = row.encrypted_credentials
    ? (JSON.parse(decrypt(row.encrypted_credentials as string)) as ScraperCredentials)
    : {};
  const resolved: ResolvedScraper = { supplierKey: key, supplierName: row.supplier_name as string, config, credentials };
  const ctx = buildContext(resolved);

  const spec = config.extraction;
  if (!spec) {
    console.error("this supplier has no stored extraction spec — nothing to run");
    process.exit(1);
  }
  const waitRe = spec.wait?.textMatches ?? "£\\s?[\\d,]{2,}";
  const waitMs = spec.wait?.timeoutMs ?? 30_000;

  const quote = await scrapeViaDom(url, ctx, async (page) => {
    const snap = await captureRenderedDom(page, waitRe, waitMs);
    const flightsText = await captureFlightModal(page);
    return runExtractionSpec(
      spec,
      { title: snap.title, text: snap.text, url, apiJson: null, images: snap.images, flightsText },
      new Date().toISOString(),
    );
  });

  console.log("\n── quote (image + flight focus) ──");
  console.log({
    accommodation: quote.accommodation,
    sales_price: quote.sales_price,
    hotel_images_count: quote.hotel_images.length,
    hotel_images_sample: quote.hotel_images.slice(0, 4),
    flights: quote.flights,
  });
  console.log("\n── full ──\n" + JSON.stringify(quote, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
