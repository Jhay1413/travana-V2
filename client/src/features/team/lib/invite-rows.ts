import type { InviteBodyFor, InviteOrgRole } from "@/features/invite/api/invite.api";
import { buildInviteBody } from "@/features/homeworkers/lib/invite-body";
import { roleLabel } from "./role-helpers";

export type InviteBody = InviteBodyFor<InviteOrgRole>;

export const MAX_ROWS = 200;
export const MIN_VISIBLE_ROWS = 5;

/** Roles an admin can invite. Owner / Admin is deliberately absent: invite then change the role. */
export const INVITABLE_ROLES: InviteOrgRole[] = ["branch_manager", "agent", "social_media_manager", "homeworker", "referral_agent"];

export const ADMIN_ROLE_HINT = "Invite as Branch Manager or Agent, then change the role";

export interface InviteRow {
  id: string;
  first: string;
  last: string;
  email: string;
  role: InviteOrgRole | "";
  /** A branch id from the branch list, or "" when none matched. Homeworkers have none. */
  branchId: string;
  /** Raw spreadsheet text that did not match a branch (for the error message). */
  branchText: string;
  /** Set when the spreadsheet named a role that cannot be invited directly. */
  roleIssue: string;
}

export interface BranchOption {
  id: string;
  name: string;
  isDefault?: boolean;
}

export type RowField = "first" | "last" | "email" | "role" | "branch";
export type RowErrors = Partial<Record<RowField, string>>;

export interface ValidationContext {
  branches: BranchOption[];
  /** Lower-cased emails already used by members or pending invites. */
  takenEmails: ReadonlySet<string>;
  allowedRoles: readonly InviteOrgRole[];
  /** Branch managers can only invite into their own branch. */
  lockedBranchId?: string | null;
}

let seq = 0;
const nextId = () => `row-${Date.now().toString(36)}-${seq++}`;

export function blankRow(): InviteRow {
  return { id: nextId(), first: "", last: "", email: "", role: "", branchId: "", branchText: "", roleIssue: "" };
}

export function isBlankRow(r: InviteRow): boolean {
  return !r.first.trim() && !r.last.trim() && !r.email.trim() && !r.role && !r.branchId && !r.branchText.trim() && !r.roleIssue;
}

/** Pads with blank rows up to the minimum shown, never past MAX_ROWS. */
export function padRows(rows: InviteRow[]): InviteRow[] {
  const missing = Math.max(0, MIN_VISIBLE_ROWS - rows.length);
  return [...rows, ...Array.from({ length: missing }, blankRow)].slice(0, Math.max(MAX_ROWS, rows.length));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ROLE_ALIASES: Array<[InviteOrgRole, string[]]> = [
  ["branch_manager", ["branchmanager", "shopmanager", "manager", "branchmgr"]],
  ["agent", ["agent", "travelagent", "consultant", "travelconsultant"]],
  ["social_media_manager", ["socialmediamanager", "social", "socialmanager", "socialmedia"]],
  ["homeworker", ["homeworker", "homeworking", "homeagent", "remote"]],
  ["referral_agent", ["referralpartner", "referralagent", "referral", "referrer"]],
];

/** Roles the design has that V2 cannot invite directly. */
const REJECTED_ROLE_ALIASES = [
  "owner", "admin", "owneradmin", "administrator", "agencyowner",
  "salesmanager", "salesmgr", "salesmanagerselling", "salesmanagernonselling",
];

export interface RoleMatch {
  role: InviteOrgRole | "";
  issue: string;
}

export function matchRole(raw: string): RoleMatch {
  const n = norm(raw);
  if (!n) return { role: "", issue: "" };
  const hit = ROLE_ALIASES.find(([value, aliases]) => norm(roleLabel(value)) === n || aliases.includes(n));
  if (hit) return { role: hit[0], issue: "" };
  if (REJECTED_ROLE_ALIASES.includes(n)) return { role: "", issue: `${raw.trim()}: ${ADMIN_ROLE_HINT}` };
  return { role: "", issue: `Unknown role "${raw.trim()}"` };
}

export function matchBranch(raw: string, role: InviteOrgRole | "", branches: BranchOption[]): { branchId: string; branchText: string } {
  if (role === "homeworker") return { branchId: "", branchText: "" };
  const n = norm(raw);
  if (!n) return { branchId: "", branchText: "" };
  const hit = branches.find((b) => norm(b.name) === n);
  return hit ? { branchId: hit.id, branchText: "" } : { branchId: "", branchText: raw.trim() };
}

const COLUMN_ALIASES: Record<"first" | "last" | "email" | "role" | "branch", string[]> = {
  first: ["firstname", "first", "givenname", "forename"],
  last: ["lastname", "last", "surname", "familyname"],
  email: ["email", "emailaddress", "workemail"],
  role: ["role", "jobrole", "position"],
  branch: ["branch", "shop", "shopname", "office", "location"],
};
const COLUMN_ORDER = ["first", "last", "email", "role", "branch"] as const;

/** Spreadsheet table to invite rows. Matches by header name, otherwise by the template's column order. */
export function tableToInviteRows(table: string[][], branches: BranchOption[]): InviteRow[] {
  const header = (table[0] ?? []).map(norm);
  const index: Record<string, number> = {};
  let hits = 0;
  for (const key of COLUMN_ORDER) {
    index[key] = header.findIndex((h) => COLUMN_ALIASES[key].includes(h));
    if (index[key] >= 0) hits++;
  }
  const body = hits >= 2 ? table.slice(1) : table;
  if (hits < 2) COLUMN_ORDER.forEach((k, i) => (index[k] = i));
  const pick = (row: string[], k: string) => (index[k] >= 0 ? (row[index[k]] ?? "").trim() : "");
  return body
    .map((row): InviteRow => {
      const match = matchRole(pick(row, "role"));
      const branch = matchBranch(pick(row, "branch"), match.role, branches);
      return {
        id: nextId(),
        first: pick(row, "first"),
        last: pick(row, "last"),
        email: pick(row, "email"),
        role: match.role,
        roleIssue: match.issue,
        ...branch,
      };
    })
    .filter((r) => !isBlankRow(r));
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** One row's problems. The role and branch rules mirror the server's invite validator. */
export function validateRow(row: InviteRow, ctx: ValidationContext, opts: { requireNames?: boolean } = {}): RowErrors {
  const requireNames = opts.requireNames ?? true;
  const e: RowErrors = {};
  const email = row.email.trim().toLowerCase();
  const homeworker = row.role === "homeworker";
  if (!email) e.email = "Enter an email address";
  else if (!EMAIL_RE.test(email)) e.email = "Enter a valid email address";
  else if (ctx.takenEmails.has(email)) e.email = "Someone in your team already uses this email";
  if (requireNames && !row.first.trim()) e.first = "Enter a first name";
  if (requireNames && !row.last.trim()) e.last = "Enter a last name";
  if (row.first.trim().length > 60) e.first = "That is too long";
  if (row.last.trim().length > 60) e.last = "That is too long";

  if (!row.role) {
    e.role = row.roleIssue || "Choose a role";
  } else if (!ctx.allowedRoles.includes(row.role)) {
    e.role = `You can't invite ${roleLabel(row.role)} users`;
  }

  if (!homeworker && row.role) {
    if (!row.branchId) {
      e.branch = row.branchText ? `Branch "${row.branchText}" not found` : "Choose a branch";
    } else if (!ctx.branches.some((b) => b.id === row.branchId)) {
      e.branch = "Choose a branch";
    } else if (ctx.lockedBranchId && row.branchId !== ctx.lockedBranchId) {
      e.branch = "You can only invite to your own branch";
    }
  }
  return e;
}

/** Errors for every filled row, flagging the second and later copies of an email. */
export function validateRows(rows: InviteRow[], ctx: ValidationContext): Record<string, RowErrors> {
  const out: Record<string, RowErrors> = {};
  const seen = new Set<string>();
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const errors = validateRow(row, ctx);
    const email = row.email.trim().toLowerCase();
    if (email && !errors.email) {
      if (seen.has(email)) errors.email = "This email is in your list twice";
      seen.add(email);
    }
    if (Object.keys(errors).length > 0) out[row.id] = errors;
  }
  return out;
}

export function firstError(e: RowErrors | undefined): string | null {
  if (!e) return null;
  return e.first ?? e.last ?? e.email ?? e.role ?? e.branch ?? null;
}

/** POST /invites body for a validated row. Homeworkers use the homeworker arm with the org default share. */
export function rowToInviteBody(row: InviteRow, extras: { profitSharePercent?: string; displayName?: string } = {}): InviteBody {
  const role = (row.role || "agent") as InviteOrgRole;
  const first = row.first.trim();
  const last = row.last.trim();
  const body = buildInviteBody({
    email: row.email,
    orgRole: role,
    branchId: row.branchId,
    profitSharePercent: extras.profitSharePercent ?? "",
    displayName: extras.displayName?.trim() || `${first} ${last}`.trim(),
  });
  if (body.orgRole === "homeworker") return body;
  return { ...body, ...(first ? { firstName: first } : {}), ...(last ? { lastName: last } : {}) };
}

/** Branch managers can only invite into their own branch: point every non-homeworker row at it. */
export function lockRowsToBranch(rows: InviteRow[], lockedBranchId: string | null | undefined): InviteRow[] {
  if (!lockedBranchId) return rows;
  return rows.map((r) =>
    isBlankRow(r) || r.role === "homeworker" ? r : { ...r, branchId: lockedBranchId, branchText: "" },
  );
}

/** Rows that still need sending: rows already sent are left out of validation and sending. */
export function unsentRows(rows: InviteRow[], results: Record<string, { status: string }>): InviteRow[] {
  return rows.filter((r) => results[r.id]?.status !== "sent");
}
