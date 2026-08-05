import path from 'node:path';

// Everything the easyJet browser worker needs for one scrape, passed in rather
// than read from env — so a per-org DB config can drive it. buildDefaultContext
// reconstructs the previous env-based behaviour for backward compatibility.
export interface EasyJetScrapeContext {
  credentials: { username?: string; password?: string; abtaNumber?: string };
  // Concurrency-gate key — scrapes with the same key share the supplier's
  // concurrency limit (usually the supplierKey). Falls back to originPrefix.
  queueKey?: string;
  browser: {
    backend: ScraperBrowserBackend;
    // How many scrapes for THIS supplier may run concurrently (default 1).
    // Logins always run alone regardless. SCRAPER_MAX_CONCURRENT (env) overrides.
    maxConcurrent?: number;
    // Browserless — the token is system infrastructure (env); the rest is tunable.
    browserlessToken?: string;
    browserlessBase?: string; // e.g. wss://production-lon.browserless.io
    browserlessPath?: string; // e.g. /chromium/stealth
    proxy?: string; // e.g. residential
    proxyCountry?: string; // e.g. gb
    sessionTimeoutMs?: number; // remote per-session cap (plan-dependent)
    // Steel (cloud or self-hosted) — like the Browserless token, all env.
    steelApiUrl?: string; // e.g. https://api.steel.dev or http://localhost:3000
    steelApiKey?: string; // Steel Cloud key; self-hosted usually needs none
    steelProxyUrl?: string; // BYO proxy (user:pass@host:port) — Steel's managed pool is US-only
    // Local Chrome.
    headless?: boolean;
    chromePath?: string;
    userDataDir?: string;
  };
  auth: {
    loginUrl: string; // page whose load triggers the login flow
    loginFirst?: boolean; // open loginUrl + authenticate before the deal (see AuthConfig)
    identityHost: string; // host indicating we're on the login page (Keycloak)
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    abtaSelector?: string; // optional extra field (Jet2 ABTA No.)
    formSelector: string; // presence = login form is showing
    errorSelector?: string; // element holding a login error message
    uppercaseCredentials?: boolean; // portal requires UPPERCASE input (Hoseasons)
  };
  fetch: {
    apiPath: string; // substring identifying the offers API (interception + fetch)
    originPrefix: string; // requests must originate here, e.g. https://www.easyjet.com
  };
  // Session reuse: cookies from a previous successful login (restored to skip
  // login), and a callback to persist freshly-captured cookies for next time.
  sessionCookies?: unknown[];
  persistSession?: (cookies: unknown[]) => Promise<void>;
}

export type ScraperBrowserBackend = 'browserless' | 'steel' | 'local';

// Resolves the browser provider. An EXPLICIT per-supplier backend wins (so one
// supplier can use e.g. Browserless residential while the rest use Steel);
// SCRAPER_BROWSER_BACKEND is the default for suppliers that don't set one.
export function resolveBackend(configured?: ScraperBrowserBackend): ScraperBrowserBackend | undefined {
  if (configured === 'browserless' || configured === 'steel' || configured === 'local') return configured;
  const forced = process.env.SCRAPER_BROWSER_BACKEND;
  if (forced === 'browserless' || forced === 'steel' || forced === 'local') return forced;
  return configured;
}

// Env override for the remote session cap — when set it wins over per-supplier
// DB config (the raise-timeouts-globally switch).
export function resolveSessionTimeoutMs(configured?: number): number | undefined {
  const forced = Number(process.env.SCRAPER_SESSION_TIMEOUT_MS);
  if (Number.isFinite(forced) && forced > 0) return forced;
  return configured;
}

// Env override for per-supplier scrape concurrency — SCRAPER_MAX_CONCURRENT,
// when set, wins over the per-supplier DB value. Keep it at or below the
// browser provider's concurrent-session limit (e.g. Steel Launch allows 10).
export function resolveMaxConcurrent(configured?: number): number | undefined {
  const forced = Number(process.env.SCRAPER_MAX_CONCURRENT);
  if (Number.isFinite(forced) && forced > 0) return Math.floor(forced);
  return configured;
}

// Reconstructs the env-based configuration used before per-org DB configs. Lets
// the legacy /easyjet/scrape route (and local dev) keep working unchanged.
export function buildDefaultContext(): EasyJetScrapeContext {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  const steelApiUrl = process.env.STEEL_API_URL;
  const steelApiKey = process.env.STEEL_API_KEY;
  // Backend preference: explicit env override, else whichever provider has
  // credentials configured (Browserless first, matching previous behaviour).
  const inferred: ScraperBrowserBackend = browserlessToken
    ? 'browserless'
    : steelApiUrl || steelApiKey
      ? 'steel'
      : 'local';
  const backend = resolveBackend(undefined) || inferred;
  // Default session cap is backend-aware: Browserless free/standard plans hard-
  // cap a session at 60s (a higher value is rejected with a 400), but Steel and
  // local Chrome allow longer — and heavy multi-step logins (Jet2: deal →
  // /tslogin → submit → back to deal) need well over 60s before extraction, or
  // the session dies mid-scrape ("Target closed"). Env overrides still win.
  const defaultSessionCap = backend === 'browserless' ? 60_000 : 180_000;
  return {
    credentials: {
      username: process.env.EASYJET_TRADE_USERNAME,
      password: process.env.EASYJET_TRADE_PASSWORD,
    },
    browser: {
      backend,
      maxConcurrent: resolveMaxConcurrent(undefined),
      browserlessToken,
      steelApiUrl,
      steelApiKey,
      steelProxyUrl: process.env.STEEL_PROXY_URL,
      browserlessBase: process.env.BROWSERLESS_URL || 'wss://production-lon.browserless.io',
      browserlessPath: process.env.BROWSERLESS_PATH || '/chromium/stealth',
      proxy: process.env.BROWSERLESS_PROXY,
      proxyCountry: process.env.BROWSERLESS_PROXY_COUNTRY || 'gb',
      sessionTimeoutMs: resolveSessionTimeoutMs(undefined) || Number(process.env.BROWSERLESS_TIMEOUT) || defaultSessionCap,
      headless: process.env.EASYJET_HEADLESS !== 'false',
      chromePath: process.env.EASYJET_CHROME_PATH,
      userDataDir: process.env.EASYJET_USER_DATA_DIR || path.resolve(process.cwd(), '.easyjet-session'),
    },
    auth: {
      loginUrl: 'https://www.easyjet.com/en/holidays/trade-portal',
      identityHost: 'identity.holidays.easyjet.com',
      usernameSelector: '#username',
      passwordSelector: '#password',
      submitSelector: '#kc-login',
      formSelector: '#kc-form-login',
      errorSelector: '#input-error, [id^="input-error-container"] span, .pf-v5-c-alert__title',
    },
    fetch: {
      apiPath: '/holidays/_api/v1.0/hotel/offers',
      originPrefix: 'https://www.easyjet.com',
    },
  };
}
