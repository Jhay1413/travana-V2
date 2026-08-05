/**
 * Authenticated network-tab discovery for a stored supplier scraper.
 *
 * Loads a supplier_scraper row (config + decrypted credentials) from the DB,
 * navigates to a deal URL — logging in through the configured form if the site
 * redirects there — and prints every JSON/API response captured, so we can find
 * the pricing endpoint (apiPath) for building the adapter.
 *
 * READ-ONLY: it only reads the DB row; it never writes.
 *
 *   npx tsx --env-file-if-exists=.env scripts/discover-supplier-authed.ts "<dealUrl>" [supplierKey] [orgId]
 */
import fs from "node:fs";
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { eq } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper } from "../shared/schema";
import { decrypt } from "../server/v2/utils/encryption";

const puppeteer = puppeteerExtra as unknown as typeof import("puppeteer").default;
puppeteerExtra.use(StealthPlugin());

const DEAL_URL = process.argv[2];
const SUPPLIER_KEY = process.argv[3] || "jet2";
const ORG_ID = process.argv[4] || process.env.SCRAPER_SEED_ORG_ID;

const INTEREST = /price|offer|search|quote|pricing|avail|holiday|package|deal|result|basket|book|room|hotel/i;

async function main(): Promise<void> {
  if (!DEAL_URL) {
    console.error('Usage: tsx scripts/discover-supplier-authed.ts "<dealUrl>" [supplierKey] [orgId]');
    process.exit(1);
  }

  let rows = await db.select().from(supplier_scraper).where(eq(supplier_scraper.supplier_key, SUPPLIER_KEY));
  if (ORG_ID) rows = rows.filter((r) => r.org_id === ORG_ID);
  const row = rows.find((r) => r.encrypted_credentials) ?? rows[0];
  if (!row) {
    console.error(`No supplier_scraper row found for key "${SUPPLIER_KEY}"${ORG_ID ? ` in org ${ORG_ID}` : ""}.`);
    process.exit(1);
  }

  const creds = row.encrypted_credentials
    ? (JSON.parse(decrypt(row.encrypted_credentials)) as { username?: string; password?: string; abtaNumber?: string })
    : {};
  const config = (row.config ?? {}) as any;
  const auth = config.auth ?? {};
  const b = config.browser ?? {};
  console.log(`Row org: ${row.org_id} | key: ${row.supplier_key}`);
  console.log(`Credentials present -> username: ${!!creds.username}, password: ${!!creds.password}, abta: ${!!creds.abtaNumber}\n`);

  const token = process.env.BROWSERLESS_TOKEN;
  if (!token) {
    console.error("BROWSERLESS_TOKEN not set.");
    process.exit(1);
  }
  const params = new URLSearchParams({ token });
  if (b.proxy) {
    params.set("proxy", b.proxy);
    params.set("proxyCountry", b.proxyCountry || "gb");
    params.set("proxySticky", "true");
  }
  params.set("timeout", String(b.sessionTimeoutMs || 60000));
  const ep = `${process.env.BROWSERLESS_URL || "wss://production-lon.browserless.io"}${b.browserlessPath || "/chromium/stealth"}?${params.toString()}`;

  console.log("Connecting via Browserless…");
  const browser = await puppeteer.connect({ browserWSEndpoint: ep });
  const page = (await browser.pages())[0] ?? (await browser.newPage());

  const captured: { url: string; method: string; status: number; bytes: number; body: string }[] = [];
  page.on("response", async (res) => {
    const ct = res.headers()["content-type"] || "";
    const url = res.url();
    if (!(ct.includes("json") || /\/api\/|\.json|graphql/i.test(url))) return;
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* no body */
    }
    captured.push({ url, method: res.request().method(), status: res.status(), bytes: body.length, body });
  });

  // Navigate straight to the deal — the site redirects to the login form, we
  // fill it, and the post-login redirect returns to the deal (which fires the
  // pricing API we want to capture).
  // Navigate to the deal (redirects to the login form). Don't wait for the
  // load event — the SPA keeps connections open so it never fires; proceed as
  // soon as the login field is present, to save the 60s session budget.
  console.log("Navigating to deal URL (expect a login redirect)…");
  await page.goto(DEAL_URL, { waitUntil: "domcontentloaded", timeout: 8000 }).catch(() => {});

  const onLogin = await page.waitForSelector(auth.abtaSelector, { timeout: 12000 }).then(() => true).catch(() => false);
  if (onLogin) {
    console.log("Login form present — filling ABTA / username / password…");
    if (auth.abtaSelector && creds.abtaNumber) await page.type(auth.abtaSelector, creds.abtaNumber, { delay: 30 }).catch(() => {});
    if (auth.usernameSelector && creds.username) await page.type(auth.usernameSelector, creds.username, { delay: 30 }).catch(() => {});
    if (auth.passwordSelector && creds.password) await page.type(auth.passwordSelector, creds.password, { delay: 30 }).catch(() => {});
    const handles = await page.$$(auth.submitSelector);
    await Promise.all([
      page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {}),
      (async () => {
        for (const h of handles) {
          const box = await h.boundingBox();
          if (box) { await h.click(); return; }
        }
        await page.keyboard.press("Enter");
      })(),
    ]);
    console.log("After login, url:", page.url());
  } else {
    console.log("No login form seen. url:", page.url());
  }
  console.log("Login-gated?", /tslogin|login|signin/i.test(page.url()) ? "YES" : "no");

  // Wait for a £ price to render into the deal page (the total). waitForFunction
  // resolves the instant it appears, so we don't blow the budget on a blind wait.
  console.log("Waiting for a £ price to render in the DOM…");
  const rendered = await page
    .waitForFunction(() => /£\s?[\d,]{2,}/.test(document.body?.innerText || ""), { timeout: 30000, polling: 1000 })
    .then(() => true)
    .catch(() => false);

  const dom = await page
    .evaluate(() => {
      const text = document.body?.innerText || "";
      const prices = Array.from(text.matchAll(/£\s?[\d,]+(?:\.\d{2})?/g)).map((m) => m[0]);
      // Every element whose OWN text mentions £, with a stable-ish selector, so
      // we can pin down which node holds the total / per-person price.
      const priceEls = Array.from(document.querySelectorAll("*"))
        .filter((el) => {
          const own = Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent).join("");
          return /£\s?[\d,]/.test(own);
        })
        .slice(0, 40)
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          cls: (el.getAttribute("class") || "").slice(0, 80),
          id: el.id || "",
          text: (el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
        }));
      return {
        title: document.title,
        bodyLen: text.length,
        prices: Array.from(new Set(prices)).slice(0, 25),
        fullText: text,
        priceEls,
      };
    })
    .catch(() => ({ title: "", bodyLen: 0, prices: [] as string[], fullText: "", priceEls: [] as unknown[] }));
  console.log("Price rendered:", rendered);
  console.log("DOM title:", dom.title || "(empty)");
  console.log("DOM £ prices:", dom.prices.join(", ") || "(none)");

  const domFile = (process.env.DISCOVER_OUT || "./jet2-capture.json").replace(/\.json$/, "-dom.json");
  fs.writeFileSync(domFile, JSON.stringify({ title: dom.title, prices: dom.prices, priceEls: dom.priceEls, fullText: dom.fullText }, null, 2));
  console.log(`Saved DOM dump to ${domFile}`);
  console.log("");

  // Persist full bodies for offline inspection.
  const outFile = process.env.DISCOVER_OUT || "./jet2-capture.json";
  fs.writeFileSync(outFile, JSON.stringify(captured, null, 2));
  console.log(`\nSaved ${captured.length} responses (full bodies) to ${outFile}\n`);

  // Print only the supplier's own API endpoints (drop analytics / bot sensor /
  // 3rd-party / empty), deduped by path, largest first.
  const seen = new Set<string>();
  const own = captured
    .filter((c) => /jet2holidays\.com\/(client\/)?api\//i.test(c.url) && c.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  console.log("Jet2 API endpoints captured:\n");
  for (const c of own) {
    let p = c.url;
    try {
      const u = new URL(c.url);
      p = u.origin + u.pathname;
    } catch {
      /* keep raw */
    }
    if (seen.has(p)) continue;
    seen.add(p);
    console.log(`[${c.status}] ${c.method} ${p}  (${c.bytes}b)${INTEREST.test(c.url) ? " ★" : ""}`);
    console.log(`      ${c.body.replace(/\s+/g, " ").slice(0, 220)}\n`);
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
