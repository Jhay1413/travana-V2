export interface MemberWorkload {
  openDeals: number;
  openTasks: number;
  openTickets: number;
  clients: number;
}

export interface RemoveMemberInput {
  newOwnerId?: string;
  confirm: "REMOVE";
}

export interface RemoveMemberResult {
  userId: string;
  moved: MemberWorkload;
}

export interface MemberProfilePatch {
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
}

export interface MemberProfileResult {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  name: string;
}

export type { AuthBlockCode } from "@/lib/auth-notice";

export type MemberStatus = "active" | "suspended";
export type StatusTab = MemberStatus;

export type DrawerTab = "details" | "permissions";
