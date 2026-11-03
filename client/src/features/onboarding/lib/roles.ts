import type { RoleValue } from "../types";

export const ROLES: readonly RoleValue[] = ["agent", "branch_manager"];

export const ROLE_LABELS: Record<RoleValue, string> = {
  agent: "Agent",
  branch_manager: "Branch Manager",
};

/** Value of the "no shop" choice in the team table. */
export const HOMEWORKER_SHOP = "homeworker";
export const HOMEWORKER_LABEL = "Homeworker";

/**
 * Turn whatever someone typed or uploaded into a role. Only exact wording is accepted:
 * "agent" or blank is Agent; "branch manager", "shop manager", "manager" and "bm" are Branch Manager.
 * Anything else (Sales Manager, Social Media Manager, Homeworker...) returns null and fails validation.
 */
export function parseRole(raw: string): RoleValue | null {
  const v = raw.trim().toLowerCase().replace(/\s+/g, " ");
  if (v === "" || v === "agent") return "agent";
  if (v === "branch manager" || v === "shop manager" || v === "manager" || v === "bm") return "branch_manager";
  return null;
}

/** True when an uploaded role cell says the person is a homeworker. */
export function isHomeworkerText(raw: string): boolean {
  return raw.trim().toLowerCase() === "homeworker";
}
