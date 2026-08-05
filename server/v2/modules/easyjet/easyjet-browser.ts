import type { Browser, Page, HTTPResponse, CookieParam } from 'puppeteer';
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
//   • steel — remote Chrome via Steel (cloud or self-hosted). A session is
//     created via its REST API, Puppeteer connects to the session's CDP
//     websocket, and the session is released on close. Same ephemeral
//     per-scrape semantics as browserless.
//   • local — Chrome with a persistent profile (userDataDir); the on-disk
//     session survives across scrapes so login is usually skipped.

// puppeteer-extra wraps puppeteer; the stealth plugin applies ~15 evasions
// (navigator.webdriver, UA, plugins, WebGL, …) to every page automatically.
const puppeteer = puppeteerExtra as unknown as typeof import('puppeteer').default;
puppeteerExtra.use(StealthPlugin());

const CONNECT_TIMEOUT_MS = 15_000;
const INTERCEPT_WAIT_MS = 8_000;

// Derived timeouts for a given context. Under a remote backend the whole
// session is capped, so keep individual waits well under it; locally no cap.
function timeoutsFor(ctx: EasyJetScrapeContext) {
  const isRemote = ctx.browser.backend !== 'local';
  const session = ctx.browser.sessionTimeoutMs || 60_000;
  return {
    isRemote,
    // Scales with the session cap (25s at the 60s default) so raising
    // SCRAPER_SESSION_TIMEOUT_MS gives slow pages more room, capped at 45s to
    // keep two attempts inside the deadline.
    nav: isRemote ? Math.min(45_000, Math.max(25_000, session / 2 - 5_000)) : 45_000,
    maxAttempts: isRemote ? 2 : 1,
    // Hard ceiling so a dead/stalled session can never hang the HTTP request.
    // Must fit TWO attempts: a heavy login portal (Jet2) runs ~80s/attempt and
    // Jet2/Steel occasionally throws a bot-challenge that detaches the tab, so
    // the second attempt (fresh session) needs room. Scales with the session cap
    // (so Browserless's 60s plan stays ~115s) up to a 175s ceiling.
    deadline: isRemote ? Math.min(175_000, Math.max(115_000, session - 5_000)) : 120_000,
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

// ─── Steel backend ───────────────────────────────────────────────────────────
// Steel (cloud or self-hosted) is session-based: create a session over REST,
// connect Puppeteer to its CDP websocket, release the session when done. A new
// session per attempt mirrors Browserless's fresh-sticky-IP-per-retry.

interface SteelSession {
  id: string;
  websocketUrl: string;
}

function steelApiBase(b: EasyJetScrapeContext['browser']): string {
  return (b.steelApiUrl || 'https://api.steel.dev').replace(/\/+$/, '');
}

function steelHeaders(b: EasyJetScrapeContext['browser']): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (b.steelApiKey) headers['steel-api-key'] = b.steelApiKey;
  return headers;
}

async function createSteelSession(b: EasyJetScrapeContext['browser']): Promise<SteelSession> {
  const body: Record<string, unknown> = { timeout: b.sessionTimeoutMs || 60_000 };
  // BYO proxy wins (Steel's managed residential pool is US-only, so GB targets
  // need STEEL_PROXY_URL); otherwise any configured proxy maps to the pool.
  // STEEL_PROXY_URL=off runs with no proxy at all (free-tier smoke tests —
  // Steel's managed pool needs a paid balance). Steel requires an explicit
  // scheme on real proxy URLs.
  const proxyUrl = b.steelProxyUrl?.trim().toLowerCase();
  if (proxyUrl === 'off' || proxyUrl === 'none') {
    // no proxy
  } else if (b.steelProxyUrl) {
    body.proxyUrl = /^https?:\/\//i.test(b.steelProxyUrl) ? b.steelProxyUrl : `http://${b.steelProxyUrl}`;
  } else if (b.proxy) {
    body.useProxy = true;
  }

  const res = await fetch(`${steelApiBase(b)}/v1/sessions`, {
    method: 'POST',
    headers: steelHeaders(b),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 300);
    throw new AppError(`Steel session create failed: HTTP ${res.status}${detail ? ` — ${detail}` : ''}`, 502);
  }
  const session = (await res.json().catch(() => null)) as SteelSession | null;
  if (!session?.websocketUrl) throw new AppError('Steel session create returned no websocketUrl', 502);
  return session;
}

// Best-effort: an unreleased session keeps running (and billing, on cloud)
// until its timeout, so failures here are logged but never fatal.
async function releaseSteelSession(b: EasyJetScrapeContext['browser'], id: string): Promise<void> {
  await fetch(`${steelApiBase(b)}/v1/sessions/${id}/release`, { method: 'POST', headers: steelHeaders(b) }).catch(
    (e) => log('steel session release failed (will expire on its own):', e instanceof Error ? e.message : e),
  );
}

function steelEndpoint(b: EasyJetScrapeContext['browser'], session: SteelSession): string {
  if (!b.steelApiKey) return session.websocketUrl; // self-hosted: no key needed
  const sep = session.websocketUrl.includes('?') ? '&' : '?';
  return `${session.websocketUrl}${sep}apiKey=${encodeURIComponent(b.steelApiKey)}`;
}

// Provider cleanup (e.g. Steel session release) keyed by browser instance, run
// by closeBrowser after the CDP connection is dropped.
const remoteCleanup = new WeakMap<Browser, () => Promise<void>>();

async function closeBrowser(browser: Browser): Promise<void> {
  await browser.close().catch(() => undefined);
  const cleanup = remoteCleanup.get(browser);
  if (cleanup) {
    remoteCleanup.delete(browser);
    await cleanup().catch(() => undefined);
  }
}

// Turns a raw WebSocket/puppeteer connect rejection (often a ws ErrorEvent, not
// an Error) into a clean, actionable AppError instead of a giant object dump.
function toConnectError(e: unknown, label: string): AppError {
  const msg =
    (e as { message?: string })?.message ||
    ((e as { error?: { message?: string } })?.error?.message ?? '') ||
    String(e);
  if (/\b401\b/.test(msg)) {
    return new AppError(
      `${label} rejected the connection (401 Unauthorized) — the token/key is invalid or your session/unit quota is exhausted. Check the ${label} dashboard, or switch backend with SCRAPER_BROWSER_BACKEND.`,
      502,
    );
  }
  if (/\b429\b/.test(msg)) {
    return new AppError(`${label} is at its concurrent-session limit (429). Wait a moment and retry.`, 502);
  }
  return new AppError(`${label} connect failed: ${msg.slice(0, 200)}`, 502);
}

// puppeteer.connect has no built-in timeout; bound it so a slow cloud connect
// rejects and can be retried instead of hanging.
function connectWithTimeout(endpoint: string, ms: number, label: string): Promise<Browser> {
  return new Promise<Browser>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      settled = true;
      reject(new AppError(`${label} connect timed out after ${Math.round(ms / 1000)}s`, 504));
    }, ms);
    puppeteer
      .connect({ browserWSEndpoint: endpoint, defaultViewport: { width: 1366, height: 900 } })
      .then(
        (b) => {
          clearTimeout(timer);
          if (settled) void b.close().catch(() => undefined); // arrived late — drop it
          else resolve(b);
        },
        (e) => {
          clearTimeout(timer);
          if (!settled) reject(toConnectError(e, label));
        },
      );
  });
}

async function launchBrowser(ctx: EasyJetScrapeContext): Promise<Browser> {
  const b = ctx.browser;
  if (b.backend === 'browserless') {
    if (!b.browserlessToken) throw new AppError('Browserless backend selected but no token configured', 500);
    return connectWithTimeout(browserlessEndpoint(b), CONNECT_TIMEOUT_MS, 'Browserless');
  }
  if (b.backend === 'steel') {
    if (!b.steelApiUrl && !b.steelApiKey) {
      throw new AppError('Steel backend selected but neither STEEL_API_KEY nor STEEL_API_URL is configured', 500);
    }
    const session = await createSteelSession(b);
    try {
      const browser = await connectWithTimeout(steelEndpoint(b, session), CONNECT_TIMEOUT_MS, 'Steel');
      remoteCleanup.set(browser, () => releaseSteelSession(b, session.id));
      return browser;
    } catch (err) {
      await releaseSteelSession(b, session.id);
      throw err;
    }
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
  // Empty identityHost = no login configured; url.includes("") would be true for
  // every page, so guard it — otherwise no-login suppliers look "always on login".
  return !!ctx.auth.identityHost && page.url().includes(ctx.auth.identityHost);
}

// A supplier needs a login only when login selectors are configured. No-login
// (public) suppliers leave these blank and skip authentication entirely.
function isLoginConfigured(ctx: EasyJetScrapeContext): boolean {
  return !!ctx.auth.usernameSelector && !!ctx.auth.passwordSelector;
}

function hasCredentials(ctx: EasyJetScrapeContext): boolean {
  return !!ctx.credentials.username && !!ctx.credentials.password;
}

// Navigates to a deal URL after login. Most login portals (Jet2, easyJet) return
// to the full deal via ReturnUrl and render it directly, so we're often already
// there — re-navigating would make an SPA (Jet2) re-run its search and churn
// through redirects, destroying the render. So skip the goto when already on the
// deal's path. Suppliers whose ?params URL redirects to login (Hoseasons) don't
// use this at all — they take the price-API path (scrapeViaDom navigateBase).
async function navigateToDeal(page: Page, url: string, timeout: number): Promise<void> {
  const samePath = (() => {
    try {
      return new URL(page.url()).pathname === new URL(url).pathname;
    } catch {
      return false;
    }
  })();
  if (samePath) {
    log('already on deal page after login — skipping re-navigation, url=', page.url());
    return;
  }
  log('navigating to deal URL:', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout }).catch(() => undefined);
  log('after deal navigation, url=', page.url());
}

// Options for scrapeViaDom. learnLogin is invoked the first time we hit a login
// page for a supplier that has credentials but no login selectors yet — it
// (via AI) returns the selectors, which are used this run and persisted for later.
export interface ScrapeViaDomOptions {
  learnLogin?: (loginFormHtml: string, loginUrl: string) => Promise<Partial<EasyJetScrapeContext['auth']>>;
  // When true, after login navigate to the PARAM-LESS property page (origin +
  // pathname) rather than the full deal URL, and skip the deal-path guard. Used
  // by the price-API path, where the ?params URL redirects to login but the bare
  // property page loads and carries the id the price AJAX needs (Hoseasons).
  navigateBase?: boolean;
}

// Clicks the first VISIBLE element matching the selector (some login forms
// render duplicate buttons where one is display:none). Falls back to pressing
// Enter, which submits the form, if no visible match is found.
async function clickSubmit(page: Page, selector: string): Promise<void> {
  // Tolerant of the frame detaching mid-click (login pages often redirect the
  // instant the button is pressed): swallow per-handle errors, fall back to Enter.
  try {
    const handles = await page.$$(selector);
    for (const h of handles) {
      const box = await h.boundingBox().catch(() => null); // null for hidden/detached
      if (box) {
        await h.click().catch(() => undefined);
        return;
      }
    }
  } catch {
    /* fall through to Enter */
  }
  await page.keyboard.press('Enter').catch(() => undefined);
}

// Types into a field, clearing first so values never concatenate, and VERIFIES
// the value actually landed — retrying once. Login forms sometimes aren't fully
// interactive right after a redirect, so a naive type() can silently no-op and
// submit empty credentials.
async function typeField(page: Page, selector: string, value: string): Promise<boolean> {
  if (!selector || !value) return false;
  for (let attempt = 0; attempt < 2; attempt++) {
    const el = await page.$(selector).catch(() => null);
    if (!el) {
      await page.waitForSelector(selector, { timeout: 4_000 }).catch(() => undefined);
      continue;
    }
    await el.focus().catch(() => undefined);
    await el.evaluate((n) => {
      (n as HTMLInputElement).value = '';
    }).catch(() => undefined);
    await el.type(value, { delay: 40 }).catch(() => undefined);
    const actual = await el.evaluate((n) => (n as HTMLInputElement).value).catch(() => '');
    if (actual && actual.length > 0) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

// Cookie-consent overlays (OneTrust, Cookiebot, …) render ON TOP of login forms
// and swallow the mouse click on the submit button — the form never submits, the
// URL never changes, and no error appears (the exact "still on the login page"
// signature). Dismiss the common ones before interacting; a no-op when absent.
async function dismissConsentOverlays(page: Page): Promise<void> {
  const clicked = await page
    .evaluate(() => {
      const known = [
        '#onetrust-accept-btn-handler',
        '#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll',
        'button[id*="cookie" i][id*="accept" i]',
      ];
      for (const sel of known) {
        const el = document.querySelector<HTMLElement>(sel);
        if (el && el.offsetParent !== null) {
          el.click();
          return true;
        }
      }
      // Fallback: a visible button whose ENTIRE label is an accept-cookies phrase
      // (full match, so "accept terms & conditions" checkboxes never match).
      const rx = /^(accept( all)?( cookies)?|allow all( cookies)?|i accept|agree( and close)?)$/i;
      for (const b of Array.from(document.querySelectorAll<HTMLElement>('button, a, [role="button"]'))) {
        if (b.offsetParent !== null && rx.test((b.textContent || '').trim())) {
          b.click();
          return true;
        }
      }
      return false;
    })
    .catch(() => false);
  if (clicked) {
    log('dismissed a cookie-consent overlay');
    await new Promise((r) => setTimeout(r, 500)); // let the overlay animate out
  }
}

// After a failed submit, pull any error-looking sentence from the page's visible
// text so the thrown message says WHAT the portal said (invalid credentials,
// account locked, …) instead of just "still on the login page".
async function readLoginErrorHint(page: Page): Promise<string> {
  return page
    .evaluate(() => {
      const t = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
      const m = t.match(
        /[^.!\n]{0,80}(invalid|incorrect|not recognised|not recognized|wrong password|locked|suspended|disabled|expired|unable to log|login failed|try again)[^.!\n]{0,120}/i,
      );
      return m ? m[0].trim().slice(0, 250) : '';
    })
    .catch(() => '');
}

async function submitLogin(page: Page, ctx: EasyJetScrapeContext, navTimeout: number): Promise<void> {
  const { username, password, abtaNumber } = ctx.credentials;
  if (!password || (!username && !abtaNumber)) {
    throw new AppError('Supplier login needs a password plus a username or ABTA number.', 503);
  }
  const { usernameSelector, passwordSelector, submitSelector, abtaSelector, errorSelector, uppercaseCredentials } =
    ctx.auth;
  // Some trade portals require UPPERCASE input (Hoseasons labels its fields
  // "(Uppercase)"). When the config flags it, upper-case what we type.
  const up = (v?: string): string | undefined => (v && uppercaseCredentials ? v.toUpperCase() : v);

  // Make sure the login form is actually interactive before filling — a redirect
  // may have just landed and the fields aren't ready, which causes empty submits.
  await page.waitForSelector(passwordSelector, { timeout: navTimeout }).catch(() => undefined);
  await dismissConsentOverlays(page);
  await new Promise((r) => setTimeout(r, 400));

  // Fill the extra ABTA/agency field ONLY when it's a DISTINCT field from the
  // username input. Some agent portals (e.g. Hoseasons) log in with the ABTA
  // number as the identifier itself, so both selectors point at the same box —
  // typing into it twice corrupts it.
  const abtaIsSeparate = !!abtaSelector && abtaSelector !== usernameSelector;
  if (abtaIsSeparate && abtaNumber) {
    await typeField(page, abtaSelector, up(abtaNumber) as string);
  }

  // Primary login identifier: the username if there is one, otherwise the ABTA
  // number (portals that log in with ABTA + password only).
  const identifier = up(username || (!abtaIsSeparate ? abtaNumber : undefined));
  const idOk = usernameSelector && identifier ? await typeField(page, usernameSelector, identifier) : false;
  const pwOk = await typeField(page, passwordSelector, up(password) as string);
  log('submitting login — id-filled:', idOk, '| pw-filled:', pwOk, '| abta-separate:', abtaIsSeparate, '| uppercase:', !!uppercaseCredentials);
  if (!idOk || !pwOk) {
    // The form didn't accept input — it wasn't interactive. Bail so the outer
    // retry gets a fresh page rather than submitting empty credentials.
    throw new AppError('Login form did not accept the credentials (page not interactive yet) — retrying.', 502);
  }

  await Promise.all([
    // Catch: the redirect can detach the frame before this settles.
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: navTimeout }).catch(() => undefined),
    clickSubmit(page, submitSelector),
  ]);
  // Absorb a follow-on redirect (login → callback → deal / dashboard).
  await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 6_000 }).catch(() => undefined);
  log('after login submit, url=', page.url());

  // Failure = a genuinely VISIBLE error message, OR the login form (password
  // field) is still present. Both are checked — a portal that stays on the same
  // URL (Hoseasons /agents) reveals a failed login only by the form still being
  // there; a hidden error div must NOT count.
  let failureMessage: string | null = null;
  if (errorSelector) {
    const visibleError = await page
      .$$eval(errorSelector, (els) => {
        const v = els.find((e) => (e as HTMLElement).offsetParent !== null && (e.textContent || '').trim() !== '');
        return v ? (v.textContent || '').trim() : '';
      })
      .catch(() => '');
    if (visibleError) failureMessage = visibleError;
  }
  if (!failureMessage) {
    const passwordStillVisible = await page
      .$(passwordSelector)
      .then((el) => (el ? el.boundingBox().then((b) => !!b) : false))
      .catch(() => false);
    if (passwordStillVisible) {
      const hint = await readLoginErrorHint(page);
      failureMessage =
        'still on the login page after submitting credentials — check the credentials (this portal may require UPPERCASE input)' +
        (hint ? ` — the page says: "${hint}"` : '');
    }
  }
  if (failureMessage) throw new AppError(`Supplier login failed: ${failureMessage}`, 502);
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

// ─── Per-supplier concurrency gate ───────────────────────────────────────────
// Scrapes for the SAME supplier run up to its configured concurrency (default 1,
// raise with browser.maxConcurrent / SCRAPER_MAX_CONCURRENT); DIFFERENT
// suppliers never block each other. A scrape that will have to LOG IN
// (credentials configured but no saved session cookies) runs EXCLUSIVELY for
// its supplier: parallel logins to one trade-portal account invalidate each
// other's sessions, so the first scrape authenticates alone and persists its
// cookies, then the queued ones run concurrently reusing that session.
interface GateTask {
  exclusive: boolean;
  limit: number;
  start: () => void;
}
interface Gate {
  active: number;
  activeExclusive: boolean;
  waiting: GateTask[];
}
const gates = new Map<string, Gate>();

function pumpGate(g: Gate): void {
  while (g.waiting.length > 0) {
    const next = g.waiting[0];
    // Exclusive tasks wait for an empty gate; normal tasks wait for the
    // exclusive one to finish and for a free slot. FIFO — an exclusive task at
    // the head also blocks later normal tasks (no starvation).
    if (next.exclusive ? g.active > 0 : g.activeExclusive || g.active >= next.limit) return;
    g.waiting.shift();
    g.active++;
    if (next.exclusive) g.activeExclusive = true;
    next.start();
  }
}

function enqueue<T>(ctx: EasyJetScrapeContext, task: () => Promise<T>): Promise<T> {
  const key = ctx.queueKey || ctx.fetch.originPrefix || 'global';
  const limit = Math.max(1, ctx.browser.maxConcurrent ?? 1);
  // No saved session + credentials configured ⇒ this scrape will log in, so it
  // must hold the gate alone (see above). Once cookies exist, scrapes share.
  const exclusive =
    hasCredentials(ctx) && !(Array.isArray(ctx.sessionCookies) && ctx.sessionCookies.length > 0);
  const g = gates.get(key) ?? { active: 0, activeExclusive: false, waiting: [] };
  gates.set(key, g);
  return new Promise<T>((resolve, reject) => {
    g.waiting.push({
      exclusive,
      limit,
      start: () => {
        void task()
          .then(resolve, reject)
          .finally(() => {
            g.active--;
            if (exclusive) g.activeExclusive = false;
            pumpGate(g);
          });
      },
    });
    if (g.active > 0 || g.waiting.length > 1) {
      log(`scrape queued — key=${key} active=${g.active} waiting=${g.waiting.length} limit=${limit} loginNeeded=${exclusive}`);
    }
    pumpGate(g);
  });
}

// Shared browser worker used by every supplier (easyJet API path AND the
// generic DOM adapter), so the log label is supplier-neutral.
function log(...args: unknown[]): void {
  console.log('[scraper]', ...args);
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
  return enqueue(ctx, () =>
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
          // Always drop the browser: remote sessions are single-use here, and a
          // fresh connect on retry gets a new egress IP (Browserless sticky
          // proxy / a brand-new Steel session).
          if (browser) await closeBrowser(browser);
        }
      }
      throw lastErr;
    }),
  );
}

/**
 * Waits for the deal to render (innerText matches `waitRegex`) and snapshots
 * title + innerText. Resilient to the page still redirecting: an
 * evaluate/waitForFunction can throw "detached Frame" / "execution context
 * destroyed" mid-navigation, so it absorbs the navigation and retries.
 */
// Returns a live page to read from. If `page`'s main frame is detached (some
// login flows — Jet2 — swap the tab, leaving our original handle dead while the
// real content renders on a NEW page), find the most-recently-opened page that
// still responds and use that instead.
async function isAlive(p: Page): Promise<boolean> {
  return p.evaluate(() => 1).then(() => true).catch(() => false);
}

async function resolveLivePage(page: Page): Promise<Page> {
  if (await isAlive(page)) return page;
  const browser = page.browser();
  const pages = await browser.pages().catch(() => [] as Page[]);
  log('page detached — scanning', pages.length, 'open page(s) for a live one');
  for (const p of [...pages].reverse()) {
    if (p === page) continue;
    if (await isAlive(p)) {
      log('recovered live page, url=', p.url());
      return p;
    }
  }
  return page;
}

// When the current page is dead (some login flows detach the deal tab), open a
// fresh tab and reload the deal — the auth cookies live in the browser context,
// so the deal renders without re-login. Returns a guaranteed-fresh live page.
async function reloadDealInFreshTab(page: Page, dealUrl: string, timeout: number): Promise<Page> {
  const browser = page.browser();
  const fresh = await browser.newPage();
  await fresh.setViewport({ width: 1366, height: 900 }).catch(() => undefined);
  log('opening a fresh tab for the deal (original tab detached)…');
  await fresh.goto(dealUrl, { waitUntil: 'domcontentloaded', timeout }).catch(() => undefined);
  log('fresh tab url=', fresh.url());
  return fresh;
}

export interface CapturedImage {
  src: string;
  w: number;
  h: number;
}
export interface CapturedDom {
  title: string;
  text: string;
  images: CapturedImage[];
}

// Reads every rendered <img> (skipping data: URIs), with its natural size — used
// to build the hotel gallery, which innerText can't carry.
async function captureImages(page: Page): Promise<CapturedImage[]> {
  return page
    .$$eval('img', (els) =>
      els
        .map((e) => {
          const img = e as HTMLImageElement;
          return { src: img.currentSrc || img.src, w: img.naturalWidth || 0, h: img.naturalHeight || 0 };
        })
        .filter((i) => i.src && !i.src.startsWith('data:')),
    )
    .catch(() => [] as CapturedImage[]);
}

// Some portals hide the flight times/airports behind a "details" modal (e.g. a
// "Compare airport, dates & prices" control). Given the control's text pattern
// (from the supplier's spec — never hardcoded here), this clicks it and returns
// the modal's text (containing "Depart: … at HH:MM" lines) so the interpreter can
// read real flight times. No trigger configured ⇒ nothing to open, returns ''.
export async function captureFlightModal(page: Page, triggerRegex?: string): Promise<string> {
  const trigger = triggerRegex?.trim();
  if (!trigger) return '';
  try {
    page = await resolveLivePage(page);
    const clicked = await page.evaluate((re: string) => {
      const rx = new RegExp(re, 'i');
      const cands = (Array.from(document.querySelectorAll('button, a, [role="button"]')) as HTMLElement[]).filter(
        (e) => rx.test(e.textContent || '') && (e.textContent || '').trim().length < 80 && e.offsetParent !== null,
      );
      cands.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
      if (cands[0]) {
        cands[0].click();
        return true;
      }
      return false;
    }, trigger);
    if (!clicked) return '';
    // Wait for a visible modal whose text carries flight-detail markers.
    await page
      .waitForFunction(
        () => {
          const sels = ['[role="dialog"]', '[aria-modal="true"]', '[class*="modal"]', '[class*="Modal"]', '[class*="drawer"]', '[class*="overlay"]'];
          for (const s of sels)
            for (const m of Array.from(document.querySelectorAll<HTMLElement>(s)))
              if (m.offsetParent !== null && /Depart:|Going Out|Coming Back/i.test(m.innerText || '')) return true;
          return false;
        },
        { timeout: 6_000 },
      )
      .catch(() => undefined);
    return await page.evaluate(() => {
      const sels = ['[role="dialog"]', '[aria-modal="true"]', '[class*="modal"]', '[class*="Modal"]', '[class*="drawer"]', '[class*="overlay"]'];
      let best = '';
      for (const s of sels)
        document.querySelectorAll<HTMLElement>(s).forEach((m) => {
          if (m.offsetParent === null) return;
          const t = m.innerText || '';
          if (/Depart:|Going Out/i.test(t) && t.length > best.length) best = t;
        });
      return best;
    });
  } catch {
    return '';
  }
}

export async function captureRenderedDom(
  page: Page,
  waitRegex: string,
  waitMs: number,
): Promise<CapturedDom> {
  for (let i = 0; i < 4; i++) {
    try {
      page = await resolveLivePage(page);
      // Ready when the target pattern appears OR the page content has SETTLED
      // (innerText length unchanged across a couple of polls). Settling avoids
      // snapshotting an early header-only state before the deal/price has
      // rendered — capturing too early produces a spec with no real fields.
      await page
        .waitForFunction(
          (re: string) => {
            const t = document.body?.innerText || '';
            if (new RegExp(re).test(t)) return true;
            const w = window as unknown as { __scrLen?: number; __scrStable?: number };
            const prev = w.__scrLen ?? -1;
            w.__scrStable = t.length === prev && t.length > 800 ? (w.__scrStable ?? 0) + 1 : 0;
            w.__scrLen = t.length;
            return (w.__scrStable ?? 0) >= 2; // stable for ~2s and non-trivial
          },
          { timeout: Math.max(6_000, waitMs), polling: 1000 },
          waitRegex,
        )
        .catch(() => undefined);
      const snap = await page.evaluate(() => ({
        title: document.title,
        text: document.body?.innerText || '',
        url: location.href,
        htmlLen: document.documentElement?.outerHTML.length || 0,
      }));
      const images = await captureImages(page);
      log('captured page:', { title: snap.title, textLen: snap.text.length, htmlLen: snap.htmlLen, imgs: images.length, url: snap.url });
      return { title: snap.title, text: snap.text, images };
    } catch (e) {
      // Frame detached by a navigation — let it settle, then retry the read.
      log(`capture attempt ${i + 1}/4 read failed (page navigating?):`, e instanceof Error ? e.message : e);
      await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8_000 }).catch(() => undefined);
      await new Promise((r) => setTimeout(r, 1_500));
    }
  }
  const fb = await page
    .evaluate(() => ({ title: document.title, text: document.body?.innerText || '', url: location.href }))
    .catch((e) => ({ title: '', text: '', url: `read-failed: ${e instanceof Error ? e.message : e}` }));
  const fbImages = await captureImages(page);
  log('captured page (fallback):', { title: fb.title, textLen: fb.text.length, imgs: fbImages.length, url: fb.url });
  return { title: fb.title, text: fb.text, images: fbImages };
}

/**
 * Logs in (if needed), navigates to the deal deep link, and hands the
 * authenticated page to `extract` — for suppliers whose data is read from the
 * rendered DOM rather than a JSON API. Navigating to the deal first lets sites
 * that redirect to a login form (e.g. Jet2) return to the deal via ReturnUrl
 * after authentication. Same queue / deadline / retry guarantees as fetchOffers.
 */
export function scrapeViaDom<T>(
  deepLinkUrl: string,
  ctx: EasyJetScrapeContext,
  extract: (page: Page, apiJson: unknown | null, apiUrl: string | null) => Promise<T>,
  opts?: ScrapeViaDomOptions,
): Promise<T> {
  const t = timeoutsFor(ctx);
  // Ensure we can tell "back on the site" after login even for a bare config.
  if (!ctx.fetch.originPrefix) {
    try {
      ctx.fetch.originPrefix = new URL(deepLinkUrl).origin;
    } catch {
      /* leave empty */
    }
  }
  // Intercept the supplier's own JSON API when a SPECIFIC path is configured
  // (the bare "/api/" placeholder is too broad — that means "DOM only").
  const apiPath = ctx.fetch.apiPath;
  const interceptApi = !!apiPath && apiPath !== '/api/' && apiPath.length > 2;
  return enqueue(ctx, () =>
    withDeadline(t.deadline, async () => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= t.maxAttempts; attempt++) {
        let browser: Browser | null = null;
        try {
          log(`connecting browser… (attempt ${attempt}/${t.maxAttempts})`);
          browser = await launchBrowser(ctx);
          const pages = await browser.pages();
          const page = pages[0] ?? (await browser.newPage());

          // Capture the biggest matching JSON API response the page fires, and
          // the URL it fired at (the price-API path reads an id from it).
          let apiJson: unknown = null;
          let apiUrl: string | null = null;
          if (interceptApi) {
            page.on('response', async (res) => {
              if (!res.url().includes(apiPath)) return;
              apiUrl = res.url();
              if (res.status() < 200 || res.status() >= 300) return;
              try {
                const j = await res.json();
                if (j && typeof j === 'object') apiJson = j;
              } catch {
                /* not JSON */
              }
            });
          }

          // Restore a saved login session BEFORE navigating, so a valid session
          // lets us land straight on the deal and skip the (slow) login. If the
          // cookies have expired, the deal will still bounce to login and we
          // re-authenticate below (self-healing).
          if (Array.isArray(ctx.sessionCookies) && ctx.sessionCookies.length > 0) {
            try {
              await page.setCookie(...(ctx.sessionCookies as CookieParam[]));
              log('restored', ctx.sessionCookies.length, 'saved session cookie(s) — attempting login-skip');
            } catch (e) {
              log('could not restore saved cookies:', e instanceof Error ? e.message : e);
            }
          }

          // ─── Login-first mode ────────────────────────────────────────────
          // For portals whose deal link does NOT redirect to a login form (it
          // lands on a home/search page), authenticate at the configured login
          // URL first, THEN navigate to the deal. This is explicit config, so we
          // never mistake an unauthenticated landing page for "no login needed".
          if (ctx.auth.loginFirst && ctx.auth.loginUrl && hasCredentials(ctx)) {
            let loginUrl = ctx.auth.loginUrl;
            try {
              loginUrl = new URL(ctx.auth.loginUrl, new URL(deepLinkUrl).origin).href; // resolve relative
            } catch {
              /* use as configured */
            }
            log('login-first: opening configured login page', loginUrl);
            await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);

            // Learn the login field selectors from THIS page if we don't have
            // them yet — so the user only supplies the login URL, never the form.
            if (!isLoginConfigured(ctx) && opts?.learnLogin) {
              const looksLogin =
                (await page.$('input[type="password"]').then(Boolean).catch(() => false)) ||
                /login|sign-?in|auth/i.test(page.url());
              if (looksLogin) {
                log('login-first: learning login selectors from the login page…');
                const loginHtml = await page
                  .evaluate(() => (document.querySelector('form')?.outerHTML || document.body?.innerHTML || '').slice(0, 12_000))
                  .catch(() => '');
                if (loginHtml) {
                  const learned = await opts.learnLogin(loginHtml, page.url());
                  ctx.auth = { ...ctx.auth, ...learned };
                }
              }
            }

            if (isLoginConfigured(ctx)) {
              const formPresent = await page
                .waitForSelector(ctx.auth.passwordSelector, { timeout: 6_000 })
                .then(Boolean)
                .catch(() => false);
              if (formPresent) {
                await page.waitForSelector(ctx.auth.formSelector, { timeout: t.nav }).catch(() => undefined);
                await submitLogin(page, ctx, t.nav);
                if (ctx.persistSession) {
                  try {
                    await ctx.persistSession(await page.cookies());
                  } catch {
                    /* non-fatal */
                  }
                }
              } else {
                log('login-first: no login form shown — assuming the restored session is still valid');
              }
            } else {
              throw new AppError(
                'Could not find a login form at the configured login URL — check the Login page URL (it should open the page with the username/password fields).',
                502,
              );
            }

            // Now go to the deal itself (param-less property page for the price
            // API, else the full deal URL).
            if (opts?.navigateBase) {
              let base = deepLinkUrl;
              try {
                const u = new URL(deepLinkUrl);
                base = u.origin + u.pathname;
              } catch {
                /* use as-is */
              }
              await page.goto(base, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);
              log('on property page (login-first), url=', page.url());
              await new Promise((r) => setTimeout(r, 2_500));
            } else {
              await page.goto(deepLinkUrl, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);
              log('after deal navigation (login-first), url=', page.url());
              const stillLogin = await page.$(ctx.auth.passwordSelector).then(Boolean).catch(() => false);
              if (stillLogin) {
                throw new AppError(
                  'Logged in but the deal page still shows a login form — check the credentials (some portals require UPPERCASE) or the login URL.',
                  502,
                );
              }
              const dealPath = (() => {
                try {
                  return new URL(deepLinkUrl).pathname;
                } catch {
                  return '';
                }
              })();
              if (dealPath && dealPath.length > 1 && !page.url().includes(dealPath)) {
                throw new AppError(
                  `Reached "${page.url()}" instead of the deal after login — the deal URL redirected away. Check the login URL and that the credentials are valid.`,
                  502,
                );
              }
            }

            log('extracting from rendered page…');
            const livePage = await resolveLivePage(page);
            return await extract(livePage, apiJson, apiUrl);
          }

          // ─── Deal-first mode (default) ───────────────────────────────────
          // Navigate to the deal; a login site may redirect to its login form.
          await page.goto(deepLinkUrl, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);

          let needLogin = false;
          if (isLoginConfigured(ctx)) {
            // Detect the login form by the PASSWORD FIELD being present, not the
            // URL — reliable even when login and deal pages share a path prefix
            // (Hoseasons deals live under /agents, same as its login page). Use a
            // short waitForSelector so a login form that appears AFTER a redirect
            // is still caught.
            needLogin = ctx.auth.passwordSelector
              ? await page.waitForSelector(ctx.auth.passwordSelector, { timeout: 5_000 }).then(Boolean).catch(() => false)
              : false;
          } else if (opts?.learnLogin && hasCredentials(ctx)) {
            // Brand-new login supplier: no selectors yet. Detect a login page
            // generically (password field / login-ish URL) and learn selectors.
            const looksLogin =
              (await page.$('input[type="password"]').then(Boolean).catch(() => false)) ||
              /login|sign-?in|auth|tslogin/i.test(page.url());
            if (looksLogin) {
              log('login page detected with no selectors — learning login config…');
              const loginHtml = await page
                .evaluate(() => (document.querySelector('form')?.outerHTML || document.body?.innerHTML || '').slice(0, 12_000))
                .catch(() => '');
              if (loginHtml) {
                const learned = await opts.learnLogin(loginHtml, page.url());
                ctx.auth = { ...ctx.auth, ...learned };
                needLogin = isLoginConfigured(ctx);
              }
            }
          }

          if (needLogin) {
            log('authenticating…');
            await page.waitForSelector(ctx.auth.formSelector, { timeout: t.nav }).catch(() => undefined);
            await submitLogin(page, ctx, t.nav);
            if (opts?.navigateBase) {
              // Price-API path: open the param-less property page (it loads; the
              // ?params URL would redirect to login) so the extractor can read
              // the id + property details, then fire the price AJAX itself.
              let base = deepLinkUrl;
              try {
                const u = new URL(deepLinkUrl);
                base = u.origin + u.pathname;
              } catch {
                /* use as-is */
              }
              await page.goto(base, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);
              log('on property page, url=', page.url());
              // Let the property page fire its own availability AJAX so we can
              // capture the id it uses (most reliable source of WebsiteID).
              await new Promise((r) => setTimeout(r, 2_500));
              // A still-visible login form here means login didn't persist.
              const stillLogin = ctx.auth.passwordSelector
                ? await page.$(ctx.auth.passwordSelector).then(Boolean).catch(() => false)
                : false;
              if (stillLogin) {
                throw new AppError(
                  'Logged in but the property page still shows a login form — the credentials may be wrong (this portal may require UPPERCASE) or the session did not persist.',
                  502,
                );
              }
            } else {
              // Land on the deal after login (login may leave us on a dashboard or
              // stay on the shared /agents path). base-then-full avoids the
              // cold-deep-link-with-params → login redirect.
              await navigateToDeal(page, deepLinkUrl, t.nav);
              // If the deal page STILL shows the login form, the session didn't take
              // — credentials wrong (portal may require UPPERCASE) or session lost.
              const stillLogin = ctx.auth.passwordSelector
                ? await page.$(ctx.auth.passwordSelector).then(Boolean).catch(() => false)
                : false;
              if (stillLogin) {
                throw new AppError(
                  'Logged in but the deal page still shows a login form — the credentials may be wrong (this portal may require UPPERCASE) or the session did not persist.',
                  502,
                );
              }
              // Verify we actually landed on the deal (its path is in the URL). If
              // the deal URL redirected us elsewhere (e.g. back to a dashboard/home),
              // extracting that page is pointless — fail with a clear reason.
              const dealPath = (() => {
                try {
                  return new URL(deepLinkUrl).pathname;
                } catch {
                  return '';
                }
              })();
              if (dealPath && dealPath.length > 1 && !page.url().includes(dealPath)) {
                throw new AppError(
                  `Reached "${page.url()}" instead of the deal after login — the deal URL redirected away. The login session may not have persisted, or the URL is missing required params.`,
                  502,
                );
              }
            }

            // Login succeeded — persist the cookies so the NEXT scrape can
            // restore this session and skip login entirely.
            if (ctx.persistSession) {
              try {
                const cookies = await page.cookies();
                await ctx.persistSession(cookies);
                log('saved login session (', cookies.length, 'cookies) for reuse');
              } catch (e) {
                log('could not save session cookies:', e instanceof Error ? e.message : e);
              }
            }
          } else if (opts?.navigateBase) {
            // Session restored (no login needed) but the price-API path still
            // needs the param-less property page rather than the ?params deal URL.
            let base = deepLinkUrl;
            try {
              const u = new URL(deepLinkUrl);
              base = u.origin + u.pathname;
            } catch {
              /* use as-is */
            }
            await page.goto(base, { waitUntil: 'domcontentloaded', timeout: t.nav }).catch(() => undefined);
            log('on property page (session reused), url=', page.url());
            await new Promise((r) => setTimeout(r, 2_500));
          } else if (Array.isArray(ctx.sessionCookies) && ctx.sessionCookies.length > 0) {
            log('session reused — skipped login, on deal page:', page.url());
          }

          log('extracting from rendered page…');
          // Some login flows swap/detach the tab; make sure we hand the extractor
          // a live page. If none is recoverable, reload the deal in a fresh tab
          // (auth cookies are shared across the context).
          let livePage = await resolveLivePage(page);
          if (!opts?.navigateBase && !(await isAlive(livePage))) {
            livePage = await reloadDealInFreshTab(page, deepLinkUrl, t.nav);
          }
          return await extract(livePage, apiJson, apiUrl);
        } catch (err) {
          lastErr = err;
          log(`attempt ${attempt}/${t.maxAttempts} failed:`, err instanceof Error ? err.message : err);
          if (err instanceof AppError && err.statusCode === 503) throw err;
        } finally {
          if (browser) await closeBrowser(browser);
        }
      }
      throw lastErr;
    }),
  );
}
