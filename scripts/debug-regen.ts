/**
 * Regenerates a supplier's extraction spec from the live page via the AI (the
 * self-configuring path) so it picks up newly-supported spec fields
 * (flightModalTrigger, imageUrlIncludes, image field rules) — proving nothing is
 * hardcoded per-supplier in code. Dry-run by default: prints the generated spec
 * and a test quote. Pass --write to persist it back to config.extraction.
 *
 *   npx tsx --env-file-if-exists=.env scripts/debug-regen.ts "<url>" <org> <key> [--write]
 */
import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { decrypt } from "../server/v2/utils/encryption";
import { buildContext } from "../server/v2/modules/scraper/adapters/dom.adapter";
import { scrapeViaDom, captureRenderedDom, captureFlightModal } from "../server/v2/modules/easyjet/easyjet-browser";
import { extractionAiService } from "../server/v2/modules/scraper/extraction/extraction-ai.service";
import { runExtractionSpec } from "../server/v2/modules/scraper/extraction/extraction.interpreter";
import type { ResolvedScraper, ScraperConfig, ScraperCredentials } from "../server/v2/modules/scraper/scraper-engine.types";

async function main(): Promise<void> {
  const url = process.argv[2];
  const orgId = process.argv[3];
  const key = process.argv[4];
  const write = process.argv.includes("--write");
  if (!url || !orgId || !key) {
    console.error('Usage: tsx scripts/debug-regen.ts "<url>" <org> <key> [--write]');
    process.exit(1);
  }
  const res = await db.execute(
    sql`SELECT config, encrypted_credentials, supplier_name FROM supplier_scraper WHERE org_id = ${orgId} AND supplier_key = ${key} LIMIT 1`,
  );
  const row = (res as unknown as { rows?: Record<string, unknown>[] }).rows?.[0] ?? (res as unknown as Record<string, unknown>[])[0];
  const config = (row.config as ScraperConfig) ?? ({} as ScraperConfig);
  const credentials = row.encrypted_credentials
    ? (JSON.parse(decrypt(row.encrypted_credentials as string)) as ScraperCredentials)
    : {};
  const resolved: ResolvedScraper = { supplierKey: key, supplierName: row.supplier_name as string, config, credentials };
  const ctx = buildContext(resolved);

  const result = await scrapeViaDom(url, ctx, async (page) => {
    const snap = await captureRenderedDom(page, "£\\s?[\\d,]{2,}", 30_000);
    const spec = await extractionAiService.generateSpecFromDom(
      { title: snap.title, text: snap.text, url, apiJson: null },
      resolved.supplierName,
    );
    const flightsText = await captureFlightModal(page, spec.flightModalTrigger);
    const quote = runExtractionSpec(
      spec,
      { title: snap.title, text: snap.text, url, apiJson: null, images: snap.images, flightsText },
      new Date().toISOString(),
    );
    return { spec, quote, modalOpened: flightsText.length > 0 };
  });

  console.log("── generated spec (meta) ──");
  console.log({
    flightModalTrigger: result.spec.flightModalTrigger,
    imageUrlIncludes: result.spec.imageUrlIncludes,
    fields: Object.keys(result.spec.fields || {}),
    modalOpened: result.modalOpened,
  });
  const q = result.quote;
  console.log("\n── test quote ──");
  console.log({
    accommodation: q.accommodation,
    sales_price: q.sales_price,
    price_per_person: q.price_per_person,
    board_basis: q.board_basis,
    room_type: q.room_type,
    travel_date: q.travel_date,
    no_of_nights: q.no_of_nights,
    star_rating: q.star_rating,
    transfer_type: q.transfer_type,
    hotel_images: q.hotel_images.length,
    flights: q.flights.map((f) => `${f.flight_type}: ${f.departing_airport_name}(${f.departing_airport}) ${f.departure_date_time} -> ${f.arrival_airport_name}(${f.arrival_airport}) ${f.arrival_date_time}`),
  });

  if (write) {
    const nextConfig: ScraperConfig = { ...config, extraction: result.spec };
    await db.execute(
      sql`UPDATE supplier_scraper SET config = ${JSON.stringify(nextConfig)}::jsonb, updated_at = now() WHERE org_id = ${orgId} AND supplier_key = ${key}`,
    );
    console.log("\n✅ persisted regenerated spec to config.extraction");
  } else {
    console.log("\n(dry-run — pass --write to persist this spec)");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
