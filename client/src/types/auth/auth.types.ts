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
  orgId: string | null;
  branchId: string | null;
  avatar: string | null;
  image: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  phoneNumber: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}
