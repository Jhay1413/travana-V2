import { and, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { phoneDigitsCondition } from "../../utils/phone-search";
import {
  accomodation_list,
  board_basis,
  booking,
  booking_accomodation,
  clientTable,
  country,
  destination,
  enquiry_destination,
  enquiry_table,
  package_type,
  park,
  quote,
  quote_accomodation,
  resorts,
  transaction,
  user,
} from "@shared/schema";

// Repository for the internal-chat assistant's client-lookup tools
// (search_clients / get_client_details / get_client_records). This
// repository NEVER decides access — it only applies the already-resolved,
// explicit visibility filter handed to it by
// internal-chat-clients.service.ts#resolveClientAccess.
//
// The identity/search/count queries below are identity-only (name/status/
// assigned agent) or count-only (pipeline totals) — no contact fields
// (email/phone/address) are ever selected there. The getClient*Details
// queries (used by get_client_records) are the ONE place in this module
// that DOES select financial fields (sales_price/package_commission/etc) —
// deliberately so, since that tool is staff-facing and explicitly allowed to
// share prices/commission; contact fields remain excluded even there.

// Guards against a non-UUID id (e.g. a value the model invented) reaching a
// `= uuid` comparison, which Postgres rejects with error 22P02.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClientVisibilityLevel = "own" | "branch" | "org" | "all";

export interface ResolvedClientScope {
  level: ClientVisibilityLevel;
  orgId?: string;
  branchId?: string;
  userId?: string;
}

export interface ClientIdentityRow {
  id: string;
  firstName: string;
  surename: string;
  status: "active" | "merged";
  createdAt: Date;
  assignedAgentName: string | null;
  // The client's OWN org — kept internal (never surfaced in the tool
  // response) but needed to correctly scope pipeline counts for
  // platform_admin ('all' level), where the caller's own scope.orgId may
  // not match the queried client's org.
  orgId: string | null;
}

export interface ClientPipelineCountsRow {
  enquiries: number;
  quotes: number;
  bookings: number;
  latestStatus: string | null;
  latestDate: Date | null;
}

// Bounds the payload of get_client_records: each of the enquiry/quote/booking
// lists is capped to this many rows (most recent first) so the tool result
// stays a reasonable size for the model. `truncated` on the returned wrapper
// tells the caller whether more rows exist beyond the cap.
const RECORD_LIMIT = 25;

export interface ClientEnquiryDetailRow {
  id: string;
  transactionId: string;
  title: string | null;
  status: string | null;
  holidayTypeName: string | null;
  destinations: string[];
  travelDate: string | null;
  adults: number | null;
  children: number | null;
  infants: number | null;
  budget: string | null;
  maxBudget: string | null;
  dateCreated: Date | null;
  dateExpiry: Date | null;
}

export interface ClientQuoteDetailRow {
  id: string;
  transactionId: string;
  title: string | null;
  quoteRef: string | null;
  quoteStatus: string | null;
  holidayTypeName: string | null;
  destinationName: string | null;
  resortName: string | null;
  countryName: string | null;
  boardBasisName: string | null;
  travelDate: string;
  numOfNights: number | null;
  adult: number | null;
  child: number | null;
  infant: number | null;
  salesPrice: string | null;
  packageCommission: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  pricePerPerson: string;
  dateCreated: Date | null;
  dateExpiry: Date | null;
  // True for quotes created through the "quick/free quote" flow (no real
  // deal behind them yet). Surfaced here — unlike the org-wide analytics
  // module — because a per-client listing must show everything attached to
  // the client; the model uses this flag to describe the quote accurately.
  isFreeQuote: boolean;
}

export interface ClientBookingDetailRow {
  id: string;
  transactionId: string;
  title: string | null;
  haysRef: string;
  supplierRef: string;
  bookingStatus: string | null;
  holidayTypeName: string | null;
  destinationName: string | null;
  resortName: string | null;
  countryName: string | null;
  boardBasisName: string | null;
  travelDate: string;
  numOfNights: number | null;
  adult: number;
  child: number;
  infant: number;
  salesPrice: string | null;
  packageCommission: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  pricePerPerson: string;
  dateCreated: Date | null;
}

export interface ClientDetailRowsResult<T> {
  rows: T[];
  truncated: boolean;
}

// Shared client + org + is_test scoping for all three getClient*Details
// queries below — the caller has ALREADY passed the client-visibility gate
// for this specific client (via findClientById), so — exactly like
// getClientPipelineCounts — this deliberately does NOT re-apply branch/user
// transaction scope on top.
function buildClientRecordTxnConds(clientId: string, orgId: string): SQL[] {
  return [eq(transaction.client_id, clientId), eq(transaction.org_id, orgId), eq(transaction.is_test, false)];
}

const IDENTITY_COLUMNS = {
  id: clientTable.id,
  firstName: clientTable.firstName,
  surename: clientTable.surename,
  status: clientTable.status,
  createdAt: clientTable.createdAt,
  assignedAgentName: user.name,
  orgId: clientTable.orgId,
};

// Builds EXPLICIT client-visibility conditions from an already-resolved
// access level, scoped on client_table's OWNER columns (org_id/branch_id/
// created_by) — NOT on transactions. Deliberately closed (no widening
// fallback when branchId/userId is missing — that's the caller's job to
// have already denied via resolveClientAccess). Merged (soft-archived)
// duplicates are always excluded.
function buildClientVisibilityConds(resolved: ResolvedClientScope): SQL[] {
  const conds: SQL[] = [eq(clientTable.status, "active")];
  if (resolved.level === "all") return conds;

  if (resolved.orgId) conds.push(eq(clientTable.orgId, resolved.orgId));

  if (resolved.level === "branch" && resolved.branchId) {
    conds.push(eq(clientTable.branchId, resolved.branchId));
  } else if (resolved.level === "own" && resolved.userId) {
    conds.push(eq(clientTable.createdBy, resolved.userId));
  }

  return conds;
}

export const internalChatClientsRepository = {
  // Identity-only search (mirrors neon-client.repository.ts's ILIKE search
  // clause) intersected with the caller's visibility filter. NO email/phone/
  // address columns are selected — only what's needed to identify the client
  // and name their assigned agent.
  async searchClients(
    resolved: ResolvedClientScope,
    term: string,
    limit = 8,
  ): Promise<ClientIdentityRow[]> {
    const trimmed = term.trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordTerms = words.map((w) => `%${w}%`);

    const phoneDigits = trimmed ? phoneDigitsCondition(clientTable.phoneNumber, trimmed) : null;
    const searchClause = trimmed
      ? or(
          ...wordTerms.map((t) => ilike(clientTable.firstName, t)),
          ...wordTerms.map((t) => ilike(clientTable.surename, t)),
          ilike(clientTable.email, `%${trimmed}%`),
          ilike(clientTable.phoneNumber, `%${trimmed}%`),
          ...(phoneDigits ? [phoneDigits] : []),
          sql`concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ilike ${`%${trimmed}%`}`,
        )
      : undefined;

    const conds: SQL[] = [...buildClientVisibilityConds(resolved)];
    if (searchClause) conds.push(searchClause);

    return db
      .select(IDENTITY_COLUMNS)
      .from(clientTable)
      .leftJoin(user, eq(clientTable.createdBy, user.id))
      .where(and(...conds))
      .orderBy(desc(clientTable.createdAt))
      .limit(limit);
  },

  // Same visibility filter, keyed by id. Out-of-scope ids resolve to `null`
  // (never leak whether the row exists outside the caller's visibility). A
  // non-UUID id (e.g. a value the model invented instead of using one from
  // search_clients) also returns null rather than crashing Postgres with a
  // uuid cast error (22P02).
  async findClientById(resolved: ResolvedClientScope, id: string): Promise<ClientIdentityRow | null> {
    if (!UUID_RE.test(id.trim())) return null;
    const conds: SQL[] = [eq(clientTable.id, id.trim()), ...buildClientVisibilityConds(resolved)];

    const [row] = await db
      .select(IDENTITY_COLUMNS)
      .from(clientTable)
      .leftJoin(user, eq(clientTable.createdBy, user.id))
      .where(and(...conds))
      .limit(1);

    return row ?? null;
  },

  // Counts of the client's FULL pipeline within their org — the caller has
  // already passed the client-visibility gate for this specific client (via
  // findClientById), so this deliberately does NOT re-apply branch/user
  // filtering on the transactions (that would under-report the authorized
  // client's own history). Row-level consistency filters: is_active
  // NULL-or-true on all three, quotes additionally deleted_at IS NULL.
  // Deliberately DOES NOT apply quoteStatsConds() (used by
  // internal-chat-analytics.repository.ts for org-wide aggregate stats) —
  // that helper excludes free/quick quotes and client-less quotes, which is
  // correct for aggregate totals but wrong here: staff asking about a
  // SPECIFIC client need to see everything attached to that client,
  // including quotes created through the free-quote flow (a large share of
  // real, client-attached quotes have isFreeQuote=true). Returns counts +
  // latest transaction status/date only — NO prices/amounts.
  async getClientPipelineCounts(clientId: string, orgId: string): Promise<ClientPipelineCountsRow> {
    const txConds: SQL[] = [
      eq(transaction.client_id, clientId),
      eq(transaction.org_id, orgId),
      eq(transaction.is_test, false),
    ];

    const [enquiryRow, quoteRow, bookingRow, latestTxRow] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enquiry_table)
        .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
        .where(and(...txConds, sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`)),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(
          and(
            ...txConds,
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(and(...txConds, sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`)),

      db
        .select({ status: transaction.status, createdAt: transaction.created_at })
        .from(transaction)
        .where(and(...txConds))
        .orderBy(desc(transaction.created_at))
        .limit(1),
    ]);

    return {
      enquiries: Number(enquiryRow[0]?.count ?? 0),
      quotes: Number(quoteRow[0]?.count ?? 0),
      bookings: Number(bookingRow[0]?.count ?? 0),
      latestStatus: latestTxRow[0]?.status ?? null,
      latestDate: latestTxRow[0]?.createdAt ?? null,
    };
  },

  // Itemized enquiry list for get_client_records. Row-consistency filter
  // mirrors getClientPipelineCounts (is_active NULL-or-true). Destinations are
  // resolved the same way as transaction.repository.ts#enrichTransactions:
  // enquiry_destination joined to destination, falling back to park (holiday
  // park-only enquiries store their destination as a park id).
  async getClientEnquiryDetails(clientId: string, orgId: string): Promise<ClientDetailRowsResult<ClientEnquiryDetailRow>> {
    const txConds = buildClientRecordTxnConds(clientId, orgId);

    const rows = await db
      .select({
        id: enquiry_table.id,
        transactionId: enquiry_table.transaction_id,
        title: enquiry_table.title,
        status: enquiry_table.status,
        holidayTypeName: package_type.name,
        travelDate: enquiry_table.travel_date,
        adults: enquiry_table.adults,
        children: enquiry_table.children,
        infants: enquiry_table.infants,
        budget: enquiry_table.budget,
        maxBudget: enquiry_table.max_budget,
        dateCreated: enquiry_table.date_created,
        dateExpiry: enquiry_table.date_expiry,
      })
      .from(enquiry_table)
      .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
      .leftJoin(package_type, eq(enquiry_table.holiday_type_id, package_type.id))
      .where(and(...txConds, sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`))
      .orderBy(desc(enquiry_table.date_created))
      .limit(RECORD_LIMIT + 1);

    const truncated = rows.length > RECORD_LIMIT;
    const limited = rows.slice(0, RECORD_LIMIT);

    const enquiryIds = limited.map((r) => r.id);
    const destinationRows =
      enquiryIds.length > 0
        ? await db
            .select({
              enquiryId: enquiry_destination.enquiry_id,
              name: sql<string | null>`COALESCE(${destination.name}, ${park.name})`,
            })
            .from(enquiry_destination)
            .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
            .leftJoin(park, eq(enquiry_destination.destination_id, park.id))
            .where(inArray(enquiry_destination.enquiry_id, enquiryIds))
        : [];

    const destinationMap = new Map<string, string[]>();
    for (const d of destinationRows) {
      if (!d.enquiryId || !d.name) continue;
      const list = destinationMap.get(d.enquiryId) ?? [];
      list.push(d.name);
      destinationMap.set(d.enquiryId, list);
    }

    return {
      rows: limited.map((r) => ({ ...r, destinations: destinationMap.get(r.id) ?? [] })),
      truncated,
    };
  },

  // Itemized quote list for get_client_records. Row-consistency filters mirror
  // getClientPipelineCounts exactly (deleted_at IS NULL, is_active
  // NULL-or-true) so this returns details for the SAME set of quotes the
  // counts tool counted. Deliberately does NOT apply quoteStatsConds() (see
  // getClientPipelineCounts) — a per-client record listing must include
  // quick/free quotes attached to the client, not just "real deal" quotes;
  // isFreeQuote is selected below so the model can flag them as such.
  // Destination/resort/country/board-basis names are resolved via the
  // quote's PRIMARY accommodation — the same
  // quote_accomodation(is_primary=true) -> accomodation_list -> resorts ->
  // destination -> country join chain already used across the codebase
  // (see portal.repository.ts#findClientQuotes, quote.repository.ts's public
  // deal-feed query) — reused here rather than reinvented.
  async getClientQuoteDetails(clientId: string, orgId: string): Promise<ClientDetailRowsResult<ClientQuoteDetailRow>> {
    const txConds = buildClientRecordTxnConds(clientId, orgId);

    const rows = await db
      .select({
        id: quote.id,
        transactionId: quote.transaction_id,
        title: quote.title,
        quoteRef: quote.quote_ref,
        quoteStatus: quote.quote_status,
        holidayTypeName: package_type.name,
        destinationName: destination.name,
        resortName: resorts.name,
        countryName: country.country_name,
        boardBasisName: board_basis.type,
        travelDate: quote.travel_date,
        numOfNights: quote.num_of_nights,
        adult: quote.adult,
        child: quote.child,
        infant: quote.infant,
        salesPrice: quote.sales_price,
        packageCommission: quote.package_commission,
        discounts: quote.discounts,
        serviceCharge: quote.service_charge,
        pricePerPerson: quote.price_per_person,
        dateCreated: quote.date_created,
        dateExpiry: quote.date_expiry,
        isFreeQuote: sql<boolean>`coalesce(${quote.isFreeQuote}, false)`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
      .where(
        and(
          ...txConds,
          isNull(quote.deleted_at),
          sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
        ),
      )
      .orderBy(desc(quote.date_created))
      .limit(RECORD_LIMIT + 1);

    const truncated = rows.length > RECORD_LIMIT;
    return { rows: rows.slice(0, RECORD_LIMIT), truncated };
  },

  // Itemized booking list for get_client_records. Row-consistency filter
  // mirrors getClientPipelineCounts (is_active NULL-or-true). Destination/
  // resort/country/board-basis names resolved via the booking's PRIMARY
  // accommodation (booking_accomodation(is_primary=true) -> ...), mirroring
  // portal.repository.ts#findClientBookings.
  async getClientBookingDetails(clientId: string, orgId: string): Promise<ClientDetailRowsResult<ClientBookingDetailRow>> {
    const txConds = buildClientRecordTxnConds(clientId, orgId);

    const rows = await db
      .select({
        id: booking.id,
        transactionId: booking.transaction_id,
        title: booking.title,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        bookingStatus: booking.booking_status,
        holidayTypeName: package_type.name,
        destinationName: destination.name,
        resortName: resorts.name,
        countryName: country.country_name,
        boardBasisName: board_basis.type,
        travelDate: booking.travel_date,
        numOfNights: booking.num_of_nights,
        adult: booking.adult,
        child: booking.child,
        infant: booking.infant,
        salesPrice: booking.sales_price,
        packageCommission: booking.package_commission,
        discounts: booking.discounts,
        serviceCharge: booking.service_charge,
        pricePerPerson: booking.price_per_person,
        dateCreated: booking.date_created,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(package_type, eq(booking.holiday_type_id, package_type.id))
      .leftJoin(booking_accomodation, and(eq(booking_accomodation.booking_id, booking.id), eq(booking_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
      .where(and(...txConds, sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`))
      .orderBy(desc(booking.date_created))
      .limit(RECORD_LIMIT + 1);

    const truncated = rows.length > RECORD_LIMIT;
    return { rows: rows.slice(0, RECORD_LIMIT), truncated };
  },
};
