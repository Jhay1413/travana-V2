import type { OrgMember } from "@/features/organization/api/organization.api";
import type { StatusTab } from "../types";
import { memberStatus } from "./member-status";
import { roleLabel } from "./role-helpers";

export interface MemberFilters {
  status: StatusTab;
  /** "all" or an org role value. */
  role: string;
  /** "all" or a branch id. */
  branchId: string;
  query: string;
}

export const DEFAULT_FILTERS: MemberFilters = { status: "active", role: "all", branchId: "all", query: "" };

export function matchesQuery(m: OrgMember, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [m.user.name, m.user.email, roleLabel(m.user.orgRole), ...m.branches.map((b) => b.branchName)];
  return haystack.some((h) => h.toLowerCase().includes(q));
}

/** Everything except the status tab, so the tab counts follow the other filters. */
export function applyNonStatusFilters(members: OrgMember[], f: MemberFilters): OrgMember[] {
  return members.filter(
    (m) =>
      (f.role === "all" || m.user.orgRole === f.role) &&
      (f.branchId === "all" || m.branches.some((b) => b.branchId === f.branchId)) &&
      matchesQuery(m, f.query),
  );
}

export function filterMembers(members: OrgMember[], f: MemberFilters): OrgMember[] {
  return applyNonStatusFilters(members, f).filter((m) => memberStatus(m) === f.status);
}

/** Tab counts over the whole roster (the numbers in the stat tiles match). */
export function statusCounts(members: OrgMember[]): { active: number; suspended: number } {
  let active = 0;
  for (const m of members) if (memberStatus(m) === "active") active++;
  return { active, suspended: members.length - active };
}

export function hasActiveFilters(f: MemberFilters): boolean {
  return f.role !== "all" || f.branchId !== "all" || f.query.trim() !== "";
}

interface InviteLike {
  email: string;
  orgRole: string | null;
  branchId: string | null;
  branchName: string | null;
}

/** Pending invites that match the current filters. They only ever appear on the Active tab. */
export function filterInvites<T extends InviteLike>(invites: T[], f: MemberFilters): T[] {
  if (f.status !== "active") return [];
  const q = f.query.trim().toLowerCase();
  return invites.filter(
    (i) =>
      (f.role === "all" || i.orgRole === f.role) &&
      (f.branchId === "all" || i.branchId === f.branchId) &&
      (!q || [i.email, i.branchName ?? "", roleLabel(i.orgRole)].some((h) => h.toLowerCase().includes(q))),
  );
}

/** Distinct branches across the roster, by name, for the branch filter. */
export function branchChoices(members: OrgMember[]): Array<{ id: string; name: string }> {
  const seen = new Map<string, string>();
  for (const m of members) for (const b of m.branches) seen.set(b.branchId, b.branchName);
  return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
