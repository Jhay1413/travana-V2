import path from 'node:path';

// Everything the easyJet browser worker needs for one scrape, passed in rather
// than read from env — so a per-org DB config can drive it. buildDefaultContext
// reconstructs the previous env-based behaviour for backward compatibility.
export interface EasyJetScrapeContext {
  credentials: { username?: string; password?: string };
  browser: {
    backend: 'browserless' | 'local';
    // Browserless — the token is system infrastructure (env); the rest is tunable.
    browserlessToken?: string;
    browserlessBase?: string; // e.g. wss://production-lon.browserless.io
    browserlessPath?: string; // e.g. /chromium/stealth
    proxy?: string; // e.g. residential
    proxyCountry?: string; // e.g. gb
    sessionTimeoutMs?: number; // Browserless per-session cap (plan-dependent)
    // Local Chrome.
    headless?: boolean;
    chromePath?: string;
    userDataDir?: string;
  };
  auth: {
    loginUrl: string; // page whose load triggers the login flow
    identityHost: string; // host indicating we're on the login page (Keycloak)
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    formSelector: string; // presence = login form is showing
    errorSelector?: string; // element holding a login error message
  };
  fetch: {
    apiPath: string; // substring identifying the offers API (interception + fetch)
    originPrefix: string; // requests must originate here, e.g. https://www.easyjet.com
  };
}

// Reconstructs the env-based configuration used before per-org DB configs. Lets
// the legacy /easyjet/scrape route (and local dev) keep working unchanged.
export function buildDefaultContext(): EasyJetScrapeContext {
  const browserlessToken = process.env.BROWSERLESS_TOKEN;
  return {
    credentials: {
      username: process.env.EASYJET_TRADE_USERNAME,
      password: process.env.EASYJET_TRADE_PASSWORD,
    },
    browser: {
      backend: browserlessToken ? 'browserless' : 'local',
      browserlessToken,
      browserlessBase: process.env.BROWSERLESS_URL || 'wss://production-lon.browserless.io',
      browserlessPath: process.env.BROWSERLESS_PATH || '/chromium/stealth',
      proxy: process.env.BROWSERLESS_PROXY,
      proxyCountry: process.env.BROWSERLESS_PROXY_COUNTRY || 'gb',
      sessionTimeoutMs: Number(process.env.BROWSERLESS_TIMEOUT) || 60_000,
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
