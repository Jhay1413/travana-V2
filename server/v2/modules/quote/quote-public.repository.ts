// Intentionally outside the shop/homeworker partition: public quote links are token-gated, not staff reads.
import { db } from "../../config/database";
import {
  quote, quote_flights, quote_accomodation, quote_transfers, quote_car_hire,
  quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  quote_cruise, quote_cruise_item_extra, quote_cruise_itinerary,
  passengers, quoteImages, tags, quoteTags,
  accommodation_images, lodge_images,
  package_type, tour_operator, airport, accomodation_list, board_basis,
  transaction, resorts, destination, country, room_type,
  lodges, park, user, clientTable,
  quoteViewsTable, quoteCustomerActionsTable, destinationGuruTable,
  notifications, organization,
} from "@shared/schema";
import type { QuoteView, InsertQuoteView, QuoteCustomerAction, InsertQuoteCustomerAction } from "@shared/schema";

/** One row of the client page's "Views" tab. */
export interface ClientQuoteViewSummary {
  quoteId: string;
  title: string | null;
  travelDate: string | null;
  quoteStatus: string | null;
  viewCount: number;
  lastViewedAt: string;
  lastDevice: string | null;
}
import { eq, desc, sql, and, inArray, or, ilike } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { buildTransactionScopeConds, type ScopeOrTrusted } from "../../utils/scope-conditions";
import { fetchExtrasTotalMaps } from "../transaction/extras-total.repository";
import { isUndefinedColumn, isValueTooLong } from "../../utils/pg-errors";
import { LEGACY_QUOTE_TOKEN_LENGTH, mintQuoteToken } from "../../utils/quote-token";
// The portal's visibility rule and live-booking rule, imported so the public link can never drift from them.
import { customerVisibleQuoteWhere, dealIsBooked } from "../portal/portal-quotes.repository";
import type { QuoteAccessRow } from "./quote-public.types";

/** The columns quote_customer_actions has always had; reads and writes that don't need the newer ones stick to these. */
const ACTION_BASE_COLUMNS = {
  id: quoteCustomerActionsTable.id,
  quoteId: quoteCustomerActionsTable.quoteId,
  actionType: quoteCustomerActionsTable.actionType,
  message: quoteCustomerActionsTable.message,
  customerName: quoteCustomerActionsTable.customerName,
  createdAt: quoteCustomerActionsTable.createdAt,
};

let warnedActionColumns = false;
/** The reason / wants_similar columns are not in the database until the schema is pushed: log that once. */
function warnActionColumnsMissing(): void {
  if (warnedActionColumns) return;
  warnedActionColumns = true;
  console.warn("[quote-public] quote_customer_actions.reason / wants_similar do not exist yet; push the schema. Declines are unavailable and reasons are not shown until then.");
}

const departAirport = alias(airport, "depart_airport");
const arriveAirport = alias(airport, "arrive_airport");
const flightTourOp = alias(tour_operator, "flight_tour_op");
const accomTourOp = alias(tour_operator, "accom_tour_op");
const transferTourOp = alias(tour_operator, "transfer_tour_op");
const carHireTourOp = alias(tour_operator, "car_hire_tour_op");
const attractionTourOp = alias(tour_operator, "attraction_tour_op");
const loungeTourOp = alias(tour_operator, "lounge_tour_op");
const loungeAirport = alias(airport, "lounge_airport");
const parkingTourOp = alias(tour_operator, "parking_tour_op");
const parkingAirport = alias(airport, "parking_airport");
const cruiseTourOp = alias(tour_operator, "cruise_tour_op");

export const quotePublicRepository = {
  /** True when some quote already carries this token. */
  async isTokenTaken(token: string): Promise<boolean> {
    const rows = await db.select({ id: quote.id }).from(quote).where(eq(quote.quote_token, token)).limit(1);
    return rows.length > 0;
  },

  /**
   * The quote's share token, minted (20 characters, unused) and stored when it has none yet. The write only lands
   * on a quote that still has no token, so two callers racing share one token. Until the schema push widens the
   * column the database refuses a 20 character value; then a 12 character token is stored instead (logged).
   */
  async setToken(quoteId: string): Promise<string> {
    const existing = await db.select({ token: quote.quote_token }).from(quote).where(eq(quote.id, quoteId)).limit(1);
    if (existing[0]?.token) return existing[0].token;

    const store = async (length?: number): Promise<string | null> => {
      const token = await mintQuoteToken((candidate) => this.isTokenTaken(candidate), length);
      const updated = await db
        .update(quote)
        .set({ quote_token: token })
        .where(and(eq(quote.id, quoteId), sql`${quote.quote_token} IS NULL`))
        .returning({ token: quote.quote_token });
      return updated[0]?.token ?? null;
    };

    let stored: string | null;
    try {
      stored = await store();
    } catch (err) {
      if (!isValueTooLong(err)) throw err;
      console.warn("[quote-public] quote_token is still varchar(12): storing a 12 character token until the schema is pushed.");
      stored = await store(LEGACY_QUOTE_TOKEN_LENGTH);
    }
    if (stored) return stored;
    const [again] = await db.select({ token: quote.quote_token }).from(quote).where(eq(quote.id, quoteId)).limit(1);
    if (!again?.token) throw new Error("Could not store a quote token");
    return again.token;
  },

  async findByToken(token: string) {
    const quoteId = await this.findQuoteIdByToken(token);
    return quoteId ? this.findRecordById(quoteId) : undefined;
  },

  /** Everything the public page and the portal read for one quote. Callers decide who may see which parts. */
  async findRecordById(quoteId: string) {
    const [q] = await db
      .select({
        quote: quote,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        client_id: transaction.client_id,
        user_id: transaction.user_id,
        client_first_name: clientTable.firstName,
        client_last_name: clientTable.surename,
        lodge_id: quote.lodge_id,
        park_id: lodges.park_id,
      })
      .from(quote)
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(lodges, eq(quote.lodge_id, lodges.id))
      .leftJoin(park, eq(lodges.park_id, park.id))
      .where(eq(quote.id, quoteId))
      .limit(1);

    if (!q) return undefined;

    const id = q.quote.id;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images, quoteTags_list, agentData] = await Promise.all([
      db.select({
        flight: quote_flights,
        departing_airport_name: sql<string>`CASE WHEN ${departAirport.airport_code} IS NOT NULL AND ${departAirport.airport_code} <> '' THEN concat(${departAirport.airport_name}, ' (', ${departAirport.airport_code}, ')') ELSE ${departAirport.airport_name} END`,
        arrival_airport_name: sql<string>`CASE WHEN ${arriveAirport.airport_code} IS NOT NULL AND ${arriveAirport.airport_code} <> '' THEN concat(${arriveAirport.airport_name}, ' (', ${arriveAirport.airport_code}, ')') ELSE ${arriveAirport.airport_name} END`,
      })
        .from(quote_flights)
        .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
        .leftJoin(arriveAirport, eq(quote_flights.arrival_airport_id, arriveAirport.id))
        .where(eq(quote_flights.quote_id, id))
        .orderBy(quote_flights.leg_order),

      db.select({
        accommodation: quote_accomodation,
        accomodation_name: accomodation_list.name,
        board_basis_name: board_basis.type,
        room_type_name: room_type.name,
        resort_name: resorts.name,
        destination_id: destination.id,
        destination_name: destination.name,
        country_name: country.country_name,
      })
        .from(quote_accomodation)
        .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
        .leftJoin(accomTourOp, eq(quote_accomodation.tour_operator_id, accomTourOp.id))
        .leftJoin(room_type, sql`CASE WHEN ${quote_accomodation.room_type} ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN ${quote_accomodation.room_type}::uuid ELSE NULL END = ${room_type.id}`)
        .where(eq(quote_accomodation.quote_id, id)),

      db.select({ transfer: quote_transfers })
        .from(quote_transfers)
        .where(eq(quote_transfers.quote_id, id)),

      db.select({ carHire: quote_car_hire })
        .from(quote_car_hire)
        .where(eq(quote_car_hire.quote_id, id)),

      db.select({ attractionTicket: quote_attraction_ticket })
        .from(quote_attraction_ticket)
        .where(eq(quote_attraction_ticket.quote_id, id)),

      db.select({
        loungePass: quote_lounge_pass,
        airport_name: sql<string>`concat(${loungeAirport.airport_name}, ' (', ${loungeAirport.airport_code}, ')')`,
      })
        .from(quote_lounge_pass)
        .leftJoin(loungeAirport, eq(quote_lounge_pass.airport_id, loungeAirport.id))
        .where(eq(quote_lounge_pass.quote_id, id)),

      db.select({
        airportParking: quote_airport_parking,
        airport_name: sql<string>`concat(${parkingAirport.airport_name}, ' (', ${parkingAirport.airport_code}, ')')`,
      })
        .from(quote_airport_parking)
        .leftJoin(parkingAirport, eq(quote_airport_parking.airport_id, parkingAirport.id))
        .where(eq(quote_airport_parking.quote_id, id)),

      db.select({ cruise: quote_cruise })
        .from(quote_cruise)
        .where(eq(quote_cruise.quote_id, id)),

      db.select().from(passengers).where(eq(passengers.quote_id, id)),

      db.select().from(quoteImages).where(eq(quoteImages.quoteId, id)),

      db.select({ tagName: tags.name })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(eq(quoteTags.quoteId, id)),

      q.user_id
        ? db.select({ id: user.id, firstName: user.firstName, lastName: user.lastName, profileImageUrl: user.image })
            .from(user)
            .where(eq(user.id, q.user_id))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const cruiseIds = cruises.map(c => c.cruise.id);
    let cruiseItineraries: any[] = [];
    if (cruiseIds.length > 0) {
      cruiseItineraries = await db.select().from(quote_cruise_itinerary).where(inArray(quote_cruise_itinerary.quote_cruise_id, cruiseIds));
    }

    const destName = accommodations[0]?.destination_name || "";
    let destinationGuru = null;
    if (destName) {
      const [guruData] = await db.select().from(destinationGuruTable)
        .where(or(
          ilike(destinationGuruTable.destination, destName),
          sql`${destName} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
        ))
        .limit(1);
      destinationGuru = guruData || null;
    }

    // Only the quote's own images — the shared accommodation/lodge libraries
    // are no longer merged into any gallery (see quote.repository).
    const allImages: Array<{ id: string; image_url: string | null; isPrimary: boolean | null }> = [];
    const seen = new Set<string>();
    for (const img of images) {
      const url = img.url || "";
      if (url && !seen.has(url)) { seen.add(url); allImages.push({ id: img.id, image_url: url, isPrimary: img.isPrimary }); }
    }

    const { quoteMap: extrasMap } = await fetchExtrasTotalMaps([q.quote.id], []);
    const extrasTotal = extrasMap.get(q.quote.id) ?? 0;

    return {
      transactionId: q.quote.transaction_id,
      clientName: [q.client_first_name, q.client_last_name].filter(Boolean).join(" ") || null,
      agentUserId: q.user_id,
      title: q.quote.title || "",
      holidayType: q.holiday_type_name || q.quote.quote_type || "",
      travelDate: q.quote.travel_date,
      numNights: q.quote.num_of_nights || 0,
      adults: q.quote.adult || 0,
      children: q.quote.child || 0,
      infants: q.quote.infant || 0,
      pets: q.quote.pets || 0,
      salesPrice: q.quote.sales_price || "0",
      discounts: q.quote.discounts || "0",
      serviceCharge: q.quote.service_charge || "0",
      extrasTotal: String(extrasTotal),
      pricePerPerson: q.quote.price_per_person || "0",
      transferType: q.quote.transfer_type || "none",
      flightMeals: q.quote.flight_meals ?? false,
      preBookedSeats: q.quote.pre_booked_seats || "",
      destinationName: destName,
      countryName: accommodations[0]?.country_name || "",
      resortName: accommodations[0]?.resort_name || "",
      tags: quoteTags_list.map(t => t.tagName),
      flights: flights.map(f => ({
        flightType: f.flight.flight_type,
        flightNumber: f.flight.flight_number,
        departingAirport: f.departing_airport_name,
        arrivalAirport: f.arrival_airport_name,
        departureDateTime: f.flight.departure_date_time,
        arrivalDateTime: f.flight.arrival_date_time,
        airline: "",
        legOrder: f.flight.leg_order,
      })),
      accommodations: accommodations.map(a => ({
        name: a.accomodation_name || "",
        boardBasis: a.board_basis_name || "",
        roomType: a.room_type_name || a.accommodation.room_type || "",
        checkInDateTime: a.accommodation.check_in_date_time,
        starRating: null,
        resortName: a.resort_name || "",
      })),
      transfers: transfers.map(t => ({
        from: t.transfer.pick_up_location || "",
        to: t.transfer.drop_off_location || "",
        pickUpTime: t.transfer.pick_up_time,
        dropOffTime: t.transfer.drop_off_time,
        note: t.transfer.note || "",
      })),
      carHires: carHires.map(c => ({
        pickupLocation: c.carHire.pick_up_location || "",
        dropoffLocation: c.carHire.drop_off_location || "",
        pickupTime: c.carHire.pick_up_time,
        dropoffTime: c.carHire.drop_off_time,
        numDays: c.carHire.no_of_days || 0,
      })),
      attractionTickets: attractionTickets.map(t => ({
        type: t.attractionTicket.ticket_type || "",
        dateOfVisit: t.attractionTicket.date_of_visit,
        numberOfTickets: t.attractionTicket.number_of_tickets || 0,
      })),
      loungePasses: loungePasses.map(p => ({
        airportName: p.airport_name || "",
        terminal: p.loungePass.terminal || "",
        dateOfUsage: p.loungePass.date_of_usage,
        note: p.loungePass.note || "",
      })),
      airportParkings: airportParkings.map(p => ({
        airportName: p.airport_name || "",
        parkingType: p.airportParking.parking_type || "",
        parkingDate: p.airportParking.parking_date,
      })),
      cruises: cruises.map(c => ({
        cruiseLine: c.cruise.cruise_line || "",
        ship: c.cruise.ship || "",
        cabinType: c.cruise.cabin_type || "",
        cruiseName: c.cruise.cruise_name || "",
        cruiseDate: c.cruise.cruise_date,
        itinerary: cruiseItineraries
          .filter(i => i.quote_cruise_id === c.cruise.id)
          .sort((a: any, b: any) => (a.day_number || 0) - (b.day_number || 0))
          .map((i: any) => ({ day: i.day_number, description: i.description, subDescription: i.sub_description || "" })),
      })),
      passengers: passengerList.map(p => ({
        // The passengers table only stores type + age; name fields aren't persisted here.
        title: null,
        firstName: null,
        lastName: null,
        type: p.type,
        age: p.age,
      })),
      images: allImages,
      destinationGuru: destinationGuru ? {
        destination: destinationGuru.destination,
        country: destinationGuru.country,
        data: destinationGuru.data,
      } : null,
      agent: agentData[0] ? {
        name: `${agentData[0].firstName || ""} ${agentData[0].lastName || ""}`.trim() || "Your Travel Agent",
        avatar: agentData[0].profileImageUrl || null,
      } : { name: "Your Travel Agent", avatar: null },
    };
  },

  async logView(quoteId: string, viewData: Omit<InsertQuoteView, "quoteId">): Promise<QuoteView> {
    // Dedup repeat views: if the same IP already viewed this quote within the
    // last 10 minutes, return that existing row instead of inserting a new one.
    if (viewData.ipAddress) {
      const [recent] = await db
        .select()
        .from(quoteViewsTable)
        .where(
          and(
            eq(quoteViewsTable.quoteId, quoteId),
            eq(quoteViewsTable.ipAddress, viewData.ipAddress),
            sql`${quoteViewsTable.viewedAt} > now() - interval '10 minutes'`,
          ),
        )
        .orderBy(desc(quoteViewsTable.viewedAt))
        .limit(1);
      if (recent) return recent;
    }

    const [result] = await db.insert(quoteViewsTable).values({ quoteId, ...viewData }).returning();
    return result;
  },

  async getViews(quoteId: string): Promise<QuoteView[]> {
    return db.select().from(quoteViewsTable).where(eq(quoteViewsTable.quoteId, quoteId)).orderBy(desc(quoteViewsTable.viewedAt));
  },

  /**
   * Every quote of a client that has been opened at least once, with how often
   * and when it was last viewed — the client page's "Views" tab, dashboard card and holidays rail. Pinned
   * like the client page's deal list (buildTransactionScopeConds): agents and branch managers see only their
   * own shop's deals (nothing with no shop), homeworkers their own, admins the whole org.
   */
  async getClientQuoteViews(clientId: string, scope: ScopeOrTrusted): Promise<ClientQuoteViewSummary[]> {
    const lastViewed = sql<string>`max(${quoteViewsTable.viewedAt})`;
    return db
      .select({
        quoteId: quote.id,
        title: quote.title,
        travelDate: quote.travel_date,
        quoteStatus: quote.quote_status,
        viewCount: sql<number>`count(${quoteViewsTable.id})::int`,
        lastViewedAt: lastViewed,
        lastDevice: sql<string | null>`(array_agg(${quoteViewsTable.deviceType} order by ${quoteViewsTable.viewedAt} desc))[1]`,
      })
      .from(quoteViewsTable)
      .innerJoin(quote, eq(quoteViewsTable.quoteId, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(eq(transaction.client_id, clientId), ...buildTransactionScopeConds(scope)))
      .groupBy(quote.id)
      .orderBy(desc(lastViewed));
  },

  async getViewStats(quoteId: string) {
    const views = await this.getViews(quoteId);
    const deviceBreakdown: Record<string, number> = {};
    const seenIps = new Set<string>();
    for (const v of views) {
      const dt = v.deviceType || "unknown";
      deviceBreakdown[dt] = (deviceBreakdown[dt] || 0) + 1;
      if (v.ipAddress) seenIps.add(v.ipAddress);
    }
    const clientViews = views.filter((v) => v.viewerName);
    const publicViews = views.filter((v) => !v.viewerName);
    return {
      totalViews: views.length,
      uniqueViews: seenIps.size,
      publicViewCount: publicViews.length,
      firstViewed: views.length > 0 ? views[views.length - 1].viewedAt : null,
      lastViewed: views.length > 0 ? views[0].viewedAt : null,
      deviceBreakdown,
      clientViews: clientViews.map((v) => ({
        id: v.id,
        viewerName: v.viewerName!,
        viewedAt: v.viewedAt,
        deviceType: v.deviceType,
        browser: v.browser,
      })),
      publicViews: publicViews.map((v) => ({
        id: v.id,
        viewedAt: v.viewedAt,
        deviceType: v.deviceType,
        browser: v.browser,
      })),
    };
  },

  async createCustomerAction(data: InsertQuoteCustomerAction): Promise<QuoteCustomerAction> {
    if (data.reason == null && data.wantsSimilar == null) {
      // Drizzle's insert names every column in the table, so this older shape of action (accept / request changes,
      // and the portal's "interested") is written with a plain statement that works before the schema push too.
      const res = await db.execute(sql`
        insert into quote_customer_actions (quote_id, action_type, message, customer_name)
        values (${data.quoteId}, ${data.actionType}, ${data.message ?? null}, ${data.customerName ?? null})
        returning id, quote_id, action_type, message, customer_name, created_at
      `);
      const row = res.rows[0] as { id: string; quote_id: string; action_type: string; message: string | null; customer_name: string | null; created_at: Date };
      return {
        id: row.id,
        quoteId: row.quote_id,
        actionType: row.action_type,
        message: row.message,
        customerName: row.customer_name,
        createdAt: row.created_at,
        reason: null,
        wantsSimilar: null,
      };
    }
    try {
      const [result] = await db.insert(quoteCustomerActionsTable).values(data).returning();
      return result;
    } catch (err) {
      if (isUndefinedColumn(err)) warnActionColumnsMissing();
      throw err;
    }
  },

  async getCustomerActions(quoteId: string): Promise<QuoteCustomerAction[]> {
    try {
      return await db.select().from(quoteCustomerActionsTable).where(eq(quoteCustomerActionsTable.quoteId, quoteId)).orderBy(desc(quoteCustomerActionsTable.createdAt));
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
      warnActionColumnsMissing();
      const rows = await db.select(ACTION_BASE_COLUMNS).from(quoteCustomerActionsTable).where(eq(quoteCustomerActionsTable.quoteId, quoteId)).orderBy(desc(quoteCustomerActionsTable.createdAt));
      return rows.map((r) => ({ ...r, reason: null, wantsSimilar: null }));
    }
  },

  async updateSentInfo(quoteId: string, sentVia: string) {
    const [existing] = await db.select({ sentAt: quote.quote_sent_at }).from(quote).where(eq(quote.id, quoteId)).limit(1);
    const updates: Record<string, any> = { quote_sent_via: sentVia };
    if (!existing?.sentAt) {
      updates.quote_sent_at = new Date();
    }
    await db.update(quote).set(updates).where(eq(quote.id, quoteId));
  },

  /**
   * The quote a token opens. A token that matches more than one quote (possible until the unique index is pushed)
   * is never resolved to an arbitrary one: it is treated as unknown and logged.
   */
  async findQuoteIdByToken(token: string): Promise<string | null> {
    const found = await this.findTokenOwnership(token);
    return found?.quoteId ?? null;
  },

  /**
   * Resolve a share token to the quote id and its owning client id (via the
   * quote's transaction). Returns null when no quote matches the token; the
   * `clientId` may be null if the transaction has no client attached. Used to
   * enforce portal ownership — a logged-in client may only view their own quote.
   */
  async findTokenOwnership(token: string): Promise<{ quoteId: string; clientId: string | null } | null> {
    const rows = await db
      .select({ quoteId: quote.id, clientId: transaction.client_id })
      .from(quote)
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(quote.quote_token, token))
      .limit(2);
    if (rows.length > 1) {
      console.error(`[quote-public] a share token matches ${rows.length} quotes; treating it as not found (duplicate quote_token, push the unique index)`);
      return null;
    }
    return rows[0] ?? null;
  },

  /**
   * Whether the public link may open this quote, and the facts that decide it. `visible` is the portal's own
   * customerVisibleQuoteWhere (a quote with no deal is never visible); `isBooked` is the deal having a live booking.
   */
  async findAccessState(quoteId: string): Promise<QuoteAccessRow | null> {
    const [row] = await db
      .select({
        visible: sql<boolean>`coalesce(${customerVisibleQuoteWhere()}, false)`,
        isBooked: sql<boolean>`coalesce(${dealIsBooked()}, false)`,
        clientDeleted: sql<boolean>`(${clientTable.deletedAt} IS NOT NULL)`,
        dateExpiry: quote.date_expiry,
        agencyName: organization.name,
        agencyLogoUrl: organization.logoUrl,
        agencySettings: organization.settings,
      })
      .from(quote)
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(organization, eq(transaction.org_id, organization.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Has the agent already been told, within the last `withinMinutes`, that this quote was opened through the shared
   * link? One notification per quote per window, whatever the number of views.
   */
  async hasRecentLinkViewNotification(quoteId: string, link: string, withinMinutes: number): Promise<boolean> {
    const agentUserId = await this.getAgentUserIdByQuoteId(quoteId);
    if (!agentUserId) return false;
    const rows = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(
        eq(notifications.userId, agentUserId),
        eq(notifications.type, "quote_viewed"),
        eq(notifications.link, link),
        sql`${notifications.message} LIKE '%opened via the shared link%'`,
        sql`${notifications.createdAt} > now() - make_interval(mins => ${withinMinutes})`,
      ))
      .limit(1);
    return rows.length > 0;
  },

  async getAgentUserIdByQuoteId(quoteId: string): Promise<string | null> {
    const [result] = await db
      .select({ userId: transaction.user_id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    return result?.userId || null;
  },

  /** The agent who owns the quote's deal and the org the deal belongs to. */
  async getOwnerByQuoteId(quoteId: string): Promise<{ userId: string; orgId: string | null } | null> {
    const [result] = await db
      .select({ userId: transaction.user_id, orgId: transaction.org_id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    return result ?? null;
  },

  /** Slim lookup for notification wording and links: the quote's label and its own client. */
  async findNotifyInfo(quoteId: string): Promise<{ title: string | null; destinationName: string | null; clientId: string | null; clientName: string | null } | null> {
    const [row] = await db
      .select({ title: quote.title, clientId: transaction.client_id, firstName: clientTable.firstName, surname: clientTable.surename })
      .from(quote)
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(eq(quote.id, quoteId))
      .limit(1);
    if (!row) return null;
    const [dest] = await db
      .select({ name: destination.name })
      .from(quote_accomodation)
      .innerJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .innerJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .innerJoin(destination, eq(resorts.destination_id, destination.id))
      .where(eq(quote_accomodation.quote_id, quoteId))
      .limit(1);
    return { title: row.title, destinationName: dest?.name ?? null, clientId: row.clientId, clientName: [row.firstName, row.surname].filter(Boolean).join(" ") || null };
  },

  async notifyAgent(quoteId: string, title: string, message: string, link?: string, type: string = "quote_viewed") {
    const agentUserId = await this.getAgentUserIdByQuoteId(quoteId);
    if (!agentUserId) return;
    await db.insert(notifications).values({
      userId: agentUserId,
      type,
      title,
      message,
      link: link || null,
    });
  },
};
