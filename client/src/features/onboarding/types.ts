export type OnboardingStatus = "pending" | "complete";
export type BusinessType = "single" | "multi";

export interface OnboardingBusiness {
  name: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  email: string | null;
}

export interface OnboardingOwner {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
}

export interface OnboardingBranch {
  id: string;
  name: string;
  phone: string | null;
  address: string | null;
  email: string | null;
  isDefault: boolean;
  /** True only for the unclaimed placeholder branch created at signup. Never shown. */
  isPlaceholder: boolean;
}

export type ChecklistKey = "account" | "business" | "invites" | "targets" | "enquiry";
export type OnboardingChecklist = Record<ChecklistKey, boolean>;

/** GET /api/v2/onboarding/state (also the body of PUT /business). */
export interface OnboardingState {
  status: OnboardingStatus;
  businessType: BusinessType | null;
  business: OnboardingBusiness;
  owner: OnboardingOwner;
  branches: OnboardingBranch[];
  homeworkerCommission: number | null;
  checklist: OnboardingChecklist;
}

export interface SignupInput {
  businessName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}

export interface SaveBusinessInput {
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

export type ManagerInviteStatus = "sent" | "skipped" | "error" | "not_attempted";

export interface ShopResult {
  index: number;
  status: "created" | "updated" | "error";
  branchId?: string;
  error?: string;
  code?: string;
  managerInvite: ManagerInviteStatus;
  managerInviteError?: string;
}

export interface CreateShopsResult {
  results: ShopResult[];
}

/** Wizard screens. */
export type Step =
  | "business"
  | "agents"
  | "agents-review"
  | "shops"
  | "shops-review"
  | "team"
  | "team-review"
  | "done";

export type RoleValue = "agent" | "branch_manager";

/** One row of the agents / team tables. `role` and `shop` hold what was typed or uploaded until validated. */
export interface PersonRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Team step only: a branch id, the HOMEWORKER_SHOP sentinel, or unmatched spreadsheet text. */
  shop: string;
  /** A role label ("Agent", "Branch Manager") or unrecognised spreadsheet text. */
  role: string;
}

export interface ShopRow {
  id: string;
  name: string;
  phone: string;
  address: string;
  email: string;
  managerEmail: string;
}

export type ReviewState =
  | { kind: "agents" | "team"; fileName: string; rows: PersonRow[] }
  | { kind: "shops"; fileName: string; rows: ShopRow[] };

export interface InviteResult {
  status: "sent" | "error";
  /** Error text, or a note on a sent row (e.g. already invited as shop manager). */
  message?: string;
}
