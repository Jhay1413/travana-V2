import { AppError } from '../../utils/error-handler';
import { encrypt, decrypt } from '../../utils/encryption';
import { hasAnyRole, type Scope } from '../../utils/scope';
import { scraperRepository } from './scraper.repository';
import { getAdapter } from './adapters';
import { extractionAiService, loginConfigAiService } from './extraction/extraction-ai.service';
import { runExtractionSpec } from './extraction/extraction.interpreter';
import { validateQuote, type ValidationResult } from './extraction/extraction.validate';
import {
  deriveSpecFromPicks,
  mergePickedIntoSpec,
  type DerivationProblem,
  type MergeResult,
  type PickedField,
  type PickerCaptureContext,
} from './extraction/picker-spec';
import { easyjetService } from '../easyjet/easyjet.service';
import type {
  ResolvedScraper,
  ScraperAdapterType,
  ScraperConfig,
  ScraperCredentials,
} from './scraper-engine.types';
import type { ExtractionSpec } from './extraction/extraction.types';
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
  // True when a stored credentials blob exists but cannot be decrypted with the
  // current EMAIL_ENCRYPTION_KEY. Reported, never fatal.
  credentialsUnreadable: boolean;
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
  // Index-aligned with `images` — where each sits in the page, for
  // spec.imageContainerIncludes. Absent on pre-v9 captures.
  imageContexts?: string[];
  // Ordered h1/h2 text — where the deal's headline is addressable. Absent on
  // captures from a pre-v7 bookmarklet.
  headings?: string[];
  flightsText?: string;
  apiJson?: unknown;
  // The full DOM text INCLUDING collapsed/hidden nodes and open shadow
  // roots. `text` (innerText) excludes collapsed content — a Royal Caribbean
  // checkout captured with its "View Ports" drawer closed had the whole
  // day-by-day itinerary missing from `text` even though it was in the DOM.
  // Absent on pre-deepText captures.
  deepText?: string;
  // Present when this capture came from the bookmarklet's FIELD PICKER mode
  // rather than "Instant capture". THIS is the fix for the bug where pasting
  // a picker payload into the normal "Capture from supplier page" dialog
  // silently discarded the picks: parseCapture on the client used to rebuild
  // the payload from a whitelist that omitted `picked` entirely, so an agent
  // who'd just told the picker where the price lived got an ordinary import,
  // a success toast, and no rule ever written — `origin: 'picked'` appeared
  // on zero rules across every stored spec despite the picker having been
  // used. See importFromPage below: when present and non-empty, the picks are
  // applied to the supplier's spec BEFORE extraction runs, via the exact same
  // path savePicks uses (applyPickedFields).
  pickerVersion?: number;
  packageType?: ExtractionSpec['packageType'];
  picked?: PickedField[];
  supplierKey?: string;
  adults?: number;
  children?: number;
  infants?: number;
}

// Outcome of applying picks during an import (importFromPage) or a standalone
// picking session (savePicks) — same shape either way, since both go through
// applyPickedFields below.
export interface AppliedPicksResult {
  applied: MergeResult['applied'];
  problems: DerivationProblem[];
  preserved: string[];
}

// What the field-picker bookmarklet posts (EXTRACTION_AUDIT.md §4 Phase 3/picker).
// Same capture shape as ImportPageInput's core fields, plus the picks
// themselves — `pickerVersion` is accepted for forward-compat logging but
// isn't otherwise interpreted, and `packageType` is the type the agent
// declared BEFORE picking (see PickerCaptureContext in picker-spec.ts), which
// rides straight onto the derived spec as authoritative.
export interface SavePicksInput {
  url: string;
  title?: string;
  text: string;
  headings?: string[];
  apiJson?: unknown;
  deepText?: string;
  pickerVersion?: number;
  packageType?: ExtractionSpec['packageType'];
  picked: PickedField[];
  supplierKey?: string;
}

export interface SavePicksResult {
  supplierKey: string;
  applied: MergeResult['applied'];
  problems: DerivationProblem[];
  preserved: string[];
  // Always true (see scraperService.savePicks) — picking is open to any
  // authenticated agent, not just a platform admin, so its output is never
  // auto-trusted the way a platform admin's own approved edit is.
  specNeedsReview: boolean;
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

// Credentials that can't be decrypted are reported as ABSENT, never as a fatal
// error. They're only meaningful to the automated /scrape path; the capture
// flow doesn't use them at all — the agent is already signed in to the supplier
// in their own browser — so a stale blob (a rotated EMAIL_ENCRYPTION_KEY, a
// config copied between environments) must not stop an import that never needed
// them. The path that DOES need credentials fails at login with a message about
// the credentials, which is where the problem is actionable.
function decryptCredentials(row: SupplierScraper): { credentials: ScraperCredentials; unreadable: boolean } {
  if (!row.encrypted_credentials) return { credentials: {}, unreadable: false };
  try {
    return { credentials: JSON.parse(decrypt(row.encrypted_credentials)) as ScraperCredentials, unreadable: false };
  } catch {
    console.warn(
      `[scraper] credentials for "${row.supplier_key}" could not be decrypted (rotated EMAIL_ENCRYPTION_KEY, or a config copied between environments) — treating them as unset`,
    );
    return { credentials: {}, unreadable: true };
  }
}

function toView(row: SupplierScraper): SupplierScraperView {
  const { credentials: creds, unreadable } = decryptCredentials(row);
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
    credentialsUnreadable: unreadable,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Shared by importFromPage and savePicks: turns click-verified field picks
// into a merged extraction spec, with the SAME approved-spec protection and
// pre-merge archive either path needs. Factored out specifically so the two
// entry points cannot drift — the whole reason importFromPage needed this fix
// in the first place is that a second, independent path (parseCapture's
// client-side whitelist) silently dropped `picked` while this one worked
// fine; duplicating the merge/protect/archive logic instead of sharing it
// would just create a new place for the same class of bug to happen again.
//
// Deliberately does NOT call `resolved.persistConfig` — the two callers
// persist at different points (savePicks persists the merged spec directly;
// importFromPage needs the merged spec in hand before it can pass it to
// runExtractionSpec, then persists it itself) so persistence stays their call.
async function applyPickedFields(
  resolved: ResolvedScraper,
  picked: PickedField[],
  ctx: Omit<PickerCaptureContext, 'headings'> & { headings?: string[] },
  scope: Scope,
): Promise<{ spec: ExtractionSpec; result: AppliedPicksResult }> {
  const existingSpec = resolved.config.extraction;
  const deepLink = resolved.config.deepLink;

  // Every candidate rule is re-verified against THIS capture inside
  // deriveSpecFromPicks — an unverifiable pick becomes a DerivationProblem,
  // never a guessed rule (see picker-spec.ts's module comment).
  const { spec: pickedSpec, derived, problems: derivationProblems } = deriveSpecFromPicks(picked, ctx);

  const hostIncludes = deepLink?.hostIncludes ?? '';
  const archived = await scraperRepository.findArchivedSpec(hostIncludes);
  const specIsApproved = archived?.approved === true;
  const isPlatformAdmin = hasAnyRole(scope.orgRoles, ['platform_admin']);

  // Split the verified picks into what's allowed to merge and what's blocked
  // because it would overwrite a reviewed rule. A field the approved spec
  // doesn't already have is never blocked — this only protects EXISTING
  // rules, not the whole spec from ever growing.
  const problems: DerivationProblem[] = [...derivationProblems];
  const allowedDerived = derived.filter((d) => {
    const existingRule = existingSpec?.fields?.[d.field];
    if (!existingRule || !specIsApproved || isPlatformAdmin) return true;
    problems.push({
      field: d.field,
      reason:
        `this supplier's extraction spec is APPROVED (supplier_spec_archive) — only a platform admin can ` +
        `overwrite an existing rule in it, so "${d.field}" was left unchanged. Pick a field the approved ` +
        'spec doesn\'t already cover, or have a platform admin review and apply this change.',
    });
    return false;
  });
  const allowedFields = Object.fromEntries(allowedDerived.map((d) => [d.field, d.rule]));
  const allowedPickedSpec: ExtractionSpec = { ...pickedSpec, fields: allowedFields };

  // Archive the PRE-merge spec before writing, reusing the same archiveSpec
  // path approveSpec/remove use, so a bad picking session is recoverable —
  // the archive keeps whatever `approved` status it already had.
  if (existingSpec && hostIncludes) {
    await scraperRepository.archiveSpec({
      hostIncludes,
      supplierKey: resolved.supplierKey,
      extraction: existingSpec,
      approved: specIsApproved,
    });
  }

  const { spec: mergedSpec, applied, preserved } = mergePickedIntoSpec(existingSpec, allowedPickedSpec, allowedDerived);

  // Silent-discard guard (EXTRACTION_AUDIT.md — "one paste should do both
  // things", and the bug this whole fix exists for): picks were POSTED, but
  // nothing was applied and nothing was reported as a problem either. That
  // combination must never look like an empty, quiet success — surface it so
  // a future regression in deriveSpecFromPicks/the approved-spec filter is
  // visible instead of indistinguishable from "nothing to do".
  if (picked.length > 0 && applied.length === 0 && problems.length === 0) {
    problems.push({
      field: '(all picked fields)',
      reason:
        'none of the picked fields could be verified against this capture, and none were blocked by an ' +
        'approved spec — nothing was applied. This should not happen; treat it as a bug.',
    });
  }

  return { spec: mergedSpec, result: { applied, problems, preserved } };
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
      const current = decryptCredentials(existing).credentials;
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
      credentials: decryptCredentials(row).credentials,
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
    // Post-extraction validation (EXTRACTION_AUDIT.md §4 Phase 1) — never
    // throws and never blocks the import (agents need the deal in front of
    // them); the caller renders these issues alongside the quote.
    validation: ValidationResult;
    supplierKey: string;
    supplierName: string;
    created: boolean;
    specGenerated: boolean;
    // True when the spec used has not been approved yet — the caller warns, but
    // the import still goes through.
    specNeedsReview: boolean;
    // A previously archived spec was restored instead of asking the AI.
    specRestored: boolean;
    // Present only when `input.picked` carried at least one field picker
    // result. See applyPickedFields — picks are merged into the spec BEFORE
    // extraction runs, so `quote` above already reflects them; this reports
    // what happened to the picks themselves (same shape savePicks returns),
    // so the caller can never mistake "picks were posted" for "picks were
    // silently dropped" (the bug this whole feature exists to close).
    picks?: AppliedPicksResult;
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

    // Contexts are index-aligned with the RAW images array, so pair them before
    // filtering. A length mismatch (an older bookmarklet, a truncated payload)
    // drops them entirely rather than pairing a URL with someone else's context.
    const contexts = input.imageContexts?.length === input.images?.length ? input.imageContexts : undefined;
    const images = (input.images ?? [])
      .map((src, i) => ({ src, context: contexts?.[i] }))
      .filter((i) => i.src && !i.src.startsWith('data:'));
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
        {
          title,
          text: input.text,
          url: input.url,
          apiJson: input.apiJson,
          headings: input.headings,
          deepText: input.deepText,
        },
        resolved.supplierName,
      );
      // A freshly-learned spec is derived from ONE page, so it can be overfitted
      // to that deal (a literal board basis, this hotel's name, one airport).
      // Flag it for a human read; clearing the flag is the approve action.
      if (resolved.persistConfig) await resolved.persistConfig({ extraction: spec, specNeedsReview: true });
    }

    // "One paste should do both things": when this capture came from the
    // field-picker bookmarklet, apply the picks to the supplier's spec BEFORE
    // extraction runs, via the exact same derive → merge → protect → archive
    // path savePicks uses (applyPickedFields) — so the imported deal reflects
    // the picks immediately instead of the agent having to visit a separate
    // screen (SupplierScraperPicksDialog) that a normal capture flow gives no
    // reason to know about. This never blocks the import: a pick that fails
    // to derive is reported as a problem, not a failed capture (see
    // applyPickedFields's own silent-discard guard).
    let picks: AppliedPicksResult | undefined;
    if (input.picked && input.picked.length > 0) {
      const applied = await applyPickedFields(
        resolved,
        input.picked,
        { url: input.url, title, text: input.text, headings: input.headings, packageType: input.packageType },
        scope,
      );
      spec = applied.spec;
      if (resolved.persistConfig) {
        await resolved.persistConfig({ extraction: applied.spec, specNeedsReview: true });
      }
      picks = applied.result;
    }

    const quote = runExtractionSpec(
      spec,
      {
        title,
        text: input.text,
        url: input.url,
        apiJson: input.apiJson,
        images,
        headings: input.headings,
        flightsText: input.flightsText,
        deepText: input.deepText,
      },
      new Date().toISOString(),
    );
    // Occupancy from the quote form overrides whatever was parsed, when provided.
    if (input.adults != null) quote.adults = input.adults;
    if (input.children != null) quote.children = input.children;
    if (input.infants != null) quote.infants = input.infants;

    // Post-extraction validation (EXTRACTION_AUDIT.md §4 Phase 1). Real page
    // text IS available on this path (the agent's own browser captured it), so
    // this also doubles as the wait.textMatches post-hoc capture gate: the
    // length check above only catches an (almost) BLANK page, not one that
    // rendered fully but was captured before the price replaced its loading
    // state — checkCaptureComplete inside validateQuote catches that shape by
    // re-checking the spec's own wait.textMatches against the captured text.
    const validation = validateQuote(quote, { url: input.url, text: input.text, title, spec, headings: input.headings });

    return {
      quote,
      validation,
      supplierKey: resolved.supplierKey,
      supplierName: resolved.supplierName,
      created,
      specGenerated,
      specRestored,
      specNeedsReview: resolved.config.specNeedsReview === true,
      picks,
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
  ): Promise<{ quote: ScrapedQuoteJson; validation: ValidationResult }> {
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
        const quote = await easyjetService.scrapeQuoteFromLink({ url, ...occupancy });
        // No rendered-DOM text or spec reaches this layer on this path either —
        // see the ValidationContext.text comment — so text is '' here too.
        return { quote, validation: validateQuote(quote, { url, text: '' }) };
      }
      throw err;
    }

    // Default to the generic DOM adapter — easyJet's API adapter is a special
    // case used only when adapterType is explicitly 'easyjet'.
    const adapter = getAdapter((resolved.config.adapterType || 'dom') as ScraperAdapterType);
    if (!adapter) {
      throw new AppError(`No scraper adapter registered for type "${resolved.config.adapterType}"`, 500);
    }
    const quote = await adapter.scrape(url, resolved, occupancy);
    // Post-extraction validation (EXTRACTION_AUDIT.md §4 Phase 1). Unlike
    // importFromPage, the rendered page's innerText lives inside the adapter's
    // own closure (dom.adapter.ts) and never reaches this layer, so text is ''
    // here — every text-dependent check (prose repetition, capture-complete,
    // currency-from-text/symbol) degrades to "no evidence" rather than false
    // positives (see the ValidationContext.text comment in extraction.validate.ts).
    const validation = validateQuote(quote, { url, text: '', spec: resolved.config.extraction });
    return { quote, validation };
  },

  // Stores a field-picker mapping into a supplier's extraction spec. Unlike
  // importFromPage/generateSpecFromDom (which each own the WHOLE spec —
  // either restoring one wholesale or generating one from scratch), a picker
  // session only ever verifies the handful of fields an agent clicked
  // (deriveSpecFromPicks — picker-spec.ts). Storing that wholesale would
  // DELETE the AI's rules for every other field, `constants` (tour_operator,
  // currency), `wait.textMatches` (the CAPTURE_INCOMPLETE validation gate),
  // `itineraryRegex`, `luggageRegex` and the image config — mergePickedIntoSpec
  // exists specifically to merge instead of replace.
  //
  // Access control (EXTRACTION_AUDIT.md §1.5 gated scraper MUTATIONS behind
  // requirePlatformAdmin because supplier_scraper is platform-wide — one
  // tenant's bad edit breaks every tenant. Picking is different: it's an
  // ordinary agent's workflow while looking at a deal page, not a config-
  // management action, so gating it the same way would make the feature
  // unusable for the people it's built for. The route (scraper.routes.ts)
  // stays open to any authenticated agent. What still needs protecting is
  // reviewed work: a spec archived with `approved: true`
  // (supplier_spec_archive) represents rules a platform admin has already
  // read and signed off — an ordinary agent's click must not silently
  // overwrite one of THOSE, even though it's free to add a rule for a field
  // the approved spec never covered. And because picking is now open to
  // anyone, its output is never auto-trusted: specNeedsReview is unconditionally
  // true, exactly like a freshly AI-generated spec.
  async savePicks(input: SavePicksInput, scope: Scope, userId?: string): Promise<SavePicksResult> {
    let resolved: ResolvedScraper;
    if (input.supplierKey) {
      resolved = await this.resolveByKey(input.supplierKey, scope);
    } else {
      ({ resolved } = await this.resolveOrCreateForCapture(input.url, scope, userId));
    }

    // Same ownership guard as importFromPage: naming a supplier explicitly
    // must not let a page from a foreign site rewrite that supplier's spec.
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

    if (input.text.trim().length < 200) {
      throw new AppError(
        'The captured page had almost no text — make sure the deal page is open and fully loaded (with the price showing), then capture again.',
        400,
      );
    }

    const title = input.title ?? '';

    // Derive → merge → protect-approved → archive, shared with importFromPage
    // via applyPickedFields so the two entry points cannot drift.
    const { spec: mergedSpec, result } = await applyPickedFields(
      resolved,
      input.picked,
      { url: input.url, title, text: input.text, headings: input.headings, packageType: input.packageType },
      scope,
    );

    if (resolved.persistConfig) {
      await resolved.persistConfig({ extraction: mergedSpec, specNeedsReview: true });
    }

    return {
      supplierKey: resolved.supplierKey,
      applied: result.applied,
      problems: result.problems,
      preserved: result.preserved,
      specNeedsReview: true,
    };
  },
};
