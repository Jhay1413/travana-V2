import { z } from 'zod';
import {
  DEFAULT_BALANCE_WEEKS,
  OPERATOR_MESSAGES,
  PHONE_RE,
  normaliseWeb,
  parseBalanceWeeks,
  parseCommission,
} from '@shared/tour-operator-rules';
import type {
  CatalogueMatch,
  ExistingLink,
  ImportCounts,
  ImportPlanEntry,
  ImportRowInput,
  ImportValues,
} from './tour-operator.types';

const urlCheck = z.string().url();

/** The key used to match names everywhere: lower-cased and trimmed. */
export function nameKey(name: string): string {
  return name.trim().toLowerCase();
}

function blank(value: string | undefined): boolean {
  return value === undefined || value.trim() === '';
}

interface CleanResult {
  values?: ImportValues;
  errors: string[];
}

/** Validates one row's cells. Blank optional cells stay undefined (keep / not set). */
function cleanRow(row: ImportRowInput): CleanResult {
  const errors: string[] = [];
  const name = (row.name ?? '').trim();
  if (name.length < 2) errors.push(OPERATOR_MESSAGES.nameMin);

  const values: ImportValues = { name };

  if (!blank(row.phone)) {
    const phone = row.phone!.trim();
    if (PHONE_RE.test(phone)) values.phone = phone;
    else errors.push(OPERATOR_MESSAGES.phone);
  }
  if (!blank(row.website)) {
    const site = normaliseWeb(row.website!);
    if (urlCheck.safeParse(site).success) values.website = site;
    else errors.push(OPERATOR_MESSAGES.web);
  }
  if (!blank(row.username)) values.username = row.username!.trim();
  if (!blank(row.password)) values.password = row.password!;

  const commission = parseCommission(row.commission);
  if (commission.error) errors.push(commission.error);
  else if (commission.value !== undefined) values.commission = commission.value;

  const weeks = parseBalanceWeeks(row.balanceWeeks);
  if (weeks.error) errors.push(weeks.error);
  else if (weeks.value !== undefined) values.balanceWeeks = weeks.value;

  return errors.length > 0 ? { errors } : { values, errors };
}

/** True when applying `v` to `existing` would change anything (blank cells keep the old value). */
function hasChanges(v: ImportValues, existing: ExistingLink): boolean {
  if (v.username !== undefined && v.username !== existing.username) return true;
  if (v.password !== undefined && v.password !== existing.password) return true;
  if (v.commission !== undefined && v.commission !== existing.commission) return true;
  if (v.balanceWeeks !== undefined && v.balanceWeeks !== existing.balanceWeeks) return true;
  // Catalogue fields are shared across agencies: an import only fills blanks.
  if (v.phone !== undefined && !existing.phone) return true;
  if (v.website !== undefined && !existing.website) return true;
  return false;
}

/**
 * Pure import planner. For every uploaded row decides new / update / same /
 * error. Matching is by lower-cased trimmed name against the org's own links
 * first, then the platform catalogue.
 *
 * Rules: a new link with a blank commission gets NULL (not set, never 0);
 * an update with a blank cell keeps the existing value; phone/website only
 * ever fill blanks in the shared catalogue.
 */
export function planImport(
  rows: ImportRowInput[],
  existingLinks: ExistingLink[],
  catalogueByLowerName: Map<string, CatalogueMatch>,
): ImportPlanEntry[] {
  const linksByName = new Map<string, ExistingLink>();
  for (const link of existingLinks) linksByName.set(nameKey(link.name), link);

  const seen = new Set<string>();
  const plan: ImportPlanEntry[] = [];

  for (const row of rows) {
    const display = (row.name ?? '').trim() || OPERATOR_MESSAGES.noName;
    const cleaned = cleanRow(row);
    if (!cleaned.values) {
      plan.push({ line: row.line, name: display, status: 'error', message: cleaned.errors.join(' ') });
      continue;
    }
    const values = cleaned.values;
    const key = nameKey(values.name);
    if (seen.has(key)) {
      plan.push({ line: row.line, name: values.name, status: 'error', message: OPERATOR_MESSAGES.nameDuplicateInFile(values.name) });
      continue;
    }
    seen.add(key);

    const link = linksByName.get(key);
    if (link) {
      const changed = hasChanges(values, link);
      plan.push({
        line: row.line,
        name: link.name,
        status: changed ? 'update' : 'same',
        commission: values.commission ?? link.commission,
        values,
        linkId: link.linkId,
        operatorId: link.operatorId,
      });
      continue;
    }

    const catalogue = catalogueByLowerName.get(key);
    plan.push({
      line: row.line,
      name: catalogue?.name ?? values.name,
      status: 'new',
      commission: values.commission ?? null,
      values: { ...values, balanceWeeks: values.balanceWeeks ?? DEFAULT_BALANCE_WEEKS },
      operatorId: catalogue?.id,
      createCatalogue: !catalogue,
    });
  }
  return plan;
}

export function countPlan(plan: ImportPlanEntry[]): ImportCounts {
  const counts: ImportCounts = { new: 0, update: 0, same: 0, error: 0 };
  for (const p of plan) counts[p.status] += 1;
  return counts;
}
