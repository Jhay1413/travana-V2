import { decrypt, encrypt } from '../../utils/encryption';
import type { Scope } from '../../utils/scope';
import { orgTourOperatorRepository, type OrgOperatorUpdate, type Tx } from './org-tour-operator.repository';
import { tourOperatorRepository } from './tour-operator.repository';
import { requireOrg, requireWriter } from './tour-operator-access';
import { countPlan, nameKey, planImport } from './tour-operator-import.plan';
import { safeDecrypt } from './tour-operator.mapper';
import type {
  CatalogueMatch,
  ExistingLink,
  ImportPlanEntry,
  ImportPlanRow,
  ImportPreview,
  ImportResult,
  ImportRowInput,
  ImportValues,
} from './tour-operator.types';

async function loadPlan(orgId: string, rows: ImportRowInput[]): Promise<ImportPlanEntry[]> {
  const links = await orgTourOperatorRepository.listForOrg(orgId, true);
  const existing: ExistingLink[] = links.map((l) => ({
    linkId: l.linkId,
    operatorId: l.operatorId,
    name: l.name,
    phone: l.phone,
    website: l.website,
    username: l.username,
    password: safeDecrypt(l.encrypted_password, decrypt),
    commission: l.commission_percentage === null ? null : Number(l.commission_percentage),
    balanceWeeks: l.balance_due_weeks,
  }));
  const keys = rows.map((r) => nameKey(r.name ?? '')).filter((k) => k.length > 0);
  const found = await tourOperatorRepository.findByLowerNames(Array.from(new Set(keys)));
  const catalogue = new Map<string, CatalogueMatch>();
  for (const c of found) {
    catalogue.set(nameKey(c.name), { id: c.id, name: c.name, phone: c.phone, website: c.website });
  }
  return planImport(rows, existing, catalogue);
}

/** Public shape of a plan row: no internals, never any password. */
function toPlanRow(p: ImportPlanEntry): ImportPlanRow {
  const row: ImportPlanRow = { line: p.line, name: p.name, status: p.status };
  if (p.message !== undefined) row.message = p.message;
  if (p.commission !== undefined) row.commission = p.commission;
  return row;
}

/** Shared catalogue fields only ever have blanks filled by an import. */
async function fillCatalogueBlanks(operatorId: string, v: ImportValues, tx: Tx): Promise<void> {
  if (v.phone === undefined && v.website === undefined) return;
  const operator = await tourOperatorRepository.findById(operatorId, tx);
  if (!operator) return;
  const patch: { phone?: string; website?: string } = {};
  if (v.phone !== undefined && !operator.phone) patch.phone = v.phone;
  if (v.website !== undefined && !operator.website) patch.website = v.website;
  if (Object.keys(patch).length > 0) await tourOperatorRepository.update(operatorId, patch, tx);
}

async function applyNew(orgId: string, entry: ImportPlanEntry, userId: string | null, tx: Tx): Promise<boolean> {
  const v = entry.values;
  if (!v) return false;
  let operatorId = entry.operatorId;
  if (entry.createCatalogue || !operatorId) {
    const created = await tourOperatorRepository.insert(
      { name: v.name, phone: v.phone ?? null, website: v.website ?? null, created_by: userId },
      tx,
    );
    const operator = created ?? (await tourOperatorRepository.findByLowerName(v.name, tx));
    if (!operator) return false;
    operatorId = operator.id;
    if (!created) await fillCatalogueBlanks(operatorId, v, tx);
  } else {
    await fillCatalogueBlanks(operatorId, v, tx);
  }
  const inserted = await orgTourOperatorRepository.insertLink(
    {
      org_id: orgId,
      tour_operator_id: operatorId,
      commission_percentage: v.commission === undefined ? null : String(v.commission),
      balance_due_weeks: v.balanceWeeks,
      username: v.username ?? null,
      encrypted_password: v.password === undefined ? null : encrypt(v.password),
      created_by: userId,
      updated_by: userId,
    },
    tx,
  );
  return inserted !== null;
}

async function applyUpdate(orgId: string, entry: ImportPlanEntry, userId: string | null, tx: Tx): Promise<boolean> {
  const v = entry.values;
  if (!v || !entry.linkId || !entry.operatorId) return false;
  await fillCatalogueBlanks(entry.operatorId, v, tx);
  // Blank cells keep the stored value; only non-blank cells are written.
  const values: OrgOperatorUpdate = { updated_by: userId };
  if (v.commission !== undefined) values.commission_percentage = String(v.commission);
  if (v.balanceWeeks !== undefined) values.balance_due_weeks = v.balanceWeeks;
  if (v.username !== undefined) values.username = v.username;
  if (v.password !== undefined) values.encrypted_password = encrypt(v.password);
  const updated = await orgTourOperatorRepository.updateLink(orgId, entry.linkId, values, tx);
  return updated !== null;
}

export const tourOperatorImportService = {
  /** Plans the import without writing anything. */
  async preview(scope: Scope, rows: ImportRowInput[]): Promise<ImportPreview> {
    requireWriter(scope);
    const orgId = requireOrg(scope);
    const plan = await loadPlan(orgId, rows);
    return { rows: plan.map(toPlanRow), counts: countPlan(plan) };
  },

  /** Plans, then applies every valid row in ONE transaction; invalid rows are reported and skipped. */
  async apply(scope: Scope, rows: ImportRowInput[]): Promise<ImportResult> {
    requireWriter(scope);
    const orgId = requireOrg(scope);
    const plan = await loadPlan(orgId, rows);
    const result: ImportResult = { added: 0, updated: 0, unchanged: 0, errors: [] };

    await orgTourOperatorRepository.transaction(async (tx) => {
      for (const entry of plan) {
        if (entry.status === 'error') {
          result.errors.push({ row: entry.line, message: entry.message ?? 'Invalid row' });
        } else if (entry.status === 'same') {
          result.unchanged += 1;
        } else if (entry.status === 'new') {
          if (await applyNew(orgId, entry, scope.userId, tx)) result.added += 1;
          else result.unchanged += 1;
        } else if (await applyUpdate(orgId, entry, scope.userId, tx)) {
          result.updated += 1;
        } else {
          result.unchanged += 1;
        }
      }
    });
    return result;
  },
};
