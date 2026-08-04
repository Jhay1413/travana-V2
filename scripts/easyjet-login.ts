// One-time (and recovery) manual login for the easyJet trade-portal scraper.
//
//   npx tsx scripts/easyjet-login.ts
//
// Opens a visible Chrome using the SAME persistent profile the server's
// scraper uses (.easyjet-session by default). Log in by hand — including any
// captcha/MFA the automated flow can't handle — then press Enter here. Every
// scrape afterwards reuses this session; re-run only when the server responds
// with "run scripts/easyjet-login.ts".
//
// IMPORTANT: stop the dev server first — Chrome allows only one process per
// profile directory.
import path from 'node:path';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

// Same stealth fingerprint the server uses, so the manually-earned session
// stays valid when the automated scraper reuses it.
const puppeteer = puppeteerExtra as unknown as typeof import('puppeteer').default;
puppeteerExtra.use(StealthPlugin());

const TRADE_PORTAL_URL = 'https://www.easyjet.com/en/holidays/trade-portal';
const USER_DATA_DIR =
  process.env.EASYJET_USER_DATA_DIR || path.resolve(process.cwd(), '.easyjet-session');

async function main(): Promise<void> {
  console.log(`Opening browser with profile: ${USER_DATA_DIR}`);
  // Same launch strategy as the server's scraper (easyjet-browser.ts): real
  // Chrome when installed, bundled Chromium as fallback. The session must be
  // earned by the same browser that will reuse it — Akamai's cookies are
  // fingerprint-bound.
  const options = {
    headless: false,
    userDataDir: USER_DATA_DIR,
    defaultViewport: null,
    args: ['--start-maximized', '--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
  };
  const chromePath = process.env.EASYJET_CHROME_PATH;
  const browser = chromePath
    ? await puppeteer.launch({ ...options, executablePath: chromePath })
    : await puppeteer.launch({ ...options, channel: 'chrome' }).catch(() => puppeteer.launch(options));

  const [page] = await browser.pages();
  await page.goto(TRADE_PORTAL_URL, { waitUntil: 'domcontentloaded' });

  console.log('\nLog in to the trade portal in the browser window.');
  console.log('When you can see the logged-in portal, come back here and press Enter...');

  await new Promise<void>((resolve) => {
    process.stdin.resume();
    process.stdin.once('data', () => resolve());
  });

  await browser.close();
  console.log('Session saved. The scraper will now reuse it.');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
