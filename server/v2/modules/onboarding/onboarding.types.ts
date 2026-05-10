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

export interface AgentPayload {
  name: string;
  email: string;
  phone?: string;
  role: AgentRole;
  active: boolean;
  branchIndex?: number;
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
}

export interface SignupResult {
  orgId: string;
  userId: string;
  branchIds: string[];
  message: string;
}
