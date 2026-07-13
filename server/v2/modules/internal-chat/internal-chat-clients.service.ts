import { hasAnyRole, type Scope } from "../../utils/scope";
import {
  internalChatClientsRepository,
  type ClientBookingDetailRow,
  type ClientDetailRowsResult,
  type ClientEnquiryDetailRow,
  type ClientIdentityRow,
  type ClientQuoteDetailRow,
  type ClientVisibilityLevel,
  type ResolvedClientScope,
} from "./internal-chat-clients.repository";

// Business logic for the internal-chat assistant's client-lookup tools
// (search_clients / get_client_details): decides WHO is allowed to see WHICH
// clients (resolveClientAccess — fail-closed), then maps repository rows to
// an identity-only + pipeline-summary shape. NEVER returns contact details
// (email/phone/address) or financial figures (prices/balances/commission) —
// those fields are not even selected by the repository, so there is nothing
// to leak here even by omission mistake.

export type ClientAccessLevel = ClientVisibilityLevel;

// The access decision for a caller: whether they may see ANY client records
// at all, and — if so — at what level and against which id(s). FAIL CLOSED:
// any role/branch/user combination that isn't explicitly recognized as
// permitted comes back `allowed: false` rather than falling back to a wider
// scope. Mirrors internal-chat-analytics.service.ts#resolveAnalyticsAccess,
// but scoped on client_table's OWNER columns (org_id/branch_id/created_by)
// rather than transaction ownership — this is deliberately STRICTER than
// neon-client.repository.ts's buildClientScopeConds, which lets an agent see
// their whole org's clients; here agent/homeworker are locked to clients
// THEY created (their "own" book), and branch_manager never falls back to
// org-wide when branchId is missing.
export interface ClientAccess {
  allowed: boolean;
  level: ClientAccessLevel;
  orgId?: string;
  branchId?: string;
  userId?: string;
  reason?: string;
}

export function resolveClientAccess(scope: Scope): ClientAccess {
  if (hasAnyRole(scope.orgRoles, ["platform_admin"])) {
    return { allowed: true, level: "all" };
  }
  if (hasAnyRole(scope.orgRoles, ["org_admin"])) {
    return { allowed: true, level: "org", orgId: scope.orgId };
  }
  if (hasAnyRole(scope.orgRoles, ["branch_manager"])) {
    if (!scope.branchId) {
      return {
        allowed: false,
        level: "branch",
        reason: "Your account isn't assigned to a branch, so client records aren't available to you.",
      };
    }
    return { allowed: true, level: "branch", orgId: scope.orgId, branchId: scope.branchId };
  }
  if (hasAnyRole(scope.orgRoles, ["agent", "homeworker"])) {
    if (!scope.userId) {
      return {
        allowed: false,
        level: "own",
        reason: "We couldn't identify your account, so client records aren't available to you.",
      };
    }
    return { allowed: true, level: "own", orgId: scope.orgId, userId: scope.userId };
  }
  // referral_agent, social_media_manager, or any unrecognized role.
  return { allowed: false, level: "own", reason: "You don't have access to client records." };
}

function toResolvedScope(access: ClientAccess): ResolvedClientScope {
  return { level: access.level, orgId: access.orgId, branchId: access.branchId, userId: access.userId };
}

// Identity-only summary — deliberately excludes every contact field
// (email/phone/address) that exists on client_table.
export interface ClientIdentitySummary {
  id: string;
  name: string;
  status: "active" | "merged";
  assignedAgent: string | null;
  createdAt: Date;
}

function toIdentitySummary(row: ClientIdentityRow): ClientIdentitySummary {
  return {
    id: row.id,
    name: `${row.firstName} ${row.surename}`.trim(),
    status: row.status,
    assignedAgent: row.assignedAgentName,
    createdAt: row.createdAt,
  };
}

export type ClientSearchResult =
  | { allowed: true; results: ClientIdentitySummary[] }
  | { allowed: false; reason: string };

export interface ClientPipelineSummary {
  enquiries: number;
  quotes: number;
  bookings: number;
  latestActivity: { status: string | null; date: Date | null };
}

export type ClientDetailsResult =
  | { allowed: true; found: true; identity: ClientIdentitySummary; pipeline: ClientPipelineSummary }
  | { allowed: true; found: false; reason: string }
  | { allowed: false; reason: string };

// get_client_records: itemized enquiry/quote/booking details, INCLUDING full
// financials (prices/commission) — this is the one place in the internal-chat
// client tools that's allowed to surface money figures, because it's
// staff-facing and the client has already passed resolveClientAccess. It
// still never returns contact fields (email/phone/address) — those aren't
// selected by the repository at all.
export type ClientRecordType = "enquiries" | "quotes" | "bookings" | "all";

export interface ClientPartySize {
  adults: number | null;
  children: number | null;
  infants: number | null;
}

export interface ClientRecordFinancials {
  salesPrice: string | null;
  packageCommission: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  pricePerPerson: string;
}

export interface ClientEnquiryRecord {
  id: string;
  transactionId: string;
  title: string | null;
  status: string | null;
  holidayType: string | null;
  destinations: string[];
  travelDate: string | null;
  partySize: ClientPartySize;
  budget: { amount: string | null; max: string | null };
  createdAt: Date | null;
  expiresAt: Date | null;
}

export interface ClientQuoteRecord {
  id: string;
  transactionId: string;
  title: string | null;
  quoteRef: string | null;
  status: string | null;
  holidayType: string | null;
  destination: string | null;
  resort: string | null;
  country: string | null;
  boardBasis: string | null;
  travelDate: string;
  nights: number | null;
  partySize: ClientPartySize;
  financials: ClientRecordFinancials;
  createdAt: Date | null;
  expiresAt: Date | null;
}

export interface ClientBookingRecord {
  id: string;
  transactionId: string;
  title: string | null;
  haysRef: string;
  supplierRef: string;
  status: string | null;
  holidayType: string | null;
  destination: string | null;
  resort: string | null;
  country: string | null;
  boardBasis: string | null;
  travelDate: string;
  nights: number | null;
  partySize: { adults: number; children: number; infants: number };
  financials: ClientRecordFinancials;
  createdAt: Date | null;
}

export interface ClientRecordList<T> {
  items: T[];
  truncated: boolean;
}

export type ClientRecordsResult =
  | {
      allowed: true;
      found: true;
      enquiries?: ClientRecordList<ClientEnquiryRecord>;
      quotes?: ClientRecordList<ClientQuoteRecord>;
      bookings?: ClientRecordList<ClientBookingRecord>;
    }
  | { allowed: true; found: false; reason: string }
  | { allowed: false; reason: string };

function toEnquiryRecord(row: ClientEnquiryDetailRow): ClientEnquiryRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    title: row.title,
    status: row.status,
    holidayType: row.holidayTypeName,
    destinations: row.destinations,
    travelDate: row.travelDate,
    partySize: { adults: row.adults, children: row.children, infants: row.infants },
    budget: { amount: row.budget, max: row.maxBudget },
    createdAt: row.dateCreated,
    expiresAt: row.dateExpiry,
  };
}

function toQuoteRecord(row: ClientQuoteDetailRow): ClientQuoteRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    title: row.title,
    quoteRef: row.quoteRef,
    status: row.quoteStatus,
    holidayType: row.holidayTypeName,
    destination: row.destinationName,
    resort: row.resortName,
    country: row.countryName,
    boardBasis: row.boardBasisName,
    travelDate: row.travelDate,
    nights: row.numOfNights,
    partySize: { adults: row.adult, children: row.child, infants: row.infant },
    financials: {
      salesPrice: row.salesPrice,
      packageCommission: row.packageCommission,
      discounts: row.discounts,
      serviceCharge: row.serviceCharge,
      pricePerPerson: row.pricePerPerson,
    },
    createdAt: row.dateCreated,
    expiresAt: row.dateExpiry,
  };
}

function toBookingRecord(row: ClientBookingDetailRow): ClientBookingRecord {
  return {
    id: row.id,
    transactionId: row.transactionId,
    title: row.title,
    haysRef: row.haysRef,
    supplierRef: row.supplierRef,
    status: row.bookingStatus,
    holidayType: row.holidayTypeName,
    destination: row.destinationName,
    resort: row.resortName,
    country: row.countryName,
    boardBasis: row.boardBasisName,
    travelDate: row.travelDate,
    nights: row.numOfNights,
    partySize: { adults: row.adult, children: row.child, infants: row.infant },
    financials: {
      salesPrice: row.salesPrice,
      packageCommission: row.packageCommission,
      discounts: row.discounts,
      serviceCharge: row.serviceCharge,
      pricePerPerson: row.pricePerPerson,
    },
    createdAt: row.dateCreated,
  };
}

function toRecordList<TRow, TRecord>(
  result: ClientDetailRowsResult<TRow>,
  mapRow: (row: TRow) => TRecord,
): ClientRecordList<TRecord> {
  return { items: result.rows.map(mapRow), truncated: result.truncated };
}

export const internalChatClientsService = {
  async searchClients(scope: Scope, query: string): Promise<ClientSearchResult> {
    const access = resolveClientAccess(scope);
    if (!access.allowed) {
      return { allowed: false, reason: access.reason ?? "You don't have access to client records." };
    }
    const rows = await internalChatClientsRepository.searchClients(toResolvedScope(access), query);
    return { allowed: true, results: rows.map(toIdentitySummary) };
  },

  async getClientDetails(scope: Scope, clientId: string): Promise<ClientDetailsResult> {
    const access = resolveClientAccess(scope);
    if (!access.allowed) {
      return { allowed: false, reason: access.reason ?? "You don't have access to client records." };
    }

    const resolved = toResolvedScope(access);
    const row = await internalChatClientsRepository.findClientById(resolved, clientId);
    if (!row) {
      return { allowed: true, found: false, reason: "That client wasn't found, or isn't visible to you." };
    }

    // Use the CLIENT'S OWN org (not access.orgId, which is undefined for
    // platform_admin's 'all' level and could otherwise mismatch a
    // cross-org client) to scope the pipeline counts correctly.
    if (!row.orgId) {
      return { allowed: true, found: false, reason: "That client wasn't found, or isn't visible to you." };
    }

    const counts = await internalChatClientsRepository.getClientPipelineCounts(row.id, row.orgId);

    return {
      allowed: true,
      found: true,
      identity: toIdentitySummary(row),
      pipeline: {
        enquiries: counts.enquiries,
        quotes: counts.quotes,
        bookings: counts.bookings,
        latestActivity: { status: counts.latestStatus, date: counts.latestDate },
      },
    };
  },

  // get_client_records: a specific client's enquiry/quote/booking DETAILS
  // (destinations, dates, status, refs, and full financials incl. prices and
  // commission). Gated exactly like getClientDetails — resolveClientAccess
  // first (fail closed), then findClientById re-checks that THIS specific
  // client is visible to the caller (an out-of-scope or nonexistent id comes
  // back as the same generic "not found or not visible" message, so the
  // model can never distinguish the two and enumerate client ids). Only once
  // both checks pass do we fetch the requested detail list(s), scoped to the
  // client's own org and non-test transactions.
  async getClientRecords(
    scope: Scope,
    clientId: string,
    type: ClientRecordType = "all",
  ): Promise<ClientRecordsResult> {
    const access = resolveClientAccess(scope);
    if (!access.allowed) {
      return { allowed: false, reason: access.reason ?? "You don't have access to client records." };
    }

    const resolved = toResolvedScope(access);
    const row = await internalChatClientsRepository.findClientById(resolved, clientId);
    if (!row || !row.orgId) {
      return { allowed: true, found: false, reason: "That client wasn't found, or isn't visible to you." };
    }

    const wantEnquiries = type === "all" || type === "enquiries";
    const wantQuotes = type === "all" || type === "quotes";
    const wantBookings = type === "all" || type === "bookings";

    const [enquiryResult, quoteResult, bookingResult] = await Promise.all([
      wantEnquiries
        ? internalChatClientsRepository.getClientEnquiryDetails(row.id, row.orgId)
        : Promise.resolve(undefined),
      wantQuotes
        ? internalChatClientsRepository.getClientQuoteDetails(row.id, row.orgId)
        : Promise.resolve(undefined),
      wantBookings
        ? internalChatClientsRepository.getClientBookingDetails(row.id, row.orgId)
        : Promise.resolve(undefined),
    ]);

    return {
      allowed: true,
      found: true,
      enquiries: enquiryResult ? toRecordList(enquiryResult, toEnquiryRecord) : undefined,
      quotes: quoteResult ? toRecordList(quoteResult, toQuoteRecord) : undefined,
      bookings: bookingResult ? toRecordList(bookingResult, toBookingRecord) : undefined,
    };
  },
};
