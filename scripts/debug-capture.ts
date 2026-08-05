/**
 * Log in to a supplier and DUMP the rendered page's raw artifacts (innerText,
 * <img> list, any embedded JSON like __NEXT_DATA__ / JSON-LD) to a file, so we
 * can design extraction rules against the real DOM. Read-only; prints no secrets.
 *
 * Uses a RAW column select (config + encrypted_credentials only) so it works even
 * before the session_state migration is applied.
 *
 *   npx tsx --env-file-if-exists=.env scripts/debug-capture.ts "<deal-url>" <org-uuid> <supplier-key> <out-file>
 */
import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { decrypt } from "../server/v2/utils/encryption";
import { buildContext } from "../server/v2/modules/scraper/adapters/dom.adapter";
import { scrapeViaDom } from "../server/v2/modules/easyjet/easyjet-browser";
import { writeFileSync } from "node:fs";
import type { ResolvedScraper, ScraperConfig, ScraperCredentials } from "../server/v2/modules/scraper/scraper-engine.types";

async function main(): Promise<void> {
  const url = process.argv[2];
  const orgId = process.argv[3];
  const key = process.argv[4];
  const out = process.argv[5];
  if (!url || !orgId || !key || !out) {
    console.error('Usage: tsx scripts/debug-capture.ts "<url>" <org-uuid> <supplier-key> <out-file>');
    process.exit(1);
  }

  const res = await db.execute(
    sql`SELECT config, encrypted_credentials, supplier_name, supplier_key FROM supplier_scraper WHERE org_id = ${orgId} AND supplier_key = ${key} LIMIT 1`,
  );
  const row = (res as unknown as { rows?: Record<string, unknown>[] }).rows?.[0] ?? (res as unknown as Record<string, unknown>[])[0];
  if (!row) {
    console.error("no scraper row found");
    process.exit(1);
  }
  const credentials = row.encrypted_credentials
    ? (JSON.parse(decrypt(row.encrypted_credentials as string)) as ScraperCredentials)
    : {};
  const resolved: ResolvedScraper = {
    supplierKey: row.supplier_key as string,
    supplierName: row.supplier_name as string,
    config: (row.config as ScraperConfig) ?? ({} as ScraperConfig),
    credentials,
  };
  const ctx = buildContext(resolved);

  const dump = await scrapeViaDom(url, ctx, async (page) => {
    const innerText = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    const imgs = await page
      .$$eval("img", (els) =>
        els
          .map((e) => ({ src: (e as HTMLImageElement).currentSrc || (e as HTMLImageElement).src, alt: (e as HTMLImageElement).alt, w: (e as HTMLImageElement).naturalWidth, h: (e as HTMLImageElement).naturalHeight }))
          .filter((i) => i.src && !i.src.startsWith("data:")),
      )
      .catch(() => [] as unknown[]);
    // Any big background-image URLs too (galleries often use them).
    const bgImgs = await page
      .evaluate(() => {
        const urls = new Set<string>();
        document.querySelectorAll<HTMLElement>("*").forEach((el) => {
          const bg = getComputedStyle(el).backgroundImage;
          const m = bg && bg.match(/url\((['"]?)(.*?)\1\)/);
          if (m && m[2] && !m[2].startsWith("data:")) urls.add(m[2]);
        });
        return [...urls].slice(0, 60);
      })
      .catch(() => [] as string[]);
    const nextData = await page.evaluate(() => document.getElementById("__NEXT_DATA__")?.textContent || "").catch(() => "");
    const jsonLd = await page
      .$$eval('script[type="application/ld+json"]', (els) => els.map((e) => e.textContent || ""))
      .catch(() => [] as string[]);
    const title = await page.evaluate(() => document.title).catch(() => "");
    return { title, innerText, imgs, bgImgs, nextData, jsonLd };
  });

  writeFileSync(out, JSON.stringify(dump, null, 2), "utf-8");
  console.log(`wrote ${out}`);
  console.log("title:", dump.title);
  console.log("innerText length:", dump.innerText.length);
  console.log("img count:", dump.imgs.length, "| bgImg count:", dump.bgImgs.length);
  console.log("__NEXT_DATA__ length:", dump.nextData.length, "| json-ld blocks:", dump.jsonLd.length);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
