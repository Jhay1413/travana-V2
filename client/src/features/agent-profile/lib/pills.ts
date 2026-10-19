// Deep import on purpose: the feature index pulls in the Team page, which a node unit test cannot load.
import { roleLabel } from "@/features/team/lib/role-helpers";
import type { AgentProfileHeader } from "../types";

export interface ProfilePills {
  role: string;
  branches: string[];
  engagement: string;
}

/** Roles that role-helpers does not list but a viewer may still open a profile for. */
const EXTRA_ROLE_LABEL: Record<string, string> = {
  platform_admin: "Platform admin",
};

export function primaryRoleLabel(primaryRole: string | null): string {
  if (!primaryRole) return "Team member";
  return EXTRA_ROLE_LABEL[primaryRole] ?? roleLabel(primaryRole);
}

/** Active branches first; a person with only inactive branches still shows them. */
export function branchNames(header: AgentProfileHeader): string[] {
  const active = header.branches.filter((b) => b.isActive);
  const list = active.length > 0 ? active : header.branches;
  return list.map((b) => b.name);
}

export function buildPills(header: AgentProfileHeader): ProfilePills {
  return {
    role: primaryRoleLabel(header.primaryRole),
    branches: branchNames(header),
    engagement: header.isHomeworker ? "Self-employed homeworker" : "Employee",
  };
}

export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
  return letters || "?";
}
