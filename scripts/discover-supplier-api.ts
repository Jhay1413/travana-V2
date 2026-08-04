/**
 * Network-tab discovery for adding a new supplier scraper.
 *
 * Opens a URL through Browserless (or local Chrome) and records every
 * XHR/fetch response, then prints the JSON-returning endpoints — URL, method,
 * status, size, and a body snippet — so you can identify the deal/pricing API
 * (its path → apiPath, its origin → originPrefix) for the supplier config.
 *
 * This run is UNAUTHENTICATED. If the URL redirects to a login page, that tells
 * us the supplier needs credentials (added via .env or the settings store, not
 * here).
 *
 *   npx tsx --env-file-if-exists=.env scripts/discover-supplier-api.ts "<url>"
 */
import puppeteerExtra from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import type { Browser, HTTPResponse } from "puppeteer";

const puppeteer = puppeteerExtra as unknown as typeof import("puppeteer").default;
puppeteerExtra.use(StealthPlugin());

const URL_ARG = process.argv[2];
if (!URL_ARG) {
  console.error('Usage: tsx scripts/discover-supplier-api.ts "<url>"');
  process.exit(1);
}

// Endpoints whose name hints at deal/pricing data — highlighted in the output.
const INTEREST = /price|offer|search|quote|pricing|avail|holiday|package|deal|result|basket|book/i;

async function connectBrowser(): Promise<Browser> {
  const token = process.env.BROWSERLESS_TOKEN;
  if (token) {
    const base = process.env.BROWSERLESS_URL || "wss://production-lon.browserless.io";
    const path = process.env.BROWSERLESS_PATH || "/chromium/stealth";
    const params = new URLSearchParams({ token });
    if (process.env.BROWSERLESS_PROXY) {
      params.set("proxy", process.env.BROWSERLESS_PROXY);
      params.set("proxyCountry", process.env.BROWSERLESS_PROXY_COUNTRY || "gb");
      params.set("proxySticky", "true");
    }
    params.set("timeout", String(Number(process.env.BROWSERLESS_TIMEOUT) || 60000));
    console.log("Connecting via Browserless…");
    return puppeteer.connect({ browserWSEndpoint: `${base}${path}?${params.toString()}` });
  }
  console.log("Launching local Chrome…");
  return puppeteer.launch({ headless: true, args: ["--no-first-run"] }) as unknown as Browser;
}

interface Captured {
  url: string;
  method: string;
  status: number;
  ctype: string;
  bytes: number;
  snippet: string;
}

async function main(): Promise<void> {
  const browser = await connectBrowser();
  const page = (await browser.pages())[0] ?? (await browser.newPage());
  const captured: Captured[] = [];

  page.on("response", async (res: HTTPResponse) => {
    const ctype = res.headers()["content-type"] || "";
    const url = res.url();
    // Keep JSON responses and anything that looks like an API call.
    const looksApi = ctype.includes("json") || /\/api\/|\.json(\?|$)|graphql/i.test(url);
    if (!looksApi) return;
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* no body */
    }
    captured.push({
      url,
      method: res.request().method(),
      status: res.status(),
      ctype: ctype.split(";")[0],
      bytes: body.length,
      snippet: body.replace(/\s+/g, " ").slice(0, 160),
    });
  });

  console.log(`Navigating to:\n  ${URL_ARG}\n`);
  try {
    await page.goto(URL_ARG, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (e) {
    console.log("navigation note:", (e as Error).message.split("\n")[0]);
  }
  // Give client-side XHRs time to fire.
  await new Promise((r) => setTimeout(r, 12000));

  const finalUrl = page.url();
  const title = await page.title().catch(() => "");
  console.log(`Landed on: ${finalUrl}`);
  console.log(`Page title: ${title}`);
  console.log(`Login-gated: ${/login|signin|auth|identity/i.test(finalUrl) ? "LIKELY YES" : "no obvious redirect"}\n`);

  console.log(`Captured ${captured.length} JSON/API responses:\n`);
  for (const c of captured.sort((a, b) => b.bytes - a.bytes)) {
    const flag = INTEREST.test(c.url) ? " ★" : "";
    let path = c.url;
    try {
      const u = new URL(c.url);
      path = u.origin + u.pathname;
    } catch {
      /* keep raw */
    }
    console.log(`[${c.status}] ${c.method} ${path}  (${c.bytes}b)${flag}`);
    console.log(`      ${c.snippet}`);
  }

  await browser.close();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
