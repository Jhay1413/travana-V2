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
import type { ExtractionSpec } from './extraction/extraction.types';

// Which code adapter interprets this config.
//  • 'easyjet' — form login → JSON offers API (interception).
//  • 'dom' — generic: form login → wait for the deal page to render → apply the
//    declarative `extraction` spec to the DOM. Any DOM supplier uses this.
//  • 'jet2' — legacy alias kept for existing rows; handled by the 'dom' adapter.
export type ScraperAdapterType = 'easyjet' | 'dom' | 'jet2';

export interface ScraperCredentials {
  username?: string;
  password?: string;
  apiKey?: string;
  // Extra login identifier some trade portals require (e.g. Jet2's ABTA number).
  abtaNumber?: string;
}

export interface BrowserConfig {
  // 'browserless' → remote cloud Chrome (residential proxy, beats Akamai);
  // 'steel' → remote Chrome via Steel (cloud or self-hosted; API keys/URLs are
  //   system infrastructure from env, like the Browserless token);
  // 'local' → Chrome on this machine.
  // Env SCRAPER_BROWSER_BACKEND, when set, overrides this per-supplier value.
  backend: 'browserless' | 'steel' | 'local';
  browserlessPath?: string; // e.g. "/chromium/stealth" (browserless only)
  // How many scrapes for this supplier may run concurrently (default 1). Logins
  // always run alone. Env SCRAPER_MAX_CONCURRENT, when set, overrides this.
  // Keep at or below the browser provider's concurrent-session limit.
  maxConcurrent?: number;
  proxy?: string; // e.g. "residential"
  proxyCountry?: string; // e.g. "gb" (browserless only; for steel use STEEL_PROXY_URL)
  sessionTimeoutMs?: number; // remote per-session cap (plan-dependent)
  headless?: boolean; // local backend only
}

export interface AuthConfig {
  // How the supplier authenticates. 'keycloak-form' covers easyJet (Red Hat SSO
  // form). 'none' for public endpoints; 'api-key' for header/token auth.
  type: 'keycloak-form' | 'basic-form' | 'api-key' | 'none';
  loginUrl?: string; // page to open that triggers the login flow
  // Go to loginUrl and authenticate FIRST, then navigate to the deal — for
  // portals where the deal link does NOT redirect to a login form (it lands on a
  // home/search page instead), so login can't be auto-detected from the deal.
  // When false/unset the flow is deal-first (the deal redirects to login).
  loginFirst?: boolean;
  identityHost?: string; // host that indicates we're on the login page (e.g. Keycloak)
  usernameSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
  // Optional extra field filled from credentials.abtaNumber (e.g. Jet2's ABTA No.).
  abtaSelector?: string;
  formSelector?: string; // presence = login form is showing
  // A substring the post-login URL contains when authenticated (success marker).
  loggedInUrlIncludes?: string;
  errorSelector?: string; // element holding a login error message
  uppercaseCredentials?: boolean; // portal requires UPPERCASE input (e.g. Hoseasons)
  // Raw HTML of the login form, kept for reference/documentation and to make
  // the selectors above easy to re-derive if the portal changes. Not executed.
  loginFormHtml?: string;
}

export interface FetchConfig {
  // 'intercept-then-fetch' — navigate to the deep link, capture the page's own
  // API response, else fire an in-page fetch of the rebuilt API URL (easyJet).
  strategy: 'intercept-then-fetch' | 'intercept' | 'fetch';
  apiPath: string; // substring identifying the offers/deal API (for interception + fetch)
  originPrefix: string; // e.g. "https://www.easyjet.com" — requests must originate here
}

// An authed JSON price API keyed by an id that lives on the property page rather
// than in the deal URL (Hoseasons). Flow: log in → open the PARAM-LESS property
// page (the priced ?params URL redirects to login, the bare one doesn't) →
// discover the id from that page (intercept its own AJAX, else regex the HTML) →
// fire the price AJAX with the deal's dates/occupancy → parse the price array.
export interface PriceApiConfig {
  // Substring identifying the price AJAX, both to intercept the page's own call
  // (to learn the URL template + id) and to fire our own (e.g.
  // "HoseasonsRequestHandler.ashx").
  apiPathMatch: string;
  // Name of the id query-param the AJAX needs but the deal URL lacks (e.g.
  // "WebsiteID"). Discovered from the intercepted call or the page HTML.
  idParam?: string;
  // Fallback regex (group 1 = the id) to find the id in the property-page HTML
  // when no self-fired AJAX was intercepted.
  idRegex?: string;
  // URL template used when the page fired no AJAX to copy. {placeholders} are
  // filled from the deal URL's query params plus the discovered id. Absolute or
  // origin-relative.
  urlTemplate?: string;
  currency?: string; // default GBP
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
  // For the 'dom' adapter: the declarative rules that turn the rendered page
  // into a quote. Generated by AI, applied by the fixed interpreter.
  extraction?: ExtractionSpec;
  // For the 'dom' adapter: when set, the deal is priced via an authed JSON API
  // keyed by a property-page id (Hoseasons) instead of by scraping the DOM.
  priceApi?: PriceApiConfig;
  // Created automatically from a captured page (see importFromPage): no login is
  // configured, so capture is the only way to import it until someone adds one.
  // Exempts the supplier from the "credentialed suppliers only" capture rule.
  captureOnly?: boolean;
  // The extraction spec was AI-generated from a SINGLE page and hasn't been
  // reviewed. Specs learned this way are routinely overfitted to that one deal
  // (a literal board basis, one hotel's name, one airport code), so this marks
  // them for a human read. Cleared by editing the supplier config.
  specNeedsReview?: boolean;
}

// A config resolved for a specific org + supplier, ready to run: parsed config
// plus decrypted credentials.
export interface ResolvedScraper {
  supplierKey: string; // stable id, e.g. "easyjet"
  supplierName: string; // display, e.g. "easyJet holidays"
  config: ScraperConfig;
  credentials: ScraperCredentials;
  // Persists config the adapter LEARNS on the first run (e.g. an AI-generated
  // extraction spec) back to the supplier row, so later scrapes reuse it. Only
  // the first scrape pays the AI cost; the URL that makes generation possible
  // arrives with the scrape, not at supplier-creation time.
  persistConfig?: (patch: Partial<ScraperConfig>) => Promise<void>;
  // Browser cookies saved after a previous successful login (decrypted). When
  // present, the adapter restores them to skip login. Opaque puppeteer cookies.
  sessionCookies?: unknown[];
  // Persists the cookies captured after a fresh login, so the NEXT scrape can
  // restore the session and skip login. Pass [] to clear an expired session.
  persistSession?: (cookies: unknown[]) => Promise<void>;
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
