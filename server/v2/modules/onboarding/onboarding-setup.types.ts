import type { ActorContext } from "../invite/invite.service";

export type OnboardingStatus = "pending" | "complete";
export type BusinessType = "single" | "multi";

/** Stored at organization.settings.onboarding. */
export interface OnboardingSettings {
  status: OnboardingStatus;
  version: number;
  businessType?: BusinessType;
  /** The branch created at signup; the only one the wizard may claim. Absent on legacy orgs. */
  placeholderBranchId?: string;
  /** True once the signup placeholder branch has been turned into a real shop. */
  defaultBranchClaimed?: boolean;
  completedAt?: string;
}

export interface OnboardingChecklist {
  account: boolean;
  business: boolean;
  invites: boolean;
  targets: boolean;
  enquiry: boolean;
}

export interface OnboardingState {
  status: OnboardingStatus;
  businessType: BusinessType | null;
  business: { name: string; phone: string; address: string; website: string; email: string };
  owner: { firstName: string; lastName: string; email: string };
  branches: Array<{ id: string; name: string; phone: string; address: string; email: string; isDefault: boolean; isPlaceholder: boolean }>;
  homeworkerCommission: number | null;
  checklist: OnboardingChecklist;
}

export interface BusinessInput {
  businessType: BusinessType;
  businessName: string;
  phone: string;
  address: string;
  website: string;
  email: string;
}

export interface ShopInput {
  name: string;
  phone: string;
  address: string;
  email: string;
  managerEmail: string;
}

export type ManagerInviteOutcome = "sent" | "skipped" | "error" | "not_attempted";

export interface ShopResult {
  index: number;
  status: "created" | "updated" | "error";
  branchId?: string;
  error?: string;
  code?: string;
  managerInvite: ManagerInviteOutcome;
  managerInviteError?: string;
}

export type OnboardingActor = ActorContext;
