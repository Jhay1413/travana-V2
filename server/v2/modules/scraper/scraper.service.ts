import { AppError } from '../../utils/error-handler';
import { encrypt, decrypt } from '../../utils/encryption';
import type { Scope } from '../../utils/scope';
import { scraperRepository } from './scraper.repository';
import { getAdapter } from './adapters';
import { extractionAiService, loginConfigAiService } from './extraction/extraction-ai.service';
import { runExtractionSpec } from './extraction/extraction.interpreter';
import { easyjetService } from '../easyjet/easyjet.service';
import type {
  ResolvedScraper,
  ScraperAdapterType,
  ScraperConfig,
  ScraperCredentials,
} from './scraper-engine.types';
import type { ScrapedQuoteJson } from '../easyjet/easyjet.types';
import type { SupplierScraper } from '@shared/schema';

// What we return to clients: never the raw credentials, only whether each is set.
export interface SupplierScraperView {
  id: string;
  supplierKey: string;
  supplierName: string;
  adapterType: string;
  isActive: boolean;
  tourOperatorId: string | null;
  config: ScraperConfig;
  credentials: { hasUsername: boolean; hasPassword: boolean; hasApiKey: boolean; hasAbtaNumber: boolean };
  createdAt: Date;
  updatedAt: Date | null;
}

export interface UpsertSupplierScraperInput {
  supplierKey: string;
  supplierName?: string;
  adapterType?: ScraperAdapterType;
  tourOperatorId?: string | null;
  isActive?: boolean;
  config?: Partial<ScraperConfig>;
  // Credentials are optional on update — omit a field to leave it unchanged,
  // send "" to clear it.
  credentials?: ScraperCredentials;
}

// Supplier scrapers are PLATFORM-WIDE — an extraction spec describes how to
// read a portal, which is identical for every agency — so nothing below is
// scoped by organisation.

// What the user's browser captured from a rendered deal page.
export interface ImportPageInput {
  url: string;
  title?: string;
  text: string;
  images?: string[];
  flightsText?: string;
  apiJson?: unknown;
  supplierKey?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

// Is this supplier behind a login? The manual page-import path is for suppliers
// where driving a headless browser means storing credentials and fighting bot
// protection. A supplier deliberately configured for unattended scraping should
// keep using the automated /scrape path rather than being captured by hand.
function requiresLogin(resolved: ResolvedScraper): boolean {
  const type = resolved.config.auth?.type;
  if (type && type !== 'none') return true;
  const c = resolved.credentials;
  return !!(c.username || c.password || c.apiKey || c.abtaNumber);
}

// Suppliers born from a capture have no credentials and no automated config, so
// the credentialed-only rule can't apply to them — capture is the ONLY way they
// work until someone configures a login.
function isCaptureOnly(resolved: ResolvedScraper): boolean {
  return resolved.config.captureOnly === true;
}

// Turns a deal URL into a supplier identity: key/name from the registrable
// domain's main label, and a deepLink host pattern that also matches the
// portal's subdomains.
//   https://www.easyjet.com/…            → easyjet      | easyjet.com
//   https://trade.jet2holidays.com/…     → jet2holidays | jet2holidays.com
//   https://www.hoseasons.co.uk/agents   → hoseasons    | hoseasons.co.uk
export function supplierIdentityFromUrl(url: string): { key: string; name: string; hostIncludes: string } {
  const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
  const labels = host.split('.');
  // Compound public suffixes (co.uk, com.au, …) take two labels, everything else one.
  const suffixLen = labels.length > 2 && /^(co|com|org|net|gov|ac)$/.test(labels[labels.length - 2]) ? 2 : 1;
  const nameLabels = labels.slice(0, Math.max(1, labels.length - suffixLen));
  const rawKey = nameLabels[nameLabels.length - 1] || host;
  const key = rawKey.replace(/[^a-z0-9-]/g, '') || 'supplier';
  return {
    key,
    name: key.charAt(0).toUpperCase() + key.slice(1),
    hostIncludes: labels.slice(Math.max(0, labels.length - suffixLen - 1)).join('.'),
  };
}

// When the user pastes a login form (auth.loginFormHtml) but hasn't supplied the
// CSS selectors, derive them from the HTML via AI once, at save time — so the
// login is ready to run and the user never hand-writes selectors. No-op for
// no-login suppliers or when selectors are already present.
async function ensureLoginSelectors(config: ScraperConfig): Promise<void> {
  const auth = config.auth;
  if (!auth || auth.type === 'none') return;
  if (!auth.loginFormHtml) return;
  if (auth.usernameSelector && auth.passwordSelector) return;
  const sel = await loginConfigAiService.generateFromHtml(auth.loginFormHtml, auth.loginUrl);
  let identityHost = auth.identityHost;
  if (!identityHost && auth.loginUrl) {
    try {
      identityHost = new URL(auth.loginUrl).pathname;
    } catch {
      /* leave as-is */
    }
  }
  config.auth = {
    ...auth,
    usernameSelector: auth.usernameSelector || sel.usernameSelector,
    passwordSelector: auth.passwordSelector || sel.passwordSelector,
    submitSelector: auth.submitSelector || sel.submitSelector,
    abtaSelector: auth.abtaSelector || sel.abtaSelector,
    formSelector: auth.formSelector || sel.formSelector,
    errorSelector: auth.errorSelector || sel.errorSelector,
    uppercaseCredentials: auth.uppercaseCredentials ?? sel.uppercaseCredentials,
    identityHost,
  };
}

function decryptCredentials(row: SupplierScraper): ScraperCredentials {
  if (!row.encrypted_credentials) return {};
  try {
    return JSON.parse(decrypt(row.encrypted_credentials)) as ScraperCredentials;
  } catch {
    throw new AppError('Stored supplier credentials could not be decrypted (wrong EMAIL_ENCRYPTION_KEY?)', 500);
  }
}

function toView(row: SupplierScraper): SupplierScraperView {
  const creds = decryptCredentials(row);
  return {
    id: row.id,
    supplierKey: row.supplier_key,
    supplierName: row.supplier_name,
    adapterType: row.adapter_type,
    isActive: row.is_active,
    tourOperatorId: row.tour_operator_id,
    config: (row.config as ScraperConfig) ?? ({} as ScraperConfig),
    credentials: {
      hasUsername: !!creds.username,
      hasPassword: !!creds.password,
      hasApiKey: !!creds.apiKey,
      hasAbtaNumber: !!creds.abtaNumber,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const scraperService = {
  async list(scope: Scope): Promise<SupplierScraperView[]> {
    const rows = await scraperRepository.findAll();
    return rows.map(toView);
  },

  async getById(id: string, scope: Scope): Promise<SupplierScraperView> {
    const row = await scraperRepository.findById(id);
    if (!row) throw new AppError('Supplier scraper not found', 404);
    return toView(row);
  },

  async create(input: UpsertSupplierScraperInput, scope: Scope, userId?: string): Promise<SupplierScraperView> {
    const existing = await scraperRepository.findBySupplierKey(input.supplierKey);
    if (existing) throw new AppError(`A scraper for "${input.supplierKey}" already exists for this organization`, 409);

    // No supplier presets: a new scraper self-configures. It starts from whatever
    // config the caller supplies (usually empty) and the DOM adapter learns its
    // login selectors + extraction spec on the first run.
    const config: ScraperConfig = { ...((input.config as ScraperConfig | undefined) ?? ({} as ScraperConfig)) };
    // New suppliers default to the generic config-driven DOM adapter (which
    // self-learns login + extraction). easyJet's API adapter is opt-in only.
    const adapterType = input.adapterType || config.adapterType || 'dom';
    config.adapterType = adapterType;
    // Turn a pasted login form into selectors so login is ready on the first run.
    await ensureLoginSelectors(config);
    const creds = input.credentials ?? {};

    const row = await scraperRepository.create({
      supplier_key: input.supplierKey,
      supplier_name: input.supplierName || input.supplierKey,
      adapter_type: adapterType,
      tour_operator_id: input.tourOperatorId ?? null,
      is_active: input.isActive ?? true,
      config,
      encrypted_credentials: encrypt(JSON.stringify(creds)),
      created_by_user_id: userId ?? null,
    });
    return toView(row);
  },

  async update(id: string, input: UpsertSupplierScraperInput, scope: Scope): Promise<SupplierScraperView> {
    const existing = await scraperRepository.findById(id);
    if (!existing) throw new AppError('Supplier scraper not found', 404);

    // Merge credentials: only overwrite the fields actually provided, so the UI
    // can update the username without knowing the stored password.
    const patch: Record<string, unknown> = {};
    if (input.supplierName !== undefined) patch.supplier_name = input.supplierName;
    if (input.adapterType !== undefined) patch.adapter_type = input.adapterType;
    if (input.tourOperatorId !== undefined) patch.tour_operator_id = input.tourOperatorId;
    if (input.isActive !== undefined) patch.is_active = input.isActive;
    if (input.config !== undefined) {
      const merged = { ...(existing.config as ScraperConfig), ...(input.config as ScraperConfig) };
      // Merge auth deeply so a newly-pasted login form doesn't drop other auth
      // settings, then derive selectors from any new form HTML.
      if (input.config.auth || (existing.config as ScraperConfig)?.auth) {
        merged.auth = { ...((existing.config as ScraperConfig)?.auth ?? {}), ...(input.config.auth ?? {}) } as ScraperConfig['auth'];
      }
      await ensureLoginSelectors(merged);
      patch.config = merged;
    }
    if (input.credentials !== undefined) {
      const current = decryptCredentials(existing);
      const merged: ScraperCredentials = { ...current };
      for (const key of ['username', 'password', 'apiKey', 'abtaNumber'] as const) {
        if (input.credentials[key] !== undefined) merged[key] = input.credentials[key];
      }
      patch.encrypted_credentials = encrypt(JSON.stringify(merged));
    }

    const row = await scraperRepository.update(id, patch);
    if (!row) throw new AppError('Supplier scraper not found', 404);
    return toView(row);
  },

  // Marks an AI-generated extraction spec as reviewed. Specs are learned from a
  // SINGLE page and are routinely overfitted to that one deal (a literal board
  // basis, one hotel's name, one airport code), so they carry specNeedsReview
  // until a human has read them. Imports are never blocked by this — the flag
  // exists so nobody mistakes an unreviewed spec for a trusted one.
  async approveSpec(id: string, scope: Scope, approve: boolean): Promise<SupplierScraperView> {
    const existing = await scraperRepository.findById(id);
    if (!existing) throw new AppError('Supplier scraper not found', 404);

    const config = (existing.config as ScraperConfig) ?? ({} as ScraperConfig);
    if (!config.extraction) {
      throw new AppError('This supplier has no extraction spec yet — capture a deal page first.', 400);
    }

    const row = await scraperRepository.update(id, {
      config: { ...config, specNeedsReview: !approve },
    });
    if (!row) throw new AppError('Supplier scraper not found', 404);

    // Approving is the moment the spec becomes worth protecting: archive it so
    // it survives this supplier being deleted and re-captured later.
    await scraperRepository.archiveSpec({
      hostIncludes: config.deepLink?.hostIncludes ?? '',
      supplierKey: existing.supplier_key,
      extraction: config.extraction,
      approved: approve,
    });
    return toView(row);
  },

  async remove(id: string, scope: Scope): Promise<void> {
    const existing = await scraperRepository.findById(id);
    if (!existing) throw new AppError('Supplier scraper not found', 404);

    // Archive before deleting. A spec is AI-generated then hand-corrected, and
    // deleting the supplier used to throw that away — the next capture asked the
    // AI again and reproduced the same overfitted rules.
    const config = (existing.config as ScraperConfig) ?? ({} as ScraperConfig);
    if (config.extraction) {
      await scraperRepository.archiveSpec({
        hostIncludes: config.deepLink?.hostIncludes ?? '',
        supplierKey: existing.supplier_key,
        extraction: config.extraction,
        approved: config.specNeedsReview !== true,
      });
    }
    await scraperRepository.remove(id);
  },

  // Builds a ResolvedScraper from a row, wiring persistConfig so an adapter can
  // save config it learns on the first run. Accumulates: a run that learns BOTH
  // login selectors and an extraction spec persists each over the latest merged
  // config (not the original), so neither clobbers the other.
  toResolved(row: SupplierScraper): ResolvedScraper {
    let latest = ((row.config as ScraperConfig) ?? {}) as ScraperConfig;
    // Restore any saved login session (decrypt; ignore if unreadable/corrupt).
    let sessionCookies: unknown[] | undefined;
    if (row.session_state) {
      try {
        const parsed = JSON.parse(decrypt(row.session_state));
        if (Array.isArray(parsed) && parsed.length > 0) sessionCookies = parsed;
      } catch {
        /* stale/undecryptable session — ignore, a fresh login will replace it */
      }
    }
    const resolved: ResolvedScraper = {
      supplierKey: row.supplier_key,
      supplierName: row.supplier_name,
      config: latest,
      credentials: decryptCredentials(row),
      sessionCookies,
      persistConfig: async (patch) => {
        latest = { ...latest, ...patch };
        resolved.config = latest;
        await scraperRepository.update(row.id, { config: latest });
      },
      persistSession: async (cookies) => {
        const hasCookies = Array.isArray(cookies) && cookies.length > 0;
        await scraperRepository.update(row.id, {
          session_state: hasCookies ? encrypt(JSON.stringify(cookies)) : null,
          session_saved_at: hasCookies ? new Date() : null,
        });
      },
    };
    return resolved;
  },

  // Resolves a specific supplier the user chose from the dropdown.
  async resolveByKey(supplierKey: string, scope: Scope): Promise<ResolvedScraper> {
    const row = await scraperRepository.findBySupplierKey(supplierKey);
    if (!row) throw new AppError(`No supplier scraper "${supplierKey}" for this organization`, 404);
    if (!row.is_active) throw new AppError(`Supplier scraper "${row.supplier_name}" is disabled`, 400);
    return this.toResolved(row);
  },

  // Finds the org's active scraper whose deep-link pattern matches the URL.
  async resolveForUrl(url: string, scope: Scope): Promise<ResolvedScraper> {
    let host: string;
    let pathname: string;
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      throw new AppError('Invalid URL', 400);
    }

    const rows = await scraperRepository.findAllActive();
    const match = rows.find((row) => {
      const dl = (row.config as ScraperConfig)?.deepLink;
      if (!dl) return false;
      return host.includes(dl.hostIncludes) && pathname.includes(dl.pathIncludes);
    });

    if (!match) {
      throw new AppError(
        'No active supplier scraper for this organization matches that link. Add or enable one in supplier settings.',
        404,
      );
    }

    return this.toResolved(match);
  },

  // Builds a quote from a page the USER's browser captured, instead of one this
  // server rendered. Same supplier resolution, same extraction spec, same output
  // shape as scrapeFromUrl — only the source of the DOM differs. Because the
  // capture comes from a real, already-authenticated browser, this path needs no
  // credentials, no proxy, and no bot evasion, and returns in milliseconds.
  //
  // Restricted to credentialed suppliers on purpose (see requiresLogin).
  // Finds or creates the supplier a captured page belongs to. Matching is by the
  // captured URL, so the user never picks from a list: a known portal resolves
  // to its existing config, and an unrecognised one gets a supplier created from
  // its domain, ready for the spec to be learned below.
  async resolveOrCreateForCapture(
    url: string,
    scope: Scope,
    userId?: string,
  ): Promise<{ resolved: ResolvedScraper; created: boolean }> {
    try {
      return { resolved: await this.resolveForUrl(url, scope), created: false };
    } catch (err) {
      // Anything other than "no supplier matches this link" is a real failure
      // (disabled supplier, bad URL, DB error) and must not create a duplicate.
      if (!(err instanceof AppError) || err.statusCode !== 404) throw err;
    }

    let identity: ReturnType<typeof supplierIdentityFromUrl>;
    try {
      identity = supplierIdentityFromUrl(url);
    } catch {
      throw new AppError('The captured page has an invalid URL, so no supplier could be identified', 400);
    }

    // A supplier for this portal may already exist but be invisible to URL
    // matching because it has no deepLink (hand-made configs often don't).
    // ADOPT it — give it the deepLink it was missing — rather than creating a
    // near-duplicate that splits the same portal across two suppliers.
    const existing = await scraperRepository.findBySupplierKey(identity.key);
    if (existing && !(existing.config as ScraperConfig)?.deepLink?.hostIncludes) {
      const adopted = {
        ...((existing.config as ScraperConfig) ?? {}),
        deepLink: { hostIncludes: identity.hostIncludes, pathIncludes: '' },
      } as ScraperConfig;
      const row = await scraperRepository.update(existing.id, { config: adopted });
      if (row) return { resolved: this.toResolved(row), created: false };
    }

    // Otherwise the key is taken by a supplier that genuinely points elsewhere
    // (a second portal on another domain) — suffix rather than collide.
    let key = identity.key;
    for (let n = 2; await scraperRepository.findBySupplierKey(key); n++) key = `${identity.key}-${n}`;

    const row = await scraperRepository.create({
      supplier_key: key,
      supplier_name: identity.name,
      adapter_type: 'dom',
      is_active: true,
      config: {
        adapterType: 'dom',
        deepLink: { hostIncludes: identity.hostIncludes, pathIncludes: '' },
        // Created from a capture: no login is configured, and until one is this
        // supplier can only be imported by capturing pages.
        auth: { type: 'none' },
        captureOnly: true,
        // The spec below is AI-generated from a single page — flag it so it gets
        // a human read before anyone trusts it in bulk.
        specNeedsReview: true,
      } as ScraperConfig,
      encrypted_credentials: encrypt(JSON.stringify({})),
      created_by_user_id: userId ?? null,
    });

    return { resolved: this.toResolved(row), created: true };
  },

  async importFromPage(
    input: ImportPageInput,
    scope: Scope,
    userId?: string,
  ): Promise<{
    quote: ScrapedQuoteJson;
    supplierKey: string;
    supplierName: string;
    created: boolean;
    specGenerated: boolean;
    // True when the spec used has not been approved yet — the caller warns, but
    // the import still goes through.
    specNeedsReview: boolean;
    // A previously archived spec was restored instead of asking the AI.
    specRestored: boolean;
  }> {
    // An explicit supplier still wins (re-importing into a known config), but
    // the default is to work it out from the captured URL.
    let resolved: ResolvedScraper;
    let created = false;
    if (input.supplierKey) {
      resolved = await this.resolveByKey(input.supplierKey, scope);
    } else {
      ({ resolved, created } = await this.resolveOrCreateForCapture(input.url, scope, userId));
    }

    if (!requiresLogin(resolved) && !isCaptureOnly(resolved)) {
      throw new AppError(
        `"${resolved.supplierName}" is configured for automated scraping, so it does not need a manual capture — ` +
          'import it with the normal Import button and the server will scrape it directly.',
        400,
      );
    }

    // Guard: the capture must come from the chosen supplier's own site. Only
    // reachable when a supplier was named explicitly — auto-detection matches on
    // the URL by definition — but without it, naming the wrong supplier would
    // run its spec over a foreign page and, if it had none, LEARN one from it.
    const deepLink = resolved.config.deepLink;
    if (deepLink?.hostIncludes) {
      let host: string;
      try {
        host = new URL(input.url).hostname;
      } catch {
        throw new AppError('The captured page has an invalid URL', 400);
      }
      if (!host.includes(deepLink.hostIncludes)) {
        throw new AppError(
          `That capture came from "${host}", which isn't ${resolved.supplierName}'s site. ` +
            'Capture the deal again from the right portal.',
          400,
        );
      }
    }

    // A capture from the wrong tab (a dashboard, a search page) produces a spec
    // or a quote built on nothing — reject it rather than return a junk quote.
    if (input.text.trim().length < 200) {
      throw new AppError(
        'The captured page had almost no text — make sure the deal page is open and fully loaded (with the price showing), then capture again.',
        400,
      );
    }

    const images = (input.images ?? []).filter((s) => s && !s.startsWith('data:')).map((src) => ({ src }));
    const title = input.title ?? '';

    // First capture for this supplier: learn the extraction spec from THIS page
    // and persist it, exactly as the automated DOM path does on its first run —
    // so every later import is pure interpretation with no AI cost.
    // A spec that already exists is NEVER regenerated — least of all an approved
    // one. When there is none, a previously archived spec for this host is
    // restored in preference to asking the AI: the archive holds work a human
    // has already corrected, and regenerating reliably reproduces the same
    // overfitted rules that correction removed.
    let spec = resolved.config.extraction;
    let specGenerated = false;
    let specRestored = false;

    if (!spec) {
      const archived = await scraperRepository.findArchivedSpec(resolved.config.deepLink?.hostIncludes ?? '');
      if (archived?.extraction) {
        spec = archived.extraction as ScraperConfig['extraction'];
        specRestored = true;
        if (resolved.persistConfig) {
          await resolved.persistConfig({ extraction: spec, specNeedsReview: !archived.approved });
        }
      }
    }

    if (!spec) {
      specGenerated = true;
      spec = await extractionAiService.generateSpecFromDom(
        { title, text: input.text, url: input.url, apiJson: input.apiJson },
        resolved.supplierName,
      );
      // A freshly-learned spec is derived from ONE page, so it can be overfitted
      // to that deal (a literal board basis, this hotel's name, one airport).
      // Flag it for a human read; clearing the flag is the approve action.
      if (resolved.persistConfig) await resolved.persistConfig({ extraction: spec, specNeedsReview: true });
    }

    const quote = runExtractionSpec(
      spec,
      { title, text: input.text, url: input.url, apiJson: input.apiJson, images, flightsText: input.flightsText },
      new Date().toISOString(),
    );
    // Occupancy from the quote form overrides whatever was parsed, when provided.
    if (input.adults != null) quote.adults = input.adults;
    if (input.children != null) quote.children = input.children;
    if (input.infants != null) quote.infants = input.infants;
    return {
      quote,
      supplierKey: resolved.supplierKey,
      supplierName: resolved.supplierName,
      created,
      specGenerated,
      specRestored,
      specNeedsReview: resolved.config.specNeedsReview === true,
    };
  },

  // Resolves the supplier for the URL, then runs its adapter. Falls back to the
  // env-based easyJet path when the org has no matching DB config yet (e.g.
  // before the table is seeded), so imports keep working during the migration.
  async scrapeFromUrl(
    url: string,
    scope: Scope,
    occupancy?: { adults?: number; children?: number; infants?: number },
    supplierKey?: string,
  ): Promise<ScrapedQuoteJson> {
    let resolved: ResolvedScraper;
    try {
      // Explicit supplier chosen in the UI → use it directly; otherwise match by URL.
      resolved = supplierKey
        ? await this.resolveByKey(supplierKey, scope)
        : await this.resolveForUrl(url, scope);
    } catch (err) {
      const noMatch = err instanceof AppError && err.statusCode === 404;
      // 42P01 = undefined_table: the migration hasn't been applied yet.
      const tableMissing = (err as { code?: string })?.code === '42P01';
      const looksEasyJet = url.includes('easyjet.com') && url.includes('/holidays/');
      const hasEnvCreds = !!process.env.EASYJET_TRADE_USERNAME && !!process.env.EASYJET_TRADE_PASSWORD;
      if ((noMatch || tableMissing) && looksEasyJet && hasEnvCreds) {
        // Env-configured easyJet (buildDefaultContext) as a transitional fallback.
        return easyjetService.scrapeQuoteFromLink({ url, ...occupancy });
      }
      throw err;
    }

    // Default to the generic DOM adapter — easyJet's API adapter is a special
    // case used only when adapterType is explicitly 'easyjet'.
    const adapter = getAdapter((resolved.config.adapterType || 'dom') as ScraperAdapterType);
    if (!adapter) {
      throw new AppError(`No scraper adapter registered for type "${resolved.config.adapterType}"`, 500);
    }
    return adapter.scrape(url, resolved, occupancy);
  },
};
