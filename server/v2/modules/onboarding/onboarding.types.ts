export type OpeningPattern = "mon-fri" | "mon-sat" | "seven-days";

export interface DayHours {
  day: string;
  open: boolean;
  openTime: string;
  closeTime: string;
}

export interface BranchPayload {
  name: string;
  address: string;
  phone: string;
  email: string;
  openingPattern: OpeningPattern;
  bankHolidaysOpen: boolean;
  openingHours: DayHours[];
}

export type AgentRole = "Agent" | "Senior Agent" | "Manager" | "Admin";

export type ContactRelationship =
  | "Spouse"
  | "Parent"
  | "Sibling"
  | "Child"
  | "Friend"
  | "Other";

export interface AgentContactPerson {
  name: string;
  relationship: ContactRelationship;
  phone: string;
}

export interface AgentPayload {
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: AgentRole;
  active: boolean;
  branchIndex?: number;
  contactPerson?: AgentContactPerson;
}

export interface SignupPayload {
  agencyName: string;
  slug: string;
  brandColor?: string;
  logoUrl?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  branches: BranchPayload[];
  agents: AgentPayload[];
  hasHomeworkers: boolean;
  homeworkerCommission?: number;
}

export interface SignupResult {
  orgId: string;
  userId: string;
  branchIds: string[];
  message: string;
}
