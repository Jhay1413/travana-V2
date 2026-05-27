export type OrgRole =
  | "platform_admin"
  | "org_admin"
  | "branch_manager"
  | "agent"
  | "homeworker"
  | "referral_agent";

export type Role = "PlatformAdmin" | "Admin" | "Manager" | "Agent" | "Homeworker" | "Referer";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  orgRole: OrgRole | null;
  /**
   * Full union of org-level roles the user holds in their current org. Populated
   * by /api/auth/user via the user_org_roles junction table plus any active
   * branch_members.orgRole. `orgRole` above is the primary (highest-ranked)
   * derived from this array.
   */
  orgRoles: OrgRole[];
  orgId: string | null;
  branchId: string | null;
  orgName: string | null;
  branchName: string | null;
  avatar: string | null;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phoneNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
