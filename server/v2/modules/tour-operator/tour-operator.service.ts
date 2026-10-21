import type { TourOperatorLookup } from '@shared/schema';
import { AppError } from '../../utils/error-handler';
import { decrypt, encrypt } from '../../utils/encryption';
import type { RequestActor } from '../../utils/request-actor';
import type { Scope } from '../../utils/scope';
import { platformAdminAuditRepository } from '../platform-admin/platform-admin-audit.repository';
import { isUniqueViolation } from '../../utils/pg-errors';
import { orgTourOperatorRepository, type OrgOperatorUpdate } from './org-tour-operator.repository';
import { tourOperatorRepository } from './tour-operator.repository';
import { canSeeOperatorPasswords, canWriteOperators, requireOptionReader, requireOrg, requireReader, requireWriter } from './tour-operator-access';
import { buildOperatorsCsv } from './tour-operator-csv';
import { safeDecrypt, toOption, toOrgOperatorRow } from './tour-operator.mapper';
import type { CatalogueRow, ManageResponse, OrgOperatorRow, TourOperatorOption } from './tour-operator.types';
import type { CreateLinkBody, PatchLinkBody } from './tour-operator.validator';

const NOT_FOUND = 'Tour operator not found';

type CatalogueFields = { website?: string; phone?: string };

/** Empty string means "clear" on PATCH. */
function nullIfBlank(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  return value === '' ? null : value;
}

/** The operator the caller picked from the catalogue. */
async function pickCatalogueOperator(operatorId: string): Promise<TourOperatorLookup> {
  const operator = await tourOperatorRepository.findById(operatorId);
  if (!operator) throw new AppError(NOT_FOUND, 404);
  return operator;
}

/** Typed name: reuse the catalogue row when one exists, else create it (no field writes to existing rows here). */
async function findOrCreateCatalogueOperator(
  name: string,
  fields: CatalogueFields,
  userId: string | null,
): Promise<TourOperatorLookup> {
  const existing = await tourOperatorRepository.findByLowerName(name);
  if (existing) return existing;
  const created = await tourOperatorRepository.insert({
    name: name.trim(),
    website: fields.website || null,
    phone: fields.phone || null,
    created_by: userId,
  });
  if (created) return created;
  // Lost a race on the unique name index: the other request's row is the one to use.
  const raced = await tourOperatorRepository.findByLowerName(name);
  if (!raced) throw new AppError('Could not save the tour operator. Please try again.', 500);
  return raced;
}

/**
 * Applies phone/website to the shared catalogue row. Runs only AFTER the link is
 * saved, so a rejected request (409) never changes the catalogue.
 * 'overwrite' = the caller picked this operator and edited it; 'fillBlanks' = a typed name matched it.
 */
async function applyCatalogueFields(
  operator: TourOperatorLookup,
  fields: CatalogueFields,
  mode: 'overwrite' | 'fillBlanks',
): Promise<void> {
  const patch: Partial<TourOperatorLookup> = {};
  if (fields.website && (mode === 'overwrite' ? fields.website !== operator.website : !operator.website)) {
    patch.website = fields.website;
  }
  if (fields.phone && (mode === 'overwrite' ? fields.phone !== operator.phone : !operator.phone)) {
    patch.phone = fields.phone;
  }
  if (Object.keys(patch).length > 0) await tourOperatorRepository.update(operator.id, patch);
}

async function requireRow(orgId: string, linkId: string, scope: Scope): Promise<OrgOperatorRow> {
  const row = await orgTourOperatorRepository.findLink(orgId, linkId);
  if (!row) throw new AppError(NOT_FOUND, 404);
  return toOrgOperatorRow(row, { revealPasswords: canSeeOperatorPasswords(scope), decrypt });
}

export const tourOperatorService = {
  /** Dropdown options for the quote/booking/pipeline forms. No credentials. */
  async listOptions(scope: Scope, includeInactive: boolean): Promise<TourOperatorOption[]> {
    requireOptionReader(scope);
    const orgId = requireOrg(scope);
    const rows = await orgTourOperatorRepository.listForOrg(orgId, includeInactive);
    return rows.map(toOption);
  },

  async listManage(scope: Scope, includeInactive: boolean): Promise<ManageResponse> {
    requireReader(scope);
    const orgId = requireOrg(scope);
    const revealPasswords = canSeeOperatorPasswords(scope);
    const rows = await orgTourOperatorRepository.listForOrg(orgId, includeInactive);
    return {
      rows: rows.map((r) => toOrgOperatorRow(r, { revealPasswords, decrypt })),
      canWrite: canWriteOperators(scope),
      canSeePasswords: revealPasswords,
    };
  },

  async searchCatalogue(scope: Scope, q: string | undefined, all: boolean): Promise<{ rows: CatalogueRow[] }> {
    requireReader(scope);
    const orgId = requireOrg(scope);
    return { rows: await tourOperatorRepository.searchCatalogue(orgId, q, all) };
  },

  async createLink(scope: Scope, body: CreateLinkBody): Promise<OrgOperatorRow> {
    requireWriter(scope);
    const orgId = requireOrg(scope);
    const picked = Boolean(body.tourOperatorId);
    const operator = body.tourOperatorId
      ? await pickCatalogueOperator(body.tourOperatorId)
      : await findOrCreateCatalogueOperator(body.name ?? '', body, scope.userId);

    if (await orgTourOperatorRepository.findLinkByOperator(orgId, operator.id)) {
      throw new AppError(`${operator.name} is already in your list`, 409);
    }
    const inserted = await orgTourOperatorRepository.insertLink({
      org_id: orgId,
      tour_operator_id: operator.id,
      commission_percentage: String(body.commissionPercentage),
      balance_due_weeks: body.balanceDueWeeks,
      username: body.username || null,
      encrypted_password: body.password ? encrypt(body.password) : null,
      created_by: scope.userId,
      updated_by: scope.userId,
    });
    if (!inserted) throw new AppError(`${operator.name} is already in your list`, 409);
    await applyCatalogueFields(operator, body, picked ? 'overwrite' : 'fillBlanks');
    return requireRow(orgId, inserted.id, scope);
  },

  async updateLink(scope: Scope, linkId: string, body: PatchLinkBody): Promise<OrgOperatorRow> {
    requireWriter(scope);
    const orgId = requireOrg(scope);
    const link = await orgTourOperatorRepository.findLink(orgId, linkId);
    if (!link) throw new AppError(NOT_FOUND, 404);

    const catalogue: Partial<TourOperatorLookup> = {};
    if (body.name !== undefined) {
      if (body.name.toLowerCase() !== link.name.trim().toLowerCase()) {
        const duplicate = await tourOperatorRepository.findByLowerName(body.name);
        if (duplicate && duplicate.id !== link.operatorId) {
          throw new AppError(`${body.name} is already in the catalogue`, 409);
        }
      }
      catalogue.name = body.name;
    }
    if (body.website !== undefined) catalogue.website = nullIfBlank(body.website);
    if (body.phone !== undefined) catalogue.phone = nullIfBlank(body.phone);
    if (Object.keys(catalogue).length > 0) {
      try {
        await tourOperatorRepository.update(link.operatorId, catalogue);
      } catch (err) {
        // Two renames to the same name raced past the check above.
        if (isUniqueViolation(err) && catalogue.name) throw new AppError(`${catalogue.name} is already in the catalogue`, 409);
        throw err;
      }
    }

    const values: OrgOperatorUpdate = { updated_by: scope.userId };
    if (body.commissionPercentage !== undefined) {
      values.commission_percentage = body.commissionPercentage === null ? null : String(body.commissionPercentage);
    }
    if (body.balanceDueWeeks !== undefined) values.balance_due_weeks = body.balanceDueWeeks;
    if (body.username !== undefined) values.username = nullIfBlank(body.username);
    if (body.password !== undefined) values.encrypted_password = body.password === '' ? null : encrypt(body.password);
    if (body.isActive !== undefined) values.is_active = body.isActive;

    const updated = await orgTourOperatorRepository.updateLink(orgId, linkId, values);
    if (!updated) throw new AppError(NOT_FOUND, 404);
    return requireRow(orgId, linkId, scope);
  },

  /** Removes the agency's link only; the catalogue row and any quotes/bookings stay. */
  async removeLink(scope: Scope, linkId: string): Promise<void> {
    requireWriter(scope);
    const orgId = requireOrg(scope);
    const removed = await orgTourOperatorRepository.deleteLink(orgId, linkId);
    if (!removed) throw new AppError(NOT_FOUND, 404);
  },

  /** Returns one stored password and records who looked (never the secret itself). */
  async revealPassword(scope: Scope, linkId: string, actor: RequestActor): Promise<{ password: string | null }> {
    requireReader(scope);
    const orgId = requireOrg(scope);
    const link = await orgTourOperatorRepository.findLink(orgId, linkId);
    if (!link) throw new AppError(NOT_FOUND, 404);
    // Fail closed: if the audit row cannot be written the secret is NOT returned.
    await platformAdminAuditRepository.create({
      actorUserId: actor.userId,
      action: 'tour_operator.password_reveal',
      targetOrgId: orgId,
      targetUserId: null,
      metadata: { linkId, ...(actor.impersonating ? { impersonating: true } : {}) },
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
    });
    return { password: safeDecrypt(link.encrypted_password, decrypt) };
  },

  async exportCsv(scope: Scope): Promise<string> {
    requireReader(scope);
    const orgId = requireOrg(scope);
    const includePasswords = canSeeOperatorPasswords(scope);
    const rows = await orgTourOperatorRepository.listForOrg(orgId, true);
    return buildOperatorsCsv(
      rows.map((r) => ({
        name: r.name,
        phone: r.phone,
        website: r.website,
        username: r.username,
        password: includePasswords ? safeDecrypt(r.encrypted_password, decrypt) : null,
        commission_percentage: r.commission_percentage,
        balance_due_weeks: r.balance_due_weeks,
      })),
      includePasswords,
    );
  },
};
