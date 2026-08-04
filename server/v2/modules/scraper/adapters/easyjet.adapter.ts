import { easyjetService } from '../../easyjet/easyjet.service';
import { buildDefaultContext, type EasyJetScrapeContext } from '../../easyjet/easyjet.context';
import type { ScrapedQuoteJson } from '../../easyjet/easyjet.types';
import type { ResolvedScraper, ScraperAdapter } from '../scraper-engine.types';

// Turns a resolved DB config into the browser worker's context. DB config wins
// over env defaults; the Browserless token stays system infrastructure (env).
function buildContext(resolved: ResolvedScraper): EasyJetScrapeContext {
  const env = buildDefaultContext();
  const { browser: b, auth: a, fetch: f } = resolved.config;
  return {
    credentials: resolved.credentials,
    browser: {
      backend: b?.backend || env.browser.backend,
      browserlessToken: process.env.BROWSERLESS_TOKEN, // system infra
      browserlessBase: env.browser.browserlessBase,
      browserlessPath: b?.browserlessPath || env.browser.browserlessPath,
      proxy: b?.proxy ?? env.browser.proxy,
      proxyCountry: b?.proxyCountry || env.browser.proxyCountry,
      sessionTimeoutMs: b?.sessionTimeoutMs || env.browser.sessionTimeoutMs,
      headless: b?.headless ?? env.browser.headless,
      chromePath: env.browser.chromePath,
      userDataDir: env.browser.userDataDir,
    },
    auth: {
      loginUrl: a?.loginUrl || env.auth.loginUrl,
      identityHost: a?.identityHost || env.auth.identityHost,
      usernameSelector: a?.usernameSelector || env.auth.usernameSelector,
      passwordSelector: a?.passwordSelector || env.auth.passwordSelector,
      submitSelector: a?.submitSelector || env.auth.submitSelector,
      formSelector: a?.formSelector || env.auth.formSelector,
      errorSelector: a?.errorSelector || env.auth.errorSelector,
    },
    fetch: {
      apiPath: f?.apiPath || env.fetch.apiPath,
      originPrefix: f?.originPrefix || env.fetch.originPrefix,
    },
  };
}

export const easyjetAdapter: ScraperAdapter = {
  type: 'easyjet',
  async scrape(deepLinkUrl, resolved, occupancy): Promise<ScrapedQuoteJson> {
    const ctx = buildContext(resolved);
    return easyjetService.scrapeQuoteFromLink({ url: deepLinkUrl, ...occupancy }, ctx);
  },
};
