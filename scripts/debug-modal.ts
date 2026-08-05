/**
 * Clicks the "Compare airport, dates & prices" control and dumps what the modal
 * reveals (times / airport names), so we can extract flight times. Raw column
 * read so it works pre-migration. Prints no secrets.
 *
 *   npx tsx --env-file-if-exists=.env scripts/debug-modal.ts "<url>" <org> <key> <out-file>
 */
import { sql } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { decrypt } from "../server/v2/utils/encryption";
import { buildContext } from "../server/v2/modules/scraper/adapters/dom.adapter";
import { scrapeViaDom } from "../server/v2/modules/easyjet/easyjet-browser";
import { writeFileSync } from "node:fs";
import type { ResolvedScraper, ScraperConfig, ScraperCredentials } from "../server/v2/modules/scraper/scraper-engine.types";

async function main(): Promise<void> {
  const [url, orgId, key, out] = process.argv.slice(2);
  if (!url || !orgId || !key || !out) {
    console.error('Usage: tsx scripts/debug-modal.ts "<url>" <org> <key> <out-file>');
    process.exit(1);
  }
  const r = await db.execute(
    sql`SELECT config, encrypted_credentials, supplier_name FROM supplier_scraper WHERE org_id = ${orgId} AND supplier_key = ${key} LIMIT 1`,
  );
  const row = (r as unknown as { rows?: Record<string, unknown>[] }).rows?.[0] ?? (r as unknown as Record<string, unknown>[])[0];
  const credentials = row.encrypted_credentials
    ? (JSON.parse(decrypt(row.encrypted_credentials as string)) as ScraperCredentials)
    : {};
  const resolved: ResolvedScraper = {
    supplierKey: key,
    supplierName: row.supplier_name as string,
    config: (row.config as ScraperConfig) ?? ({} as ScraperConfig),
    credentials,
  };
  const ctx = buildContext(resolved);

  const dump = await scrapeViaDom(url, ctx, async (page) => {
    await page.waitForFunction(() => /£\s?[\d,]{2,}/.test(document.body?.innerText || ""), { timeout: 30_000 }).catch(() => undefined);

    // Capture JSON/XHR responses fired while the modal opens.
    const responses: { url: string; snippet: string }[] = [];
    page.on("response", async (res) => {
      const u = res.url();
      const ct = res.headers()["content-type"] || "";
      if (!/json|api|flight|search/i.test(u + ct)) return;
      try {
        const body = await res.text();
        if (/\d{1,2}:\d{2}|flight|depart|arriv|airport/i.test(body)) responses.push({ url: u, snippet: body.slice(0, 1500) });
      } catch {
        /* ignore */
      }
    });

    const before = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    // Click the SMALLEST clickable whose own text is "Compare airport, dates…".
    const clicked = await page
      .evaluate(() => {
        const cands = Array.from(document.querySelectorAll<HTMLElement>("button, a, [role='button']")).filter(
          (e) => /compare\s+airport/i.test(e.textContent || "") && (e.textContent || "").trim().length < 80 && e.offsetParent !== null,
        );
        cands.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
        const el = cands[0];
        if (el) {
          el.click();
          return (el.tagName + ": " + (el.textContent || "").trim()).slice(0, 80);
        }
        return "";
      })
      .catch(() => "");
    await new Promise((res) => setTimeout(res, 5_000));
    const after = await page.evaluate(() => document.body?.innerText || "").catch(() => "");
    // Text of any VISIBLE dialog/modal.
    const modalText = await page
      .evaluate(() => {
        const sels = ["[role='dialog']", "[aria-modal='true']", ".modal", "[class*='modal']", "[class*='Modal']", "[class*='drawer']", "[class*='flyout']", "[class*='overlay']"];
        let best = "";
        for (const s of sels)
          document.querySelectorAll<HTMLElement>(s).forEach((m) => {
            if (m.offsetParent === null) return; // visible only
            const t = m.innerText || "";
            if (t.length > best.length) best = t;
          });
        return best;
      })
      .catch(() => "");
    return { clicked, beforeLen: before.length, afterLen: after.length, addedText: after.slice(before.length), modalText, responses };
  });

  writeFileSync(out, JSON.stringify(dump, null, 2), "utf-8");
  console.log("clicked control:", JSON.stringify(dump.clicked));
  console.log("before/after innerText length:", dump.beforeLen, "->", dump.afterLen);
  console.log("modal text length:", dump.modalText.length);
  console.log("wrote", out);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
