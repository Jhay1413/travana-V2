import type { ScraperConfig } from './scraper-engine.types';

// Reference config for an easyJet-shaped supplier. Seeded for the easyJet
// supplier and usable as a starting template in the settings UI. The browser
// token itself is system infrastructure (env BROWSERLESS_TOKEN); this only
// selects the backend + proxy behaviour.
export const EASYJET_DEFAULT_CONFIG: ScraperConfig = {
  adapterType: 'easyjet',
  browser: {
    backend: 'browserless',
    browserlessPath: '/chromium/stealth',
    proxy: 'residential',
    proxyCountry: 'gb',
    sessionTimeoutMs: 60_000,
  },
  auth: {
    type: 'keycloak-form',
    loginUrl: 'https://www.easyjet.com/en/holidays/trade-portal',
    identityHost: 'identity.holidays.easyjet.com',
    usernameSelector: '#username',
    passwordSelector: '#password',
    submitSelector: '#kc-login',
    formSelector: '#kc-form-login',
    loggedInUrlIncludes: 'www.easyjet.com',
    errorSelector: '#input-error, [id^="input-error-container"] span, .pf-v5-c-alert__title',
  },
  fetch: {
    strategy: 'intercept-then-fetch',
    apiPath: '/holidays/_api/v1.0/hotel/offers',
    originPrefix: 'https://www.easyjet.com',
  },
  deepLink: {
    hostIncludes: 'easyjet.com',
    pathIncludes: '/holidays/',
  },
};

export const SUPPLIER_DEFAULTS: Record<string, { supplierName: string; config: ScraperConfig }> = {
  easyjet: { supplierName: 'easyJet holidays', config: EASYJET_DEFAULT_CONFIG },
};
