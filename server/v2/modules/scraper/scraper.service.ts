import { AppError } from '../../utils/error-handler';
import { encrypt, decrypt } from '../../utils/encryption';
import type { Scope } from '../../utils/scope';
import { scraperRepository } from './scraper.repository';
import { getAdapter } from './adapters';
import { SUPPLIER_DEFAULTS } from './scraper-defaults';
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
  credentials: { hasUsername: boolean; hasPassword: boolean; hasApiKey: boolean };
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

    const defaults = SUPPLIER_DEFAULTS[input.supplierKey];
    const config: ScraperConfig = {
      ...(defaults?.config ?? ({} as ScraperConfig)),
      ...(input.config as ScraperConfig | undefined),
    };
    const creds = input.credentials ?? {};

    const row = await scraperRepository.create({
      org_id: orgId,
      supplier_key: input.supplierKey,
      supplier_name: input.supplierName || defaults?.supplierName || input.supplierKey,
      adapter_type: input.adapterType || config.adapterType || 'easyjet',
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
      patch.config = { ...(existing.config as ScraperConfig), ...(input.config as ScraperConfig) };
    }
    if (input.credentials !== undefined) {
      const current = decryptCredentials(existing);
      const merged: ScraperCredentials = { ...current };
      for (const key of ['username', 'password', 'apiKey'] as const) {
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

  // Resolves a specific supplier the user chose from the dropdown.
  async resolveByKey(supplierKey: string, scope: Scope): Promise<ResolvedScraper> {
    const orgId = requireOrg(scope);
    const row = await scraperRepository.findBySupplierKey(orgId, supplierKey);
    if (!row) throw new AppError(`No supplier scraper "${supplierKey}" for this organization`, 404);
    if (!row.is_active) throw new AppError(`Supplier scraper "${row.supplier_name}" is disabled`, 400);
    return {
      supplierKey: row.supplier_key,
      supplierName: row.supplier_name,
      config: row.config as ScraperConfig,
      credentials: decryptCredentials(row),
    };
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

    return {
      supplierKey: match.supplier_key,
      supplierName: match.supplier_name,
      config: match.config as ScraperConfig,
      credentials: decryptCredentials(match),
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

    const adapter = getAdapter((resolved.config.adapterType || 'easyjet') as ScraperAdapterType);
    if (!adapter) {
      throw new AppError(`No scraper adapter registered for type "${resolved.config.adapterType}"`, 500);
    }
    return adapter.scrape(url, resolved, occupancy);
  },
};
