import type { OrgMember } from "@/features/organization/api/organization.api";
import type { MemberWorkload } from "../types";
import { isMemberSuspended } from "./role-helpers";

/** Roles that can take over deals, tasks, tickets and clients (mirrors the server's owner check). */
const OWNER_ROLES = ["org_admin", "branch_manager", "agent"];

export function needsNewOwner(w: MemberWorkload): boolean {
  return w.openDeals + w.openTasks + w.openTickets + w.clients > 0;
}

function canOwnWork(m: OrgMember): boolean {
  if (!m.user.orgRole || !OWNER_ROLES.includes(m.user.orgRole)) return false;
  return !isMemberSuspended(m) && m.branches.some((b) => b.isActive);
}

/** Active members (not the removed person) who can take over their work. */
export function eligibleNewOwners(members: OrgMember[], removedId: string): OrgMember[] {
  return members.filter((m) => m.user.id !== removedId && canOwnWork(m));
}

/** A branch manager of one of the removed user's branches, else the first eligible person. */
export function defaultNewOwner(members: OrgMember[], removed: OrgMember): string {
  const eligible = eligibleNewOwners(members, removed.user.id);
  const active = removed.branches.filter((b) => b.isActive);
  // A suspended person has no active branches: fall back to all of theirs.
  const branchIds = new Set((active.length > 0 ? active : removed.branches).map((b) => b.branchId));
  const sameBranchManager = eligible.find(
    (m) => m.user.orgRole === "branch_manager" && m.branches.some((b) => b.isActive && branchIds.has(b.branchId)),
  );
  return (sameBranchManager ?? eligible[0])?.user.id ?? "";
}

export const REMOVE_WORD = "REMOVE";

/** Typed confirmation: case-insensitive, trimmed (same leniency as the design). */
export function isRemoveConfirmed(typed: string): boolean {
  return typed.trim().toUpperCase() === REMOVE_WORD;
}

export function workloadSummary(w: MemberWorkload): string {
  const parts: string[] = [];
  const add = (n: number, one: string, many: string) => {
    if (n > 0) parts.push(`${n} ${n === 1 ? one : many}`);
  };
  add(w.openDeals, "open deal", "open deals");
  add(w.openTasks, "open task", "open tasks");
  add(w.openTickets, "open ticket", "open tickets");
  add(w.clients, "client", "clients");
  return parts.join(", ");
}
