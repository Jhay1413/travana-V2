export interface NeonClient {
  id: string;
  title: string | null;
  firstName: string;
  surename: string;
  DOB: string | null;
  phoneNumber: string;
  email: string | null;
  emailIsAllowed: boolean | null;
  VMB: string | null;
  VMBfirstAccess: string | null;
  whatsAppVerified: boolean;
  mailAllowed: boolean | null;
  houseNumber: string | null;
  city: string | null;
  street: string | null;
  country: string | null;
  post_code: string | null;
  avatarUrl: string | null;
  badge: string | null;
  // Opt-in for the SendSeven AI auto-reply on conversations linked to this
  // client (default false — the bot stays silent until an agent enables it).
  aiReplyEnabled: boolean;
  createdAt: string;
  referrerId: string | null;
  referredByClientId: string | null;
  vipTier: "standard" | "gold" | "elite" | null;
  vipEnrolledAt: string | null;
  totalReferrals: number;
}

export interface NeonClientImportRow {
  title?: string;
  firstName: string;
  surename: string;
  DOB?: string;
  phoneNumber: string;
  email?: string;
  emailIsAllowed?: boolean;
  VMB?: string;
  VMBfirstAccess?: string;
  whatsAppVerified?: boolean;
  mailAllowed?: boolean;
  houseNumber?: string;
  city?: string;
  street?: string;
  country?: string;
  post_code?: string;
  avatarUrl?: string;
  badge?: string;
  referrerId?: string;
}

export interface ImportResult {
  imported: number;
  errors: Array<{ row: number; id: string; error: string }>;
}

export interface PaginatedNeonClients {
  clients: NeonClient[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * One phone number shared by two or more active clients. `phoneKey` is the
 * server's normalized grouping key (the last 9 digits) — pass it back to fetch
 * the group; show `samplePhone` to the user instead, it keeps the original
 * formatting.
 */
export interface DuplicatePhoneGroup {
  phoneKey: string;
  clientCount: number;
  samplePhone: string;
  clientNames: string;
}

export interface PaginatedDuplicatePhoneGroups {
  groups: DuplicatePhoneGroup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DuplicateGroupClient extends NeonClient {
  enquiryCount: number;
  quoteCount: number;
  bookingCount: number;
  lastActivityAt: string | null;
}

export interface DuplicatePhoneGroupDetail {
  phoneKey: string;
  /** Server-sorted: most bookings first, so `clients[0]` is the likeliest real record. */
  clients: DuplicateGroupClient[];
}

export interface MergeDuplicatesResult {
  target: NeonClient;
  mergedIds: string[];
  failed: Array<{ id: string; error: string }>;
}
