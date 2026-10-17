import type { TargetsCanEdit } from "../types";

/** Every edit control is driven by what the server says the caller may change, never by role alone. */
export const canEditShop = (can: TargetsCanEdit, branchId: string): boolean => can.shopBranchIds.includes(branchId);
export const canEditAgentsIn = (can: TargetsCanEdit, branchId: string): boolean => can.agentBranchIds.includes(branchId);

/** The guided allocation changes the business total, so it needs that right. */
export const canRunAllocation = (can: TargetsCanEdit): boolean => can.business;

export const canEditAnyAgents = (can: TargetsCanEdit): boolean => can.agentBranchIds.length > 0;

/** Tabs the agency page shows. Homeworkers is for the owner / admin only. */
export function visibleTabs<T extends string>(tabs: readonly T[], can: TargetsCanEdit): T[] {
  return tabs.filter((t) => t !== "homeworkers" || can.homeworkers);
}
