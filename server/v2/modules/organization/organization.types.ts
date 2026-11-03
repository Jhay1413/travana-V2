export interface Organization {
  id:           string;
  name:         string;
  slug:         string;
  plan:         'starter' | 'growth' | 'enterprise' | null;
  isActive:     boolean;
  seatLimit:    number | null;
  brandColor:   string | null;
  logoUrl:      string | null;
  settings:     Record<string, unknown>;
  createdAt:    Date;
  trialEndsAt:  Date | null;
}

/** Seats in use for an org. `limit` and `available` are null when the plan is unlimited. */
export interface SeatUsage {
  limit:          number | null;
  activeMembers:  number;
  pendingInvites: number;
  used:           number;
  available:      number | null;
}

/** Open work that Remove hands over to a new owner. */
export interface MemberWorkload {
  openDeals:   number;
  openTasks:   number;
  openTickets: number;
  clients:     number;
}

export interface RemoveMemberResult {
  userId: string;
  moved:  MemberWorkload;
}

export interface MemberProfilePatch {
  firstName?:   string;
  lastName?:    string;
  phoneNumber?: string;
}
