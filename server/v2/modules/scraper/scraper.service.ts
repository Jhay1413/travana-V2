import { AppError } from '../../utils/error-handler';
import { encrypt, decrypt } from '../../utils/encryption';
import type { Scope } from '../../utils/scope';
import { scraperRepository } from './scraper.repository';
import { getAdapter } from './adapters';
import { loginConfigAiService } from './extraction/extraction-ai.service';
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

function requireOrg(scope: Scope): string {
  if (!scope.orgId) throw new AppError('An organization context is required for supplier scrapers', 403);
  return scope.orgId;
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
    const rows = await scraperRepository.findAllByOrg(requireOrg(scope));
    return rows.map(toView);
  },

  async getById(id: string, scope: Scope): Promise<SupplierScraperView> {
    const row = await scraperRepository.findById(id, requireOrg(scope));
    if (!row) throw new AppError('Supplier scraper not found', 404);
    return toView(row);
  },

  async create(input: UpsertSupplierScraperInput, scope: Scope, userId?: string): Promise<SupplierScraperView> {
    const orgId = requireOrg(scope);
    const existing = await scraperRepository.findBySupplierKey(orgId, input.supplierKey);
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
      org_id: orgId,
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
    const orgId = requireOrg(scope);
    const existing = await scraperRepository.findById(id, orgId);
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

    const row = await scraperRepository.update(id, orgId, patch);
    if (!row) throw new AppError('Supplier scraper not found', 404);
    return toView(row);
  },

  async remove(id: string, scope: Scope): Promise<void> {
    const orgId = requireOrg(scope);
    const existing = await scraperRepository.findById(id, orgId);
    if (!existing) throw new AppError('Supplier scraper not found', 404);
    await scraperRepository.remove(id, orgId);
  },

  // Builds a ResolvedScraper from a row, wiring persistConfig so an adapter can
  // save config it learns on the first run. Accumulates: a run that learns BOTH
  // login selectors and an extraction spec persists each over the latest merged
  // config (not the original), so neither clobbers the other.
  toResolved(row: SupplierScraper, orgId: string): ResolvedScraper {
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
        await scraperRepository.update(row.id, orgId, { config: latest });
      },
      persistSession: async (cookies) => {
        const hasCookies = Array.isArray(cookies) && cookies.length > 0;
        await scraperRepository.update(row.id, orgId, {
          session_state: hasCookies ? encrypt(JSON.stringify(cookies)) : null,
          session_saved_at: hasCookies ? new Date() : null,
        });
      },
    };
    return resolved;
  },

  // Resolves a specific supplier the user chose from the dropdown.
  async resolveByKey(supplierKey: string, scope: Scope): Promise<ResolvedScraper> {
    const orgId = requireOrg(scope);
    const row = await scraperRepository.findBySupplierKey(orgId, supplierKey);
    if (!row) throw new AppError(`No supplier scraper "${supplierKey}" for this organization`, 404);
    if (!row.is_active) throw new AppError(`Supplier scraper "${row.supplier_name}" is disabled`, 400);
    return this.toResolved(row, orgId);
  },

  // Finds the org's active scraper whose deep-link pattern matches the URL.
  async resolveForUrl(url: string, scope: Scope): Promise<ResolvedScraper> {
    const orgId = requireOrg(scope);
    let host: string;
    let pathname: string;
    try {
      const parsed = new URL(url);
      host = parsed.hostname;
      pathname = parsed.pathname;
    } catch {
      throw new AppError('Invalid URL', 400);
    }

    const rows = await scraperRepository.findActiveByOrg(orgId);
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

    return this.toResolved(match, orgId);
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
