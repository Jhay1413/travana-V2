import type { Browser, Page, HTTPResponse } from 'puppeteer';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { AppError } from '../../utils/error-handler';
import type { EasyJetScrapeContext } from './easyjet.context';

// ─── Config-driven Puppeteer worker for easyJet-shaped trade portals ─────────
//
// Everything supplier-specific (credentials, browser/proxy, login selectors,
// API path) arrives in an EasyJetScrapeContext, so one worker serves any org's
// stored config. It drives the page directly (navigate + intercept, with an
// in-page fetch fallback) because Akamai's bot cookie is only valid for the
// page's own requests.
//
// Backends:
//   • browserless — remote cloud Chrome + residential proxy (defeats Akamai);
//     ephemeral, so login runs each session and we reconnect fresh per scrape.
//   • local — Chrome with a persistent profile (userDataDir); the on-disk
//     session survives across scrapes so login is usually skipped.

// puppeteer-extra wraps puppeteer; the stealth plugin applies ~15 evasions
// (navigator.webdriver, UA, plugins, WebGL, …) to every page automatically.
const puppeteer = puppeteerExtra as unknown as typeof import('puppeteer').default;
puppeteerExtra.use(StealthPlugin());

const CONNECT_TIMEOUT_MS = 15_000;
const INTERCEPT_WAIT_MS = 8_000;

// Derived timeouts for a given context. Under Browserless the whole session is
// capped, so keep individual waits well under it; locally there's no cap.
function timeoutsFor(ctx: EasyJetScrapeContext) {
  const isBrowserless = ctx.browser.backend === 'browserless';
  const session = ctx.browser.sessionTimeoutMs || 60_000;
  return {
    isBrowserless,
    nav: isBrowserless ? Math.min(25_000, session - 5_000) : 45_000,
    maxAttempts: isBrowserless ? 2 : 1,
    // Hard ceiling so a dead/stalled session can never hang the HTTP request.
    deadline: isBrowserless ? Math.min(115_000, session * 2 - 5_000) : 120_000,
  };
}

function browserlessEndpoint(b: EasyJetScrapeContext['browser']): string {
  const params = new URLSearchParams({ token: b.browserlessToken as string });
  if (b.proxy) {
    params.set('proxy', b.proxy);
    if (b.proxyCountry) params.set('proxyCountry', b.proxyCountry);
    // Same egress IP for the whole session so login + scrape look continuous.
    params.set('proxySticky', 'true');
  }
  params.set('timeout', String(b.sessionTimeoutMs || 60_000));
  return `${b.browserlessBase}${b.browserlessPath || '/chromium/stealth'}?${params.toString()}`;
}

// puppeteer.connect has no built-in timeout; bound it so a slow cloud connect
// rejects and can be retried instead of hanging.
function connectWithTimeout(ctx: EasyJetScrapeContext, ms: number): Promise<Browser> {
  return new Promise<Browser>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new AppError(`Browserless connect timed out after ${Math.round(ms / 1000)}s`, 504));
    }, ms);
    puppeteer
      .connect({ browserWSEndpoint: browserlessEndpoint(ctx.browser), defaultViewport: { width: 1366, height: 900 } })
      .then(
        (b) => {
          clearTimeout(timer);
          if (settled) void b.close().catch(() => undefined); // arrived late — drop it
          else resolve(b);
        },
        (e) => {
          clearTimeout(timer);
          if (!settled) reject(e);
        },
      );
  });
}

async function launchBrowser(ctx: EasyJetScrapeContext): Promise<Browser> {
  const b = ctx.browser;
  if (b.backend === 'browserless') {
    if (!b.browserlessToken) throw new AppError('Browserless backend selected but no token configured', 500);
    return connectWithTimeout(ctx, CONNECT_TIMEOUT_MS);
  }

  const options = {
    headless: b.headless !== false,
    userDataDir: b.userDataDir,
    defaultViewport: { width: 1366, height: 900 },
    args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
  };
  if (b.chromePath) return puppeteer.launch({ ...options, executablePath: b.chromePath });
  try {
    return await puppeteer.launch({ ...options, channel: 'chrome' });
  } catch {
    return puppeteer.launch(options); // bundled Chromium fallback
  }
}

function isOnLoginPage(page: Page, ctx: EasyJetScrapeContext): boolean {
  return page.url().includes(ctx.auth.identityHost);
}

async function submitLogin(page: Page, ctx: EasyJetScrapeContext, navTimeout: number): Promise<void> {
  const { username, password } = ctx.credentials;
  if (!username || !password) {
    throw new AppError('Supplier login required but no username/password is configured for this supplier.', 503);
  }
  const { usernameSelector, passwordSelector, submitSelector, errorSelector } = ctx.auth;

  await page.type(usernameSelector, username, { delay: 40 });
  await page.type(passwordSelector, password, { delay: 40 });
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: navTimeout }),
    page.click(submitSelector),
  ]);

  if (isOnLoginPage(page, ctx)) {
    const message = errorSelector
      ? await page.$eval(errorSelector, (el) => (el.textContent || '').trim()).catch(() => 'login rejected')
      : 'still on the login page after submitting credentials';
    throw new AppError(`Supplier login failed: ${message}`, 502);
  }
}

async function ensureLoggedIn(page: Page, ctx: EasyJetScrapeContext, navTimeout: number): Promise<void> {
  // domcontentloaded (not networkidle2): the SPA keeps background requests open,
  // so networkidle can hang until timeout — wasteful under a session cap.
  await page.goto(ctx.auth.loginUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout });

  if (isOnLoginPage(page, ctx)) {
    // The login page may render a form, or (SSO cookie valid) bounce straight
    // back through the OAuth callback without one.
    const form = await page.waitForSelector(ctx.auth.formSelector, { timeout: 8_000 }).catch(() => null);
    if (form) {
      await submitLogin(page, ctx, navTimeout);
    } else if (isOnLoginPage(page, ctx)) {
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: navTimeout }).catch(() => undefined);
    }
  }

  if (isOnLoginPage(page, ctx)) {
    throw new AppError('Supplier login did not complete (stuck on the identity page)', 502);
  }
}

// Primary: navigate to the hotel page and capture the page's own offers API
// response — it carries a validated Akamai cookie and every header the SPA
// sends, so the bot manager accepts it.
async function captureOffersFromPage(
  page: Page,
  deepLinkUrl: string,
  ctx: EasyJetScrapeContext,
  navTimeout: number,
): Promise<unknown | null> {
  let resolveJson: (v: unknown | null) => void;
  const captured = new Promise<unknown | null>((resolve) => {
    resolveJson = resolve;
  });

  const onResponse = async (res: HTTPResponse) => {
    if (!res.url().includes(ctx.fetch.apiPath)) return;
    if (res.status() < 200 || res.status() >= 300) return;
    try {
      resolveJson(await res.json());
    } catch {
      /* not JSON — let the timeout handle it */
    }
  };
  page.on('response', onResponse);

  try {
    await page.goto(deepLinkUrl, { waitUntil: 'domcontentloaded', timeout: navTimeout }).catch(() => undefined);
    // Short window for the SPA to fire its own call; cold deep-link loads often
    // don't, so return quickly and let the in-page fetch fallback run (it
    // succeeds because navigating here warmed the Akamai cookies).
    const shortWait = new Promise<null>((resolve) => setTimeout(() => resolve(null), INTERCEPT_WAIT_MS));
    return await Promise.race([captured, shortWait]);
  } finally {
    page.off('response', onResponse);
  }
}

// Fallback: fire the API call from inside the page context.
async function fetchFromPage(page: Page, url: string): Promise<{ status: number; body: string }> {
  return page.evaluate(async (target: string) => {
    const res = await fetch(target, { credentials: 'include', headers: { Accept: 'application/json' } });
    return { status: res.status, body: await res.text() };
  }, url);
}

// Scrapes run strictly sequentially: trade portals allow a single active
// session, and Akamai tolerates a lone browser-paced client far better than
// parallel bursts.
let queueTail: Promise<unknown> = Promise.resolve();

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const run = queueTail.then(task, task);
  queueTail = run.catch(() => undefined);
  return run;
}

function log(...args: unknown[]): void {
  console.log('[scraper:easyjet]', ...args);
}

function withDeadline<T>(ms: number, work: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new AppError(`Scrape timed out after ${Math.round(ms / 1000)}s`, 504)),
      ms,
    );
    work().then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function scrapeOnce(
  browser: Browser,
  deepLinkUrl: string,
  apiUrl: string,
  ctx: EasyJetScrapeContext,
  navTimeout: number,
): Promise<unknown> {
  const pages = await browser.pages();
  const page = pages[0] ?? (await browser.newPage());
  log('browser ready, url=', page.url());

  // Automated login if the session isn't established yet.
  if (!page.url().startsWith(ctx.fetch.originPrefix)) {
    log('logging in…');
    await ensureLoggedIn(page, ctx, navTimeout);
    log('login complete, url=', page.url());
  }

  // Primary: navigate to the hotel page and capture its offers response.
  log('navigating to deep link & awaiting offers response…');
  let intercepted = await captureOffersFromPage(page, deepLinkUrl, ctx, navTimeout);

  if (intercepted === null && isOnLoginPage(page, ctx)) {
    log('bounced to login during navigation, re-authenticating…');
    await ensureLoggedIn(page, ctx, navTimeout);
    intercepted = await captureOffersFromPage(page, deepLinkUrl, ctx, navTimeout);
  }
  if (intercepted !== null) {
    log('captured offers response via interception');
    return intercepted;
  }

  // Fallback: in-page fetch of the reconstructed API URL.
  log('interception yielded nothing; trying in-page fetch fallback…');
  let result = await fetchFromPage(page, apiUrl);
  log('fallback fetch status', result.status);
  if (result.status === 401 || result.status === 403) {
    await ensureLoggedIn(page, ctx, navTimeout);
    result = await fetchFromPage(page, apiUrl);
    log('fallback fetch status after re-login', result.status);
  }

  if (result.status === 401 || result.status === 403) {
    throw new AppError(
      'Supplier portal rejected the request after automated re-login (bot check). ' +
        'A residential proxy (Browserless proxy=residential) is usually required to get past it.',
      502,
    );
  }
  if (result.status < 200 || result.status >= 300) {
    throw new AppError(`Supplier offers API returned HTTP ${result.status}`, 502);
  }

  try {
    return JSON.parse(result.body) as unknown;
  } catch {
    throw new AppError('Supplier offers API returned a non-JSON response (likely a bot challenge page)', 502);
  }
}

/**
 * Scrapes the offers JSON for a deep link using the supplied context. Logs in
 * automatically, intercepts the page's own API response (primary) or falls back
 * to an in-page fetch, retries once on transient failure, and is bounded by a
 * hard deadline so it can never hang. A fresh browser is used per scrape.
 */
export function fetchOffers(deepLinkUrl: string, apiUrl: string, ctx: EasyJetScrapeContext): Promise<unknown> {
  const t = timeoutsFor(ctx);
  return enqueue(() =>
    withDeadline(t.deadline, async () => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= t.maxAttempts; attempt++) {
        let browser: Browser | null = null;
        try {
          log(`connecting browser… (attempt ${attempt}/${t.maxAttempts})`);
          browser = await launchBrowser(ctx);
          return await scrapeOnce(browser, deepLinkUrl, apiUrl, ctx, t.nav);
        } catch (err) {
          lastErr = err;
          log(`attempt ${attempt}/${t.maxAttempts} failed:`, err instanceof Error ? err.message : err);
          if (err instanceof AppError && err.statusCode === 503) throw err; // missing creds — won't fix by retry
        } finally {
          // Always drop the browser: Browserless sessions are single-use here,
          // and a fresh connect on retry gets a new sticky residential IP.
          if (browser) await browser.close().catch(() => undefined);
        }
      }
      throw lastErr;
    }),
  );
}
