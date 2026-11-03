import { HOMEWORKER_SHOP, ROLE_LABELS } from "./roles";
import type { PersonRow, ShopRow } from "../types";
import type { BusinessDraft } from "./schemas";

let seq = 0;
export function uid(): string {
  seq += 1;
  return `ob-${Date.now().toString(36)}-${seq}-${Math.random().toString(36).slice(2, 6)}`;
}

export const blankPerson = (role: string = ROLE_LABELS.agent): PersonRow => ({
  id: uid(),
  firstName: "",
  lastName: "",
  email: "",
  shop: "",
  role,
});

export const blankShop = (): ShopRow => ({
  id: uid(),
  name: "",
  phone: "",
  address: "",
  email: "",
  managerEmail: "",
});

export const isBlankPerson = (r: PersonRow): boolean => !r.firstName.trim() && !r.lastName.trim() && !r.email.trim();
export const isBlankShop = (r: ShopRow): boolean =>
  !r.name.trim() && !r.phone.trim() && !r.address.trim() && !r.email.trim() && !r.managerEmail.trim();

/**
 * Starting rows for the single-shop people table: one Branch Manager row when the
 * business has one, then one Agent row per agent. The owner is shown separately and never seeded.
 */
export function seedAgents(business: Pick<BusinessDraft, "hasBranchManager" | "agentCount">): PersonRow[] {
  const count = Math.max(1, Number(business.agentCount) || 1);
  const rows: PersonRow[] = [];
  if (business.hasBranchManager) rows.push(blankPerson(ROLE_LABELS.branch_manager));
  for (let i = 0; i < count; i += 1) rows.push(blankPerson());
  return rows;
}

/**
 * Called when the agents step opens. If nobody has typed anything yet, rebuild the starting
 * rows from the latest answers; otherwise keep what was typed.
 */
export function syncAgents(rows: PersonRow[], business: Pick<BusinessDraft, "hasBranchManager" | "agentCount">): PersonRow[] {
  return rows.every(isBlankPerson) ? seedAgents(business) : rows;
}

/** Fill the table from `startIndex` with pasted/uploaded rows, reusing existing row ids. */
export function pasteIntoRows(rows: PersonRow[], startIndex: number, incoming: PersonRow[]): PersonRow[] {
  const next = [...rows];
  incoming.forEach((row, i) => {
    const at = startIndex + i;
    const existing = next[at];
    if (existing) next[at] = { ...row, id: existing.id };
    else next.push(row);
  });
  return next;
}

export function updateRow<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T[] {
  return rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
}

/** Homeworker rows ignore the role column, so any typed role is treated as Agent when validating. */
export function normaliseTeamRow(row: PersonRow): PersonRow {
  return row.shop === HOMEWORKER_SHOP ? { ...row, role: ROLE_LABELS.agent } : row;
}
