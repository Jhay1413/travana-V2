// ─── Config-driven supplier scraper engine ───────────────────────────────────
//
// A supplier (easyJet, TUI, …) is described by a ScraperConfig stored per-org
// in the database. Credentials are stored encrypted and decrypted only at use.
//
// "Config-driven" with an adapter hook: the config captures everything that is
// data (URLs, selectors, proxy, endpoints, credentials), while `adapterType`
// selects the code path that knows how to drive that supplier's shape. Most
// trade portals share the easyJet shape (form login → JSON offers API), so they
// reuse one adapter purely by config; a genuinely different supplier ships a
// small new adapter while still using this same store and resolution flow.

import type { ScrapedQuoteJson } from '../easyjet/easyjet.types';

// Which code adapter interprets this config. Add a value when a supplier's
// login/fetch shape can't be expressed by an existing adapter's config.
export type ScraperAdapterType = 'easyjet';

export interface ScraperCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
}

export interface BrowserConfig {
  // 'browserless' → remote cloud Chrome (residential proxy, beats Akamai);
  // 'local' → Chrome on this machine.
  backend: 'browserless' | 'local';
  browserlessPath?: string; // e.g. "/chromium/stealth"
  proxy?: string; // e.g. "residential"
  proxyCountry?: string; // e.g. "gb"
  sessionTimeoutMs?: number; // Browserless per-session cap (plan-dependent)
  headless?: boolean; // local backend only
}

export interface AuthConfig {
  // How the supplier authenticates. 'keycloak-form' covers easyJet (Red Hat SSO
  // form). 'none' for public endpoints; 'api-key' for header/token auth.
  type: 'keycloak-form' | 'basic-form' | 'api-key' | 'none';
  loginUrl?: string; // page to open that triggers the login flow
  identityHost?: string; // host that indicates we're on the login page (e.g. Keycloak)
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  formSelector?: string; // presence = login form is showing
  // A substring the post-login URL contains when authenticated (success marker).
  loggedInUrlIncludes?: string;
  errorSelector?: string; // element holding a login error message
}

export interface FetchConfig {
  // 'intercept-then-fetch' — navigate to the deep link, capture the page's own
  // API response, else fire an in-page fetch of the rebuilt API URL (easyJet).
  strategy: 'intercept-then-fetch' | 'intercept' | 'fetch';
  apiPath: string; // substring identifying the offers/deal API (for interception + fetch)
  originPrefix: string; // e.g. "https://www.easyjet.com" — requests must originate here
}

export interface DeepLinkConfig {
  hostIncludes: string; // e.g. "easyjet.com"
  pathIncludes: string; // e.g. "/holidays/"
}

// The full per-supplier config (the `config` JSONB column). Credentials live in
// separate encrypted columns and are injected as `credentials` at resolve time.
export interface ScraperConfig {
  adapterType: ScraperAdapterType;
  browser: BrowserConfig;
  auth: AuthConfig;
  fetch: FetchConfig;
  deepLink: DeepLinkConfig;
}

// A config resolved for a specific org + supplier, ready to run: parsed config
// plus decrypted credentials.
export interface ResolvedScraper {
  supplierKey: string; // stable id, e.g. "easyjet"
  supplierName: string; // display, e.g. "easyJet holidays"
  config: ScraperConfig;
  credentials: ScraperCredentials;
}

// Every supplier adapter implements this. Given a deep link and the resolved
// config, it returns the quote-form-ready ScraperJson.
export interface ScraperAdapter {
  type: ScraperAdapterType;
  scrape(
    deepLinkUrl: string,
    resolved: ResolvedScraper,
    occupancy?: { adults?: number; children?: number; infants?: number },
  ): Promise<ScrapedQuoteJson>;
}
