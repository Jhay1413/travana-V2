import { db } from "../../config/database";
import { transaction, enquiry_table, quote, booking, clientTable, user, enquiry_destination, enquiry_resorts, enquiry_accomodation, enquiry_board_basis, enquiry_departure_airport, destination, package_type, deal_images, quoteImages, bookingImages, accommodation_images, lodge_images, booking_accomodation, booking_flights, booking_transfers, booking_car_hire, booking_attraction_ticket, booking_lounge_pass, booking_airport_parking, park, quote_accomodation, accomodation_list, board_basis, room_type, quote_flights, airport, tour_operator, resorts, country, quote_transfers, quote_car_hire, quote_attraction_ticket, quote_lounge_pass, quote_airport_parking } from "@shared/schema";
import type { Transaction, InsertTransaction, InsertQuote, InsertBooking, InsertQuoteFlight, InsertQuoteAccomodation, InsertBookingFlight, InsertBookingAccomodation } from "@shared/schema";
import { eq, desc, and, sql, inArray, count, or, lt, lte, isNull, gte, type SQL } from "drizzle-orm";
import { randomUUID } from "crypto";
import type { Scope } from "../../utils/scope";

interface ConnectingLeg extends Partial<InsertQuoteFlight> {}
interface BookingConnectingLeg extends Partial<InsertBookingFlight> {}

interface CreateTransactionWithQuoteInput {
  transactionData: InsertTransaction;
  quoteFields: Partial<InsertQuote> & { lodge_id?: string | null };
  outboundFlight?: Partial<InsertQuoteFlight> | null;
  inboundFlight?: Partial<InsertQuoteFlight> | null;
  outboundConnectingLegs?: ConnectingLeg[];
  inboundConnectingLegs?: ConnectingLeg[];
  primaryAccommodation?: (Partial<InsertQuoteAccomodation> & { accomodation_id?: string | null }) | null;
  images?: string[];
  scope: Scope;
}

interface CreateTransactionWithBookingInput {
  transactionData: InsertTransaction;
  bookingFields: Partial<InsertBooking> & { lodge_id?: string | null };
  outboundFlight?: Partial<InsertBookingFlight> | null;
  inboundFlight?: Partial<InsertBookingFlight> | null;
  outboundConnectingLegs?: BookingConnectingLeg[];
  inboundConnectingLegs?: BookingConnectingLeg[];
  primaryAccommodation?: (Partial<InsertBookingAccomodation> & { accomodation_id?: string | null }) | null;
  images?: string[];
  scope: Scope;
}

// package_type is small, near-static lookup data. The pipeline board enriches
// four columns per load (each calling enrich), so re-reading the whole table
// every time is wasted work. Cache it process-wide with a short TTL.
let packageTypeCache: { at: number; map: Map<string, string> } | null = null;
const PACKAGE_TYPE_TTL_MS = 5 * 60 * 1000;

async function getPackageTypeMap(): Promise<Map<string, string>> {
  const now = Date.now();
  if (packageTypeCache && now - packageTypeCache.at < PACKAGE_TYPE_TTL_MS) {
    return packageTypeCache.map;
  }
  const rows = await db.select().from(package_type);
  const map = new Map<string, string>(rows.map((pt) => [pt.id, pt.name]));
  packageTypeCache = { at: now, map };
  return map;
}

// Sum line-item commission per quote / per booking. Mirrors the canonical
// formula in server/v2/utils/commission-sql.ts (totalQuoteCommissionExpr /
// totalBookingCommissionExpr) — all 7 line-item tables on each side. The
// caller adds package_commission separately to get the total.
//
// Each side is a single round-trip: UNION ALL across the 7 line-item tables,
// summed per id in SQL. This replaces the previous 7-queries-per-side fan-out
// (14 round-trips) and is backed by the per-table quote_id / booking_id indexes.
async function fetchServiceCommissionMaps(
  quoteIds: string[],
  bookingIds: string[],
): Promise<{ quoteMap: Map<string, number>; bookingMap: Map<string, number> }> {
  const quoteMap = new Map<string, number>();
  const bookingMap = new Map<string, number>();

  const tasks: Promise<unknown>[] = [];

  if (quoteIds.length > 0) {
    const ids = sql.join(quoteIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT id, SUM(commission) AS commission FROM (
          SELECT ${quote_flights.quote_id} AS id, ${quote_flights.commission} AS commission FROM ${quote_flights} WHERE ${quote_flights.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_accomodation.quote_id}, ${quote_accomodation.commission} FROM ${quote_accomodation} WHERE ${quote_accomodation.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_transfers.quote_id}, ${quote_transfers.commission} FROM ${quote_transfers} WHERE ${quote_transfers.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_car_hire.quote_id}, ${quote_car_hire.commission} FROM ${quote_car_hire} WHERE ${quote_car_hire.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_attraction_ticket.quote_id}, ${quote_attraction_ticket.commission} FROM ${quote_attraction_ticket} WHERE ${quote_attraction_ticket.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_lounge_pass.quote_id}, ${quote_lounge_pass.commission} FROM ${quote_lounge_pass} WHERE ${quote_lounge_pass.quote_id} IN (${ids})
          UNION ALL
          SELECT ${quote_airport_parking.quote_id}, ${quote_airport_parking.commission} FROM ${quote_airport_parking} WHERE ${quote_airport_parking.quote_id} IN (${ids})
        ) t
        WHERE id IS NOT NULL
        GROUP BY id
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; commission: string | null }>) {
          quoteMap.set(r.id, parseFloat(r.commission ?? "0") || 0);
        }
      }),
    );
  }

  if (bookingIds.length > 0) {
    const ids = sql.join(bookingIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT id, SUM(commission) AS commission FROM (
          SELECT ${booking_flights.booking_id} AS id, ${booking_flights.commission} AS commission FROM ${booking_flights} WHERE ${booking_flights.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_accomodation.booking_id}, ${booking_accomodation.commission} FROM ${booking_accomodation} WHERE ${booking_accomodation.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_transfers.booking_id}, ${booking_transfers.commission} FROM ${booking_transfers} WHERE ${booking_transfers.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_car_hire.booking_id}, ${booking_car_hire.commission} FROM ${booking_car_hire} WHERE ${booking_car_hire.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_attraction_ticket.booking_id}, ${booking_attraction_ticket.commission} FROM ${booking_attraction_ticket} WHERE ${booking_attraction_ticket.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_lounge_pass.booking_id}, ${booking_lounge_pass.commission} FROM ${booking_lounge_pass} WHERE ${booking_lounge_pass.booking_id} IN (${ids})
          UNION ALL
          SELECT ${booking_airport_parking.booking_id}, ${booking_airport_parking.commission} FROM ${booking_airport_parking} WHERE ${booking_airport_parking.booking_id} IN (${ids})
        ) t
        WHERE id IS NOT NULL
        GROUP BY id
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; commission: string | null }>) {
          bookingMap.set(r.id, parseFloat(r.commission ?? "0") || 0);
        }
      }),
    );
  }

  await Promise.all(tasks);
  return { quoteMap, bookingMap };
}

function hasFlightData(leg: Partial<InsertQuoteFlight> | Partial<InsertBookingFlight> | null | undefined): boolean {
  if (!leg) return false;
  return Boolean(
    (leg as any).departing_airport_id ||
    (leg as any).arrival_airport_id ||
    (leg as any).departure_date_time ||
    (leg as any).arrival_date_time ||
    (leg as any).flight_number,
  );
}

function buildTxnScopeConds(scope?: Scope, branchOverride?: string): SQL[] {
  const conds: SQL[] = [];
  if (!scope) return conds;

  if (scope.orgRole === "platform_admin") {
    if (branchOverride) conds.push(eq(transaction.branch_id, branchOverride));
    return conds;
  }

  // All non-platform roles are confined to their org.
  conds.push(eq(transaction.org_id, scope.orgId));

  if (scope.orgRole === "branch_manager" || scope.orgRole === "agent") {
    // Branch users are pinned to their own branch — any override is ignored.
    if (scope.branchId) conds.push(eq(transaction.branch_id, scope.branchId));
  } else if (scope.orgRole === "homeworker" && scope.userId) {
    conds.push(eq(transaction.user_id, scope.userId));
  } else if (scope.orgRole === "org_admin" && branchOverride) {
    // org_admin: optional branch narrowing. org_id condition above already
    // prevents cross-org access if a foreign branch id is supplied.
    conds.push(eq(transaction.branch_id, branchOverride));
  }

  return conds;
}

async function enrichTransactions(txns: Transaction[]) {
  if (txns.length === 0) return [];
  const txnIds = txns.map(t => t.id);
  const clientIds = Array.from(new Set(txns.map(t => t.client_id).filter((id): id is string => !!id)));

  const [allEnquiries, allQuotes, allBookings, allPackageTypes, allClients] = await Promise.all([
    db.select().from(enquiry_table).where(inArray(enquiry_table.transaction_id, txnIds)),
    db.select().from(quote).where(and(inArray(quote.transaction_id, txnIds), isNull(quote.deleted_at))),
    db.select().from(booking).where(inArray(booking.transaction_id, txnIds)),
    getPackageTypeMap(),
    clientIds.length > 0
      ? db.select({
          id: clientTable.id,
          title: clientTable.title,
          firstName: clientTable.firstName,
          surename: clientTable.surename,
        }).from(clientTable).where(inArray(clientTable.id, clientIds))
      : Promise.resolve([] as Array<{ id: string; title: string | null; firstName: string | null; surename: string | null }>),
  ]);

  const clientMap = new Map<string, { id: string; title: string | null; firstName: string | null; surename: string | null; name: string }>();
  for (const c of allClients) {
    const title = c.title && c.title !== "NULL" ? c.title : "";
    const name = [title, c.firstName, c.surename].filter(Boolean).join(" ");
    clientMap.set(c.id, { ...c, name });
  }

  const packageTypeMap = allPackageTypes;

  const enquiryIds = allEnquiries.map(e => e.id);
  let allDestinations: any[] = [];
  if (enquiryIds.length > 0) {
    allDestinations = await db.select({
      enquiry_id: enquiry_destination.enquiry_id,
      destination_id: enquiry_destination.destination_id,
      name: sql<string>`COALESCE(${destination.name}, ${park.name})`,
      country_id: destination.country_id,
    }).from(enquiry_destination)
      .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
      .leftJoin(park, eq(enquiry_destination.destination_id, park.id))
      .where(inArray(enquiry_destination.enquiry_id, enquiryIds));
  }

  const quoteIds = allQuotes.map(q => q.id);
  const bookingIds = allBookings.map(b => b.id);
  const lodgeIds = allBookings.map(b => b.lodge_id).filter((id): id is string => id !== null);
  const ownerIds = [...quoteIds, ...bookingIds];
  let allDealImages: any[] = [];
  let allQuoteImages: any[] = [];
  let allBookingImages: any[] = [];
  let allAccomImages: any[] = [];
  let allLodgeImages: any[] = [];
  const fetchPromises: Promise<any>[] = [];
  if (ownerIds.length > 0) {
    fetchPromises.push(db.select().from(deal_images).where(inArray(deal_images.owner_id, ownerIds)).then(r => { allDealImages = r; }));
  }
  if (quoteIds.length > 0) {
    fetchPromises.push(db.select().from(quoteImages).where(inArray(quoteImages.quoteId, quoteIds)).then(r => { allQuoteImages = r; }));
  }
  if (bookingIds.length > 0) {
    fetchPromises.push(db.select().from(bookingImages).where(inArray(bookingImages.bookingId, bookingIds)).then(r => { allBookingImages = r; }));
  }
  if (bookingIds.length > 0) {
    fetchPromises.push(
      db.select({ booking_id: booking_accomodation.booking_id, id: accommodation_images.id, accommodation_id: accommodation_images.accommodation_id, image_url: accommodation_images.image_url, isPrimary: accommodation_images.isPrimary })
        .from(accommodation_images)
        .innerJoin(booking_accomodation, and(eq(booking_accomodation.accomodation_id, accommodation_images.accommodation_id), inArray(booking_accomodation.booking_id, bookingIds)))
        .then(r => { allAccomImages = r; })
    );
  }
  if (lodgeIds.length > 0) {
    fetchPromises.push(db.select({ id: lodge_images.id, lodge_id: lodge_images.lodge_id, image_url: lodge_images.image_url, isPrimary: lodge_images.isPrimary }).from(lodge_images).where(inArray(lodge_images.lodge_id, lodgeIds)).then(r => { allLodgeImages = r; }));
  }
  const serviceCommissionsPromise = fetchServiceCommissionMaps(quoteIds, bookingIds);
  await Promise.all(fetchPromises);
  const { quoteMap: quoteServiceCommissionMap, bookingMap: bookingServiceCommissionMap } =
    await serviceCommissionsPromise;

  const enquiryMap = new Map<string, any>();
  for (const enq of allEnquiries) {
    const destinations = allDestinations.filter(d => d.enquiry_id === enq.id);
    enquiryMap.set(enq.transaction_id, { ...enq, destinations, holiday_type_name: packageTypeMap.get(enq.holiday_type_id) || null });
  }

  const quotesMap = new Map<string, any[]>();
  for (const q of allQuotes) {
    const quoteImgs = allQuoteImages.filter(qi => qi.quoteId === q.id).map((qi: any) => ({ id: qi.id, owner_id: qi.quoteId, image_url: qi.url, isPrimary: qi.isPrimary }));
    // Prefer the quote's own images; fall back to legacy deal_images only when none exist.
    const images = quoteImgs.length > 0
      ? quoteImgs
      : allDealImages.filter(img => img.owner_id === q.id);
    const entry = {
      ...q,
      holiday_type_name: packageTypeMap.get(q.holiday_type_id) || q.holiday_type_id,
      images,
      service_commission: quoteServiceCommissionMap.get(q.id) || 0,
    };
    if (!quotesMap.has(q.transaction_id)) quotesMap.set(q.transaction_id, []);
    quotesMap.get(q.transaction_id)!.push(entry);
  }

  const bookingMap = new Map<string, any>();
  for (const b of allBookings) {
    const seen = new Set<string>();
    const images: any[] = [];
    const bookingImgs = allBookingImages
      .filter(bi => bi.bookingId === b.id)
      .map((bi: any) => ({ id: bi.id, owner_id: bi.bookingId, image_url: bi.url, isPrimary: bi.isPrimary, s3Key: null }));
    // Prefer the booking's own images; fall back to legacy deal_images only when none exist.
    const ownImgs = bookingImgs.length > 0
      ? bookingImgs
      : allDealImages.filter(img => img.owner_id === b.id);
    for (const img of ownImgs) {
      const url = img.image_url || '';
      if (url && !seen.has(url)) { seen.add(url); images.push(img); }
    }
    for (const img of allAccomImages.filter(img => img.booking_id === b.id)) {
      const url = img.image_url || '';
      if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.accommodation_id, s3Key: null }); }
    }
    if (b.lodge_id) {
      for (const img of allLodgeImages.filter((img: any) => img.lodge_id === b.lodge_id)) {
        const url = img.image_url || '';
        if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.lodge_id, s3Key: null }); }
      }
    }
    bookingMap.set(b.transaction_id, {
      ...b,
      holiday_type_name: packageTypeMap.get(b.holiday_type_id) || b.holiday_type_id,
      images,
      service_commission: bookingServiceCommissionMap.get(b.id) || 0,
    });
  }

  return txns.map(txn => {
    const enquiry = txn.status === "on_enquiry" ? (enquiryMap.get(txn.id) || null) : null;
    const quotes = quotesMap.get(txn.id) || [];
    const bookingEntry = bookingMap.get(txn.id) || null;
    const holiday_type_name = enquiry?.holiday_type_name || quotes[0]?.holiday_type_name || bookingEntry?.holiday_type_name || null;
    const client = txn.client_id ? clientMap.get(txn.client_id) ?? null : null;
    return { ...txn, holiday_type_name, enquiry, quotes, booking: bookingEntry, client };
  });
}

async function enrichTransactionsLightweight(txns: Transaction[]) {
  if (txns.length === 0) return [];
  const txnIds = txns.map(t => t.id);
  const userIds = Array.from(new Set(txns.map(t => t.user_id).filter(Boolean))) as string[];
  const clientIds = Array.from(new Set(txns.map(t => t.client_id).filter(Boolean))) as string[];

  const [allEnquiries, allQuotes, allBookings, allPackageTypes, allUsers, allClients, allQuoteVariants] = await Promise.all([
    db.select({ id: enquiry_table.id, transaction_id: enquiry_table.transaction_id, title: enquiry_table.title, travel_date: enquiry_table.travel_date, adults: enquiry_table.adults, children: enquiry_table.children, infants: enquiry_table.infants, holiday_type_id: enquiry_table.holiday_type_id, status: enquiry_table.status }).from(enquiry_table).where(inArray(enquiry_table.transaction_id, txnIds)),
    db.select({ id: quote.id, transaction_id: quote.transaction_id, title: quote.title, travel_date: quote.travel_date, adult: quote.adult, child: quote.child, infant: quote.infant, sales_price: quote.sales_price, package_commission: quote.package_commission, holiday_type_id: quote.holiday_type_id, quote_status: quote.quote_status, isQuoteCopy: quote.isQuoteCopy }).from(quote).where(and(inArray(quote.transaction_id, txnIds), sql`(${quote.isFreeQuote} IS NOT TRUE)`, sql`(${quote.isQuoteCopy} IS NOT TRUE)`, sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`, isNull(quote.deleted_at))),
    db.select({ id: booking.id, transaction_id: booking.transaction_id, title: booking.title, travel_date: booking.travel_date, adult: booking.adult, child: booking.child, infant: booking.infant, sales_price: booking.sales_price, package_commission: booking.package_commission, holiday_type_id: booking.holiday_type_id }).from(booking).where(inArray(booking.transaction_id, txnIds)),
    getPackageTypeMap(),
    userIds.length > 0 ? db.select({ id: user.id, firstName: user.firstName, lastName: user.lastName, name: user.name, email: user.email }).from(user).where(inArray(user.id, userIds)) : Promise.resolve([]),
    clientIds.length > 0 ? db.select({ id: clientTable.id, title: clientTable.title, firstName: clientTable.firstName, surename: clientTable.surename }).from(clientTable).where(inArray(clientTable.id, clientIds)) : Promise.resolve([]),
    // All active quotes (primary + copies) for the pipeline card duplicate badge/dropdown. Unlike allQuotes above, this does NOT exclude isQuoteCopy.
    db.select({ id: quote.id, transaction_id: quote.transaction_id, title: quote.title, isQuoteCopy: quote.isQuoteCopy, quote_status: quote.quote_status }).from(quote).where(and(inArray(quote.transaction_id, txnIds), sql`(${quote.isFreeQuote} IS NOT TRUE)`, sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`, isNull(quote.deleted_at))),
  ]);

  const userMap = new Map(allUsers.map((u: any) => [u.id, u]));
  const clientNameMap = new Map(allClients.map((c: any) => {
    const t = c.title && c.title !== "NULL" ? c.title : "";
    const name = [t, c.firstName, c.surename].filter(Boolean).join(" ").trim();
    return [c.id, name || null];
  }));
  const packageTypeMap = allPackageTypes;

  const enquiryMap = new Map<string, any>();
  for (const enq of allEnquiries) {
    enquiryMap.set(enq.transaction_id, { ...enq, holiday_type_name: packageTypeMap.get(enq.holiday_type_id) || null });
  }

  const allQuoteIds = allQuotes.map(q => q.id);
  const allBookingIds = allBookings.map(b => b.id);
  const { quoteMap: quoteServiceCommissionMap, bookingMap: bookingServiceCommissionMap } =
    await fetchServiceCommissionMaps(allQuoteIds, allBookingIds);

  const quotesMap = new Map<string, any[]>();
  for (const q of allQuotes) {
    const entry = {
      ...q,
      holiday_type_name: packageTypeMap.get(q.holiday_type_id) || q.holiday_type_id,
      service_commission: quoteServiceCommissionMap.get(q.id) || 0,
    };
    if (!quotesMap.has(q.transaction_id)) quotesMap.set(q.transaction_id, []);
    quotesMap.get(q.transaction_id)!.push(entry);
  }

  const bookingMap = new Map<string, any>();
  for (const b of allBookings) {
    bookingMap.set(b.transaction_id, {
      ...b,
      holiday_type_name: packageTypeMap.get(b.holiday_type_id) || b.holiday_type_id,
      service_commission: bookingServiceCommissionMap.get(b.id) || 0,
    });
  }

  const quoteVariantsMap = new Map<string, any[]>();
  for (const q of allQuoteVariants) {
    if (!quoteVariantsMap.has(q.transaction_id)) quoteVariantsMap.set(q.transaction_id, []);
    quoteVariantsMap.get(q.transaction_id)!.push({ id: q.id, title: q.title, isQuoteCopy: q.isQuoteCopy, quote_status: q.quote_status });
  }

  return txns.map(txn => {
    const enquiry = txn.status === "on_enquiry" ? (enquiryMap.get(txn.id) || null) : null;
    const quotes = quotesMap.get(txn.id) || [];
    const bookingEntry = bookingMap.get(txn.id) || null;
    const holiday_type_name = enquiry?.holiday_type_name || quotes[0]?.holiday_type_name || bookingEntry?.holiday_type_name || null;
    const assignedUser = txn.user_id ? (userMap.get(txn.user_id) || null) : null;
    const client_name = txn.client_id ? (clientNameMap.get(txn.client_id) || null) : null;
    return { ...txn, holiday_type_name, client_name, enquiry, quotes, quote_variants: quoteVariantsMap.get(txn.id) || [], booking: bookingEntry, assignedUser };
  });
}

export const transactionRepository = {
  async findById(id: string, scope?: Scope): Promise<Transaction | undefined> {
    const conds = [eq(transaction.id, id), ...buildTxnScopeConds(scope)];
    const [result] = await db.select().from(transaction).where(and(...conds)).limit(1);
    return result;
  },

  async findAll(scope: Scope | undefined, filters: {
    clientId?: string;
    agentId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    branchOverride?: string;
  } = {}) {
    const conditions: SQL[] = [...buildTxnScopeConds(scope, filters.branchOverride)];
    if (filters.clientId) conditions.push(eq(transaction.client_id, filters.clientId));
    if (filters.agentId) conditions.push(eq(transaction.user_id, filters.agentId));
    if (filters.dateFrom) conditions.push(sql`${transaction.created_at} >= ${filters.dateFrom.toISOString()}`);
    if (filters.dateTo) conditions.push(sql`${transaction.created_at} <= ${filters.dateTo.toISOString()}`);

    let query = db.select().from(transaction);
    if (conditions.length > 0) query = query.where(and(...conditions)) as any;
    const txns = await query.orderBy(desc(transaction.created_at));
    return enrichTransactions(txns);
  },

  async findAllLightweight(scope?: Scope) {
    const conds: SQL[] = [eq(transaction.is_test, false), ...buildTxnScopeConds(scope)];
    const txns = await db.select().from(transaction).where(and(...conds)).orderBy(desc(transaction.created_at));
    return enrichTransactionsLightweight(txns);
  },

  async findPipelineByStatus(scope: Scope | undefined, status: string, page: number, limit: number, agentId?: string, quoteStatusFilter?: string): Promise<{ items: any[]; total: number; page: number; hasMore: boolean; totalProfit: number; totalValue: number }> {
    const conditions: SQL[] = [
      eq(transaction.status, status as "on_enquiry" | "on_quote" | "in_play" | "on_booking"),
      sql`${transaction.client_id} IS NOT NULL`,
      eq(transaction.is_test, false),
      ...buildTxnScopeConds(scope),
    ];
    if (agentId) conditions.push(eq(transaction.user_id, agentId));

    if (status === "on_enquiry") {
      conditions.push(sql`${transaction.created_at} >= NOW() - INTERVAL '7 days'`);
      conditions.push(sql`${transaction.id} IN (SELECT ${enquiry_table.transaction_id} FROM ${enquiry_table} WHERE ${enquiry_table.is_active} IS NOT FALSE)`);
      conditions.push(sql`${transaction.id} NOT IN (SELECT ${quote.transaction_id} FROM ${quote} WHERE ${quote.quote_status}::text = 'LOST' AND ${quote.deleted_at} IS NULL)`);
    }

    if (status === "on_booking") {
      conditions.push(sql`${transaction.id} IN (SELECT ${booking.transaction_id} FROM ${booking} WHERE ${booking.date_created} >= DATE_TRUNC('month', NOW()))`);
    }

    if (status === "on_quote") {
      const ACTIVE_STATUSES = ["QUOTE_IN_PROGRESS", "QUOTE_CALL", "AWAITING_DECISION", "QUOTE_READY", "REQUOTE"];
      conditions.push(sql`${transaction.id} IN (SELECT ${quote.transaction_id} FROM ${quote} WHERE ${quote.isFreeQuote} IS NOT TRUE AND ${quote.quote_status}::text IN (${sql.join(ACTIVE_STATUSES.map(s => sql`${s}`), sql`, `)}) AND ${quote.deleted_at} IS NULL AND ${quote.is_active} = TRUE AND (${quote.date_created} >= NOW() - INTERVAL '7 days' OR (${quote.date_expiry} IS NOT NULL AND ${quote.date_expiry} >= NOW())))`);
      conditions.push(sql`NOT EXISTS (SELECT 1 FROM ${quote} q2 WHERE q2.transaction_id = ${transaction.id} AND q2."isFreeQuote" IS NOT TRUE AND q2.quote_status::text = 'LOST' AND q2.deleted_at IS NULL)`);
      if (quoteStatusFilter) conditions.push(sql`${transaction.id} IN (SELECT ${quote.transaction_id} FROM ${quote} WHERE ${quote.quote_status}::text = ${quoteStatusFilter} AND ${quote.deleted_at} IS NULL)`);
    }

    if (status === "in_play") {
      conditions.push(sql`${transaction.id} IN (SELECT ${quote.transaction_id} FROM ${quote} WHERE ${quote.isFreeQuote} IS NOT TRUE AND ${quote.deleted_at} IS NULL AND ${quote.is_active} = TRUE AND ${quote.quote_status}::text != 'LOST' AND (${quote.date_created} >= NOW() - INTERVAL '7 days' OR (${quote.date_expiry} IS NOT NULL AND ${quote.date_expiry} >= NOW())))`);
      conditions.push(sql`NOT EXISTS (SELECT 1 FROM ${quote} q2 WHERE q2.transaction_id = ${transaction.id} AND q2."isFreeQuote" IS NOT TRUE AND q2.quote_status::text = 'LOST' AND q2.deleted_at IS NULL)`);
    }

    const where = and(...conditions);
    const [countResult] = await db.select({ total: count() }).from(transaction).where(where);
    const total = countResult?.total || 0;

    let totalProfit = 0;
    let totalValue = 0;

    const txns = await db.select().from(transaction).where(where).orderBy(desc(transaction.created_at)).limit(limit).offset((page - 1) * limit);
    const enriched = await enrichTransactionsLightweight(txns);
    return { items: enriched, total, page, hasMore: page * limit < total, totalProfit, totalValue };
  },

  async create(data: InsertTransaction, scope?: Scope): Promise<Transaction> {
    const values: InsertTransaction = scope
      ? ({ ...data, org_id: (data as any).org_id ?? scope.orgId ?? null, branch_id: (data as any).branch_id ?? scope.branchId ?? null } as InsertTransaction)
      : data;
    const [result] = await db.insert(transaction).values(values).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertTransaction>, scope?: Scope): Promise<Transaction | undefined> {
    const conds: SQL[] = [eq(transaction.id, id), ...buildTxnScopeConds(scope)];
    const [result] = await db.update(transaction).set(data).where(and(...conds)).returning();
    return result;
  },

  async remove(id: string, scope?: Scope): Promise<boolean> {
    const conds: SQL[] = [eq(transaction.id, id), ...buildTxnScopeConds(scope)];
    const result = await db.delete(transaction).where(and(...conds)).returning({ id: transaction.id });
    return result.length > 0;
  },

  async findWithDetails(id: string, scope?: Scope) {
    const conds: SQL[] = [eq(transaction.id, id), ...buildTxnScopeConds(scope)];
    const [txn] = await db.select().from(transaction).where(and(...conds)).limit(1);
    if (!txn) return undefined;

    const [enquiryResult] = await db.select().from(enquiry_table).where(eq(enquiry_table.transaction_id, id)).limit(1);
    const rawQuotes = await db.select().from(quote).where(and(eq(quote.transaction_id, id), isNull(quote.deleted_at)));
    const [bookingResult] = await db.select().from(booking).where(eq(booking.transaction_id, id)).limit(1);
    const [client] = txn.client_id ? await db.select().from(clientTable).where(eq(clientTable.id, txn.client_id)).limit(1) : [undefined];
    const [agent] = txn.user_id ? await db.select().from(user).where(eq(user.id, txn.user_id)).limit(1) : [undefined];

    const quoteIds = rawQuotes.map(q => q.id);
    let allAccoms: any[] = [];
    let allFlights: any[] = [];
    if (quoteIds.length > 0) {
      const departAirport = airport;
      [allAccoms, allFlights] = await Promise.all([
        db.select({ accommodation: quote_accomodation, accomodation_name: accomodation_list.name, board_basis_name: board_basis.type, room_type_name: room_type.name, resort_name: resorts.name, destination_name: destination.name, country_name: country.country_name })
          .from(quote_accomodation)
          .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
          .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
          .leftJoin(destination, eq(resorts.destination_id, destination.id))
          .leftJoin(country, eq(destination.country_id, country.id))
          .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
          .leftJoin(room_type, sql`CASE WHEN ${quote_accomodation.room_type} ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN ${quote_accomodation.room_type}::uuid ELSE NULL END = ${room_type.id}`)
          .where(inArray(quote_accomodation.quote_id, quoteIds)),
        db.select({ flight: quote_flights, departing_airport_name: departAirport.airport_name })
          .from(quote_flights)
          .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
          .where(inArray(quote_flights.quote_id, quoteIds)),
      ]);
    }

    const quotes = rawQuotes.map(q => ({
      ...q,
      accommodations: allAccoms.filter(a => a.accommodation.quote_id === q.id).map(a => ({ ...a.accommodation, accomodation_name: a.accomodation_name, board_basis_name: a.board_basis_name, room_type_name: a.room_type_name, resort_name: a.resort_name, destination_name: a.destination_name, country_name: a.country_name })),
      flights: allFlights.filter(f => f.flight.quote_id === q.id).map(f => ({ ...f.flight, departing_airport_name: f.departing_airport_name })),
    }));

    let enrichedEnquiry: any = enquiryResult || null;
    if (enquiryResult) {
      const [destinations, resorts2, accommodations, boardBases, airports] = await Promise.all([
        db.select({ enquiry_id: enquiry_destination.enquiry_id, destination_id: enquiry_destination.destination_id, country_id: destination.country_id }).from(enquiry_destination).leftJoin(destination, eq(enquiry_destination.destination_id, destination.id)).where(eq(enquiry_destination.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_resorts).where(eq(enquiry_resorts.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_accomodation).where(eq(enquiry_accomodation.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_board_basis).where(eq(enquiry_board_basis.enquiry_id, enquiryResult.id)),
        db.select().from(enquiry_departure_airport).where(eq(enquiry_departure_airport.enquiry_id, enquiryResult.id)),
      ]);
      enrichedEnquiry = { ...enquiryResult, destinations, resorts: resorts2, accommodations, boardBases, airports };
    }

    return { ...txn, enquiry: enrichedEnquiry, quotes, booking: bookingResult || null, client: client || null, agent: agent || null };
  },

  async findExpiringQuotes(scope?: Scope, agentId?: string) {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const conditions: SQL[] = [
      eq(transaction.is_active, true),
      eq(transaction.is_test, false),
      eq(transaction.status, 'on_quote'),
      eq(quote.is_active, true),
      // NB: expiry is decided by the date window below, NOT by the stored
      // is_expired flag — that flag is set by a cron keyed on date_created+7d and
      // goes stale when date_expiry is extended, which previously hid legitimately
      // expiring quotes from this list.
      eq(quote.isFreeQuote, false),
      eq(quote.isQuoteCopy, false),
      sql`(${quote.quote_status} IS NULL OR ${quote.quote_status} != 'LOST')`,
      sql`((${quote.date_expiry} IS NOT NULL AND ${quote.date_expiry} <= ${sevenDaysFromNow}) OR (${quote.date_expiry} IS NULL AND ${quote.date_created} < ${sevenDaysAgo}))`,
      ...buildTxnScopeConds(scope),
    ];

    if (agentId) conditions.push(eq(transaction.user_id, agentId));

    const rows = await db.select({
      quoteId: quote.id,
      clientId: transaction.client_id,
      clientFirstName: clientTable.firstName,
      clientSurename: clientTable.surename,
      clientTitle: clientTable.title,
      salesPrice: quote.sales_price,
      dateCreated: quote.date_created,
      dateExpiry: quote.date_expiry,
      transactionId: transaction.id,
    }).from(quote).innerJoin(transaction, eq(quote.transaction_id, transaction.id)).leftJoin(clientTable, eq(transaction.client_id, clientTable.id)).where(and(...conditions));

    return rows;
  },

  /**
   * Atomic insert: transaction + quote + flights + primary accommodation + image rows.
   * The service is responsible for all data normalisation/conversion before calling.
   */
  async createWithQuoteAndChildren(input: CreateTransactionWithQuoteInput) {
    return db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...input.transactionData,
        status: 'on_quote',
        org_id: (input.transactionData as any).org_id ?? input.scope.orgId ?? null,
        branch_id: (input.transactionData as any).branch_id ?? input.scope.branchId ?? null,
      } as InsertTransaction).returning();

      const [q] = await tx.insert(quote).values({
        ...input.quoteFields,
        transaction_id: txn.id,
      } as InsertQuote).returning();

      if (hasFlightData(input.outboundFlight)) {
        await tx.insert(quote_flights).values({ ...input.outboundFlight, quote_id: q.id, flight_type: 'outbound', leg_order: 0 } as InsertQuoteFlight);
      }
      if (hasFlightData(input.inboundFlight)) {
        await tx.insert(quote_flights).values({ ...input.inboundFlight, quote_id: q.id, flight_type: 'inbound', leg_order: 0 } as InsertQuoteFlight);
      }

      const outConn = input.outboundConnectingLegs ?? [];
      for (let i = 0; i < outConn.length; i++) {
        if (!hasFlightData(outConn[i])) continue;
        await tx.insert(quote_flights).values({ ...outConn[i], quote_id: q.id, flight_type: 'outbound', leg_order: i + 1 } as InsertQuoteFlight);
      }
      const inConn = input.inboundConnectingLegs ?? [];
      for (let i = 0; i < inConn.length; i++) {
        if (!hasFlightData(inConn[i])) continue;
        await tx.insert(quote_flights).values({ ...inConn[i], quote_id: q.id, flight_type: 'inbound', leg_order: i + 1 } as InsertQuoteFlight);
      }

      if (input.primaryAccommodation && input.primaryAccommodation.accomodation_id) {
        await tx.insert(quote_accomodation).values({ ...input.primaryAccommodation, quote_id: q.id, is_primary: true } as InsertQuoteAccomodation);
      }

      const images = input.images ?? [];
      if (images.length > 0) {
        await tx.insert(quoteImages).values(images.map((url, index) => ({ id: randomUUID(), quoteId: q.id, url, isPrimary: index === 0 })));
        if (input.primaryAccommodation?.accomodation_id) {
          for (const url of images) {
            await tx.insert(accommodation_images).values({ accommodation_id: input.primaryAccommodation.accomodation_id, image_url: url }).onConflictDoNothing();
          }
        }
        if (input.quoteFields.lodge_id) {
          for (const url of images) {
            await tx.insert(lodge_images).values({ lodge_id: input.quoteFields.lodge_id, image_url: url }).onConflictDoNothing();
          }
        }
      }

      return { transaction: txn, quote: q };
    });
  },

  /**
   * Atomic insert: transaction + booking + flights + primary accommodation + image rows.
   * The service is responsible for all data normalisation before calling.
   */
  async createWithBookingAndChildren(input: CreateTransactionWithBookingInput) {
    return db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...input.transactionData,
        status: 'on_booking',
        org_id: (input.transactionData as any).org_id ?? input.scope.orgId ?? null,
        branch_id: (input.transactionData as any).branch_id ?? input.scope.branchId ?? null,
      } as InsertTransaction).returning();

      const [b] = await tx.insert(booking).values({
        ...input.bookingFields,
        transaction_id: txn.id,
        booking_status: 'BOOKED',
      } as InsertBooking).returning();

      if (hasFlightData(input.outboundFlight)) {
        await tx.insert(booking_flights).values({ ...input.outboundFlight, booking_id: b.id, flight_type: 'outbound' } as InsertBookingFlight);
      }
      if (hasFlightData(input.inboundFlight)) {
        await tx.insert(booking_flights).values({ ...input.inboundFlight, booking_id: b.id, flight_type: 'inbound' } as InsertBookingFlight);
      }

      const outConn = input.outboundConnectingLegs ?? [];
      for (const leg of outConn) {
        if (!hasFlightData(leg)) continue;
        await tx.insert(booking_flights).values({ ...leg, booking_id: b.id, flight_type: 'outbound' } as InsertBookingFlight);
      }
      const inConn = input.inboundConnectingLegs ?? [];
      for (const leg of inConn) {
        if (!hasFlightData(leg)) continue;
        await tx.insert(booking_flights).values({ ...leg, booking_id: b.id, flight_type: 'inbound' } as InsertBookingFlight);
      }

      if (input.primaryAccommodation && input.primaryAccommodation.accomodation_id) {
        await tx.insert(booking_accomodation).values({ ...input.primaryAccommodation, booking_id: b.id, is_primary: true } as InsertBookingAccomodation);
      }

      const images = input.images ?? [];
      if (images.length > 0) {
        await tx.insert(bookingImages).values(images.map((url, index) => ({ id: randomUUID(), bookingId: b.id, url, isPrimary: index === 0 })));
        if (input.primaryAccommodation?.accomodation_id) {
          for (const imageUrl of images) {
            await tx.insert(accommodation_images).values({ accommodation_id: input.primaryAccommodation.accomodation_id, image_url: imageUrl }).onConflictDoNothing();
          }
        }
        if (input.bookingFields.lodge_id) {
          for (const imageUrl of images) {
            await tx.insert(lodge_images).values({ lodge_id: input.bookingFields.lodge_id, image_url: imageUrl }).onConflictDoNothing();
          }
        }
      }

      return { transaction: txn, booking: b };
    });
  },

  async getStats(scope?: Scope) {
    const conds = buildTxnScopeConds(scope);
    const query = db.select({
      total: sql<number>`count(*)`,
      active: sql<number>`count(*) FILTER (WHERE ${transaction.is_active} = true)`,
      enquiry: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_enquiry')`,
      quoted: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_quote')`,
      booked: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_booking')`,
    }).from(transaction);
    const [result] = conds.length > 0 ? await query.where(and(...conds)) : await query;
    return result;
  },
};
