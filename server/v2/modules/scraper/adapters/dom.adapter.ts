import { AppError } from '../../../utils/error-handler';
import { scrapeViaDom, captureRenderedDom, captureFlightModal, looksBotBlocked } from '../../easyjet/easyjet-browser';
import {
  buildDefaultContext,
  resolveBackend,
  resolveMaxConcurrent,
  resolveSessionTimeoutMs,
  type EasyJetScrapeContext,
} from '../../easyjet/easyjet.context';
import { runExtractionSpec } from '../extraction/extraction.interpreter';
import { extractionAiService, loginConfigAiService } from '../extraction/extraction-ai.service';
import { runPriceApi } from './price-api';
import type { ResolvedScraper, ScraperAdapter } from '../scraper-engine.types';

// First-run login learning: turn a login form's HTML into selectors (AI), derive
// the login-page marker + URL, persist for later runs, and return the selectors
// so this run can log in immediately.
function makeLearnLogin(resolved: ResolvedScraper) {
  return async (loginFormHtml: string, loginUrl: string) => {
    const selectors = await loginConfigAiService.generateFromHtml(loginFormHtml, loginUrl);
    let identityHost = '';
    try {
      identityHost = new URL(loginUrl).pathname; // e.g. "/tslogin" — marks the login page
    } catch {
      /* leave empty */
    }
    const authPatch = {
      usernameSelector: selectors.usernameSelector,
      passwordSelector: selectors.passwordSelector,
      submitSelector: selectors.submitSelector,
      abtaSelector: selectors.abtaSelector,
      formSelector: selectors.formSelector,
      errorSelector: selectors.errorSelector,
      uppercaseCredentials: selectors.uppercaseCredentials,
      identityHost,
      loginUrl,
    };
    if (resolved.persistConfig) {
      await resolved.persistConfig({ auth: { ...(resolved.config.auth ?? {}), type: 'basic-form', ...authPatch } });
    }
    return authPatch;
  };
}

// Builds the browser context straight from the stored config (DOM suppliers
// carry all auth/browser settings in config; only the Browserless token is
// system infrastructure, from env).
export function buildContext(resolved: ResolvedScraper): EasyJetScrapeContext {
  const env = buildDefaultContext();
  const { browser: b, auth: a, fetch: f } = resolved.config;
  return {
    credentials: {
      username: resolved.credentials.username,
      password: resolved.credentials.password,
      abtaNumber: resolved.credentials.abtaNumber,
    },
    // Concurrency-gate key: scrapes of the same supplier share its limit;
    // different suppliers run in parallel.
    queueKey: resolved.supplierKey,
    browser: {
      // Global system defaults (from env) apply when the supplier config is
      // empty — so a brand-new supplier with no preset still gets the
      // anti-bot residential proxy and stealth setup, not a bare browser.
      // Per-supplier backend wins; SCRAPER_BROWSER_BACKEND (env) is the default.
      backend: resolveBackend(b?.backend) || env.browser.backend,
      browserlessToken: process.env.BROWSERLESS_TOKEN,
      browserlessBase: env.browser.browserlessBase,
      steelApiUrl: env.browser.steelApiUrl, // system infra, like the token
      steelApiKey: env.browser.steelApiKey,
      steelProxyUrl: env.browser.steelProxyUrl,
      browserlessPath: b?.browserlessPath || env.browser.browserlessPath,
      proxy: b?.proxy ?? env.browser.proxy,
      proxyCountry: b?.proxyCountry || env.browser.proxyCountry,
      // SCRAPER_SESSION_TIMEOUT_MS (env) overrides the per-supplier DB value.
      sessionTimeoutMs: resolveSessionTimeoutMs(b?.sessionTimeoutMs) || env.browser.sessionTimeoutMs,
      // SCRAPER_MAX_CONCURRENT (env) overrides the per-supplier DB value.
      maxConcurrent: resolveMaxConcurrent(b?.maxConcurrent),
      headless: b?.headless ?? env.browser.headless,
      chromePath: env.browser.chromePath,
    },
    auth: {
      loginUrl: a?.loginUrl || '',
      loginFirst: a?.loginFirst,
      identityHost: a?.identityHost || '',
      usernameSelector: a?.usernameSelector || '',
      passwordSelector: a?.passwordSelector || '',
      submitSelector: a?.submitSelector || '',
      abtaSelector: a?.abtaSelector,
      formSelector: a?.formSelector || a?.usernameSelector || '',
      errorSelector: a?.errorSelector,
      uppercaseCredentials: a?.uppercaseCredentials,
    },
    fetch: {
      apiPath: f?.apiPath || '/api/',
      originPrefix: f?.originPrefix || '',
    },
    // Session reuse: restore cookies from a prior login and persist fresh ones.
    sessionCookies: resolved.sessionCookies,
    persistSession: resolved.persistSession,
  };
}

// Generic DOM adapter: login → render → apply the declarative extraction spec.
// Works for any supplier whose config carries an `extraction` spec (Jet2, …).
export const domAdapter: ScraperAdapter = {
  type: 'dom',
  async scrape(deepLinkUrl, resolved, occupancy) {
    const ctx = buildContext(resolved);

    // Price-API supplier: the deal is priced via an authed JSON endpoint keyed by
    // an id on the property page, not by scraping the DOM. Entirely config-driven
    // (config.priceApi is set per-supplier in the DB) — no supplier hardcoding.
    // Log in, open the PARAM-LESS property page, then fire the price AJAX.
    const priceApi = resolved.config.priceApi;
    if (priceApi) {
      return scrapeViaDom(
        deepLinkUrl,
        ctx,
        async (page, _apiJson, apiUrl) => {
          const quote = await runPriceApi(page, apiUrl, deepLinkUrl, priceApi, resolved.supplierName);
          if (occupancy?.adults != null) quote.adults = occupancy.adults;
          if (occupancy?.children != null) quote.children = occupancy.children;
          if (occupancy?.infants != null) quote.infants = occupancy.infants;
          return quote;
        },
        { navigateBase: true },
      );
    }

    const existingSpec = resolved.config.extraction;
    // Wait config comes from the spec if we have one, else sensible defaults so
    // the first (spec-learning) run can still tell when the page has rendered.
    const waitRe = existingSpec?.wait?.textMatches ?? '£\\s?[\\d,]{2,}';
    const waitMs = existingSpec?.wait?.timeoutMs ?? 30_000;

    return scrapeViaDom(deepLinkUrl, ctx, async (page, apiJson) => {
      // Wait for the priced quote to render, then snapshot title + innerText
      // (resilient to the page still redirecting).
      const snap = await captureRenderedDom(page, waitRe, waitMs);

      // Guard: bot-protection interstitial (Akamai "Access Denied", etc.). Fail
      // loudly rather than learning a spec from — or returning a quote built on —
      // the block page (which is why price/flights come back empty).
      if (looksBotBlocked(snap.title, snap.text)) {
        throw new AppError(
          'The supplier blocked the request with bot protection (e.g. Akamai "Access Denied"). This site needs a residential proxy egress — the current browser/proxy was refused, so no deal data could be read.',
          502,
        );
      }

      // Guard: if the captured page still shows the login form, we never reached
      // the deal — don't scrape (or worse, learn a spec from) the login page.
      if (ctx.auth.passwordSelector) {
        const stillOnLogin = await page.$(ctx.auth.passwordSelector).then(Boolean).catch(() => false);
        if (stillOnLogin) {
          throw new AppError(
            'Still on the supplier login page after logging in — the credentials were likely rejected (this portal may require UPPERCASE input) or the session did not persist. Fix the credentials and retry.',
            502,
          );
        }
      }

      // An (almost) empty snapshot means the page never rendered — usually the
      // remote browser session hit its time cap and died mid-scrape. Fail loudly
      // rather than running the extraction spec over nothing and returning a
      // junk quote as success.
      if ((!snap.text || snap.text.trim().length < 50) && apiJson == null) {
        throw new AppError(
          'Could not read the supplier page (the browser session likely hit its time cap before the page rendered). ' +
            'Raise SCRAPER_SESSION_TIMEOUT_MS if your browser plan allows longer sessions, then retry.',
          502,
        );
      }

      // First run for this supplier: no spec exists yet (we had no URL/DOM at
      // create time). Generate one from THIS rendered page (and any captured API
      // JSON) via AI and save it, so every later scrape reuses it with no AI cost.
      let spec = existingSpec;
      if (!spec) {
        spec = await extractionAiService.generateSpecFromDom(
          { title: snap.title, text: snap.text, url: deepLinkUrl, apiJson, headings: snap.headings },
          resolved.supplierName,
        );
        if (resolved.persistConfig) await resolved.persistConfig({ extraction: spec });
      }

      // Open the flight-details modal for real flight times + destination airport
      // — only if the spec says the portal has such a control (spec-driven; the
      // trigger wording lives in the generated spec, not in code).
      const flightsText = await captureFlightModal(page, spec.flightModalTrigger);

      // API-first, DOM fills the gaps (per-field, inside the interpreter). The
      // captured <img> list feeds the hotel gallery + destination airport, and
      // the modal text feeds real flight times — neither is in innerText.
      const quote = runExtractionSpec(
        spec,
        { title: snap.title, text: snap.text, url: deepLinkUrl, apiJson, images: snap.images, headings: snap.headings, flightsText },
        new Date().toISOString(),
      );
      // Occupancy from the quote form overrides what we parsed, when provided.
      if (occupancy?.adults != null) quote.adults = occupancy.adults;
      if (occupancy?.children != null) quote.children = occupancy.children;
      if (occupancy?.infants != null) quote.infants = occupancy.infants;
      return quote;
    }, { learnLogin: makeLearnLogin(resolved) });
  },
};
