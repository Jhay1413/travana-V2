/**
 * Read-only role defaults for the Teams & Roles screen. Access in V2 follows the
 * role, so these are information only: there are no per-person overrides.
 */

export interface PermissionDef {
  key: string;
  label: string;
  desc: string;
}

export interface PermissionGroup {
  group: string;
  items: PermissionDef[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    group: "Clients & pipeline",
    items: [
      { key: "own", label: "View own clients", desc: "See and work on their own clients, enquiries and quotes" },
      { key: "branch", label: "View all branch clients", desc: "See every client in their branch" },
      { key: "create", label: "Create enquiries & quotes", desc: "Add new enquiries and send quotes" },
      { key: "book", label: "Edit & confirm bookings", desc: "Confirm, amend and cancel bookings" },
      { key: "reassign", label: "Reassign clients", desc: "Move clients between team members" },
    ],
  },
  {
    group: "Finance",
    items: [
      { key: "p_own", label: "View own profit", desc: "See their own profit and commission" },
      { key: "p_branch", label: "View branch profit & commission", desc: "See profit, commission and PPB for the whole branch" },
      { key: "targets", label: "Set targets", desc: "Set monthly targets for themselves or others" },
    ],
  },
  {
    group: "Communication",
    items: [
      { key: "social", label: "Social Posts", desc: "Create and schedule social posts" },
      { key: "inbox", label: "Inbox", desc: "Read and reply to client emails" },
      { key: "chat", label: "Live Chat", desc: "Answer website live chat" },
    ],
  },
  {
    group: "Team & admin",
    items: [
      { key: "users", label: "Manage users & roles", desc: "Invite, edit, suspend and remove users" },
      { key: "branches", label: "Manage branches", desc: "Add and edit branches" },
      { key: "billing", label: "Account info & billing", desc: "See the plan, seats and invoices" },
      { key: "data", label: "Data management & exports", desc: "Import and export client data" },
      { key: "ai", label: "AI Assistant", desc: "Use Luna to draft and search" },
      { key: "settings", label: "Settings & branding", desc: "Change organisation settings and branding" },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
export const PERMISSION_COUNT = ALL_PERMISSIONS.length;

const AGENT_PERMISSIONS = ["own", "create", "book", "p_own", "inbox", "chat", "ai"];

/** Roles that appear in the permission matrix, in display order. */
export const MATRIX_ROLES = ["org_admin", "branch_manager", "agent", "social_media_manager", "homeworker"] as const;
export type MatrixRole = (typeof MATRIX_ROLES)[number];

export const ROLE_PERMISSIONS: Record<MatrixRole, string[]> = {
  org_admin: ALL_PERMISSIONS,
  branch_manager: ALL_PERMISSIONS.filter((k) => k !== "billing" && k !== "settings"),
  agent: AGENT_PERMISSIONS,
  social_media_manager: ["social", "inbox", "ai"],
  homeworker: AGENT_PERMISSIONS.filter((k) => k !== "ai"),
};

export interface RoleDisplay {
  label: string;
  blurb: string;
  /** Tailwind classes for the role pill (light + dark). */
  pill: string;
}

export const ROLE_DISPLAY: Record<MatrixRole | "referral_agent", RoleDisplay> = {
  org_admin: { label: "Owner / Admin", blurb: "Everything, including billing and settings", pill: "bg-role-owner-bg text-role-owner-fg" },
  branch_manager: { label: "Branch Manager", blurb: "Runs a branch and its team", pill: "bg-role-branch-bg text-role-branch-fg" },
  agent: { label: "Agent", blurb: "Works their own clients and quotes", pill: "bg-role-agent-bg text-role-agent-fg" },
  social_media_manager: { label: "Social Media Manager", blurb: "Posts and answers the inbox", pill: "bg-role-social-bg text-role-social-fg" },
  homeworker: { label: "Homeworker", blurb: "Works from home with their own branch", pill: "bg-role-home-bg text-role-home-fg" },
  referral_agent: { label: "Referral partner", blurb: "Referral hub only", pill: "bg-role-referral-bg text-role-referral-fg" },
};

export const REFERRAL_NOTE = "Referral hub only";

function isMatrixRole(role: string | null | undefined): role is MatrixRole {
  return !!role && (MATRIX_ROLES as readonly string[]).includes(role);
}

export function permissionsForRole(role: string | null | undefined): string[] {
  return isMatrixRole(role) ? ROLE_PERMISSIONS[role] : [];
}

/** How many of the 17 permissions a role starts with. Unknown roles and referral partners count 0. */
export function permissionCount(role: string | null | undefined): number {
  return permissionsForRole(role).length;
}

export function roleHasPermission(role: string | null | undefined, key: string): boolean {
  return permissionsForRole(role).includes(key);
}

export function roleDisplay(role: string | null | undefined): RoleDisplay {
  if (role === "referral_agent") return ROLE_DISPLAY.referral_agent;
  return isMatrixRole(role) ? ROLE_DISPLAY[role] : ROLE_DISPLAY.agent;
}
