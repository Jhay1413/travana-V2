import { db } from "../../config/database";
import {
  quote, quote_flights, quote_accomodation, quote_transfers, quote_car_hire,
  quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  quote_cruise, quote_cruise_item_extra, quote_cruise_itinerary, cruise_extra_item,
  passengers, deal_images, quoteImages, quoteViewsTable, tags, quoteTags,
  accommodation_images, lodge_images,
  package_type, tour_operator, airport, accomodation_list, board_basis,
  transaction, resorts, destination, country, room_type,
  lodges,
  park,
  travel_deal,
  clientTable,
} from "@shared/schema";
import type {
  Quote, InsertQuote, QuoteFlight, InsertQuoteFlight, QuoteAccomodation, InsertQuoteAccomodation,
  InsertQuoteTransfer, InsertQuoteCarHire, InsertQuoteAttractionTicket,
  InsertQuoteLoungePass, InsertQuoteAirportParking, InsertPassenger,
} from "@shared/schema";
import { eq, asc, desc, sql, and, or, inArray, isNotNull, isNull, gte, lte, ilike, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { buildTransactionScopeConds, buildTransactionRecordScopeConds, type ScopeOrTrusted } from "../../utils/scope-conditions";
import type { QuoteEmbeddingDetails } from "./quote-embedding";
import { PORTAL_ACTIVE_WINDOW_DAYS, type PortalStatus } from "./quote.types";

function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function convertFlightDates(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if ('departure_date_time' in result) result.departure_date_time = toDateOrNull(result.departure_date_time);
  if ('arrival_date_time' in result) result.arrival_date_time = toDateOrNull(result.arrival_date_time);
  return result;
}

function convertAccommodationDates(data: Record<string, unknown>): Record<string, unknown> {
  const result = { ...data };
  if ('check_in_date_time' in result) result.check_in_date_time = toDateOrNull(result.check_in_date_time);
  return result;
}

// Resolve a cruise-extra name to its catalog id, creating the row if it's new.
// Exact match, case-insensitive (ilike with no wildcards).
async function findOrCreateCruiseExtra(name: string): Promise<string> {
  const [existing] = await db.select().from(cruise_extra_item).where(ilike(cruise_extra_item.name, name)).limit(1);
  if (existing) return existing.id;
  const [created] = await db.insert(cruise_extra_item).values({ name }).returning();
  return created.id;
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

function getScheduleDateRange(filter: string): { start: Date; end: Date } | null {
  const today = new Date();
  if (filter === "this-week") {
    const day = today.getDay();
    const daysToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setDate(today.getDate() + daysToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (filter === "next-week") {
    const day = today.getDay();
    const daysToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(today);
    start.setDate(today.getDate() + daysToMonday + 7);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (filter === "next-month") {
    const start = new Date(today.getFullYear(), today.getMonth() + 1, 1, 0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + 2, 0, 23, 59, 59, 999);
    return { start, end };
  }
  return null;
}

export const newQuoteRepository = {
  async findById(id: string): Promise<Quote | undefined> {
    const [result] = await db.select().from(quote).where(and(eq(quote.id, id), isNull(quote.deleted_at))).limit(1);
    return result;
  },

  /** Scope-aware existence check: does quote `id` fall within the caller's scope? */
  async quoteInScope(id: string, scope: ScopeOrTrusted): Promise<boolean> {
    const [row] = await db
      .select({ id: quote.id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(eq(quote.id, id), ...buildTransactionRecordScopeConds(scope)))
      .limit(1);
    return !!row;
  },

  /** Scope-aware existence check: does transaction `transactionId` fall within the caller's scope? */
  async transactionInScope(transactionId: string, scope: ScopeOrTrusted): Promise<boolean> {
    const [row] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(and(eq(transaction.id, transactionId), ...buildTransactionRecordScopeConds(scope)))
      .limit(1);
    return !!row;
  },

  async flightBelongsToOrg(flightId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: quote_flights.id })
      .from(quote_flights)
      .innerJoin(quote, eq(quote_flights.quote_id, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(quote_flights.id, flightId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async accommodationBelongsToOrg(accommodationId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: quote_accomodation.id })
      .from(quote_accomodation)
      .innerJoin(quote, eq(quote_accomodation.quote_id, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(quote_accomodation.id, accommodationId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async transferBelongsToOrg(transferId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: quote_transfers.id })
      .from(quote_transfers)
      .innerJoin(quote, eq(quote_transfers.quote_id, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(quote_transfers.id, transferId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async passengerBelongsToOrg(passengerId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: passengers.id })
      .from(passengers)
      .innerJoin(quote, eq(passengers.quote_id, quote.id))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(eq(passengers.id, passengerId), eq(clientTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async findByTransactionId(transactionId: string, scope: ScopeOrTrusted): Promise<Quote[]> {
    const rows = await db
      .select({ quote })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(eq(quote.transaction_id, transactionId), isNull(quote.deleted_at), ...buildTransactionRecordScopeConds(scope)))
      .orderBy(desc(quote.date_created));
    return rows.map((r) => r.quote);
  },

  /** Return non-deleted sibling quotes on the same transaction that are still lost,
   *  excluding the quote identified by excludeQuoteId. Used to decide whether the
   *  transaction itself can be reactivated when a quote moves off lost status. */
  async findLostSiblings(transactionId: string, excludeQuoteId: string): Promise<Quote[]> {
    const rows = await db
      .select()
      .from(quote)
      .where(
        and(
          eq(quote.transaction_id, transactionId),
          ne(quote.id, excludeQuoteId),
          isNull(quote.deleted_at),
          eq(quote.quote_status, 'lost'),
        ),
      );
    return rows;
  },

  /** Return non-deleted sibling quotes on the same transaction that are NOT lost/archived
   *  and NOT deleted, excluding the quote identified by excludeQuoteId. Used to enforce
   *  the primary-lost guard (must reassign primary before marking it lost when siblings exist). */
  async countActiveSiblings(transactionId: string, excludeQuoteId: string): Promise<number> {
    const rows = await db
      .select({ id: quote.id })
      .from(quote)
      .where(
        and(
          eq(quote.transaction_id, transactionId),
          ne(quote.id, excludeQuoteId),
          isNull(quote.deleted_at),
          sql`${quote.quote_status} NOT IN ('lost', 'archived')`,
        ),
      );
    return rows.length;
  },

  /** Find the current primary quote (isQuoteCopy=false) for a transaction, excluding a specific quoteId. */
  async findCurrentPrimary(transactionId: string, excludeQuoteId?: string): Promise<Quote | undefined> {
    const conditions = [
      eq(quote.transaction_id, transactionId),
      eq(quote.isQuoteCopy, false),
      isNull(quote.deleted_at),
    ];
    if (excludeQuoteId) conditions.push(ne(quote.id, excludeQuoteId));
    const [row] = await db.select().from(quote).where(and(...conditions)).limit(1);
    return row;
  },

  /** Atomically flip primary: set chosenQuoteId to isQuoteCopy=false and oldPrimaryId to isQuoteCopy=true.
   *  When chosenExpiry is provided, the newly promoted primary's date_expiry is refreshed in the same txn. */
  async flipPrimary(chosenQuoteId: string, oldPrimaryId: string, chosenExpiry?: Date): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(quote).set({ isQuoteCopy: true }).where(eq(quote.id, oldPrimaryId));
      await tx
        .update(quote)
        .set({ isQuoteCopy: false, ...(chosenExpiry ? { date_expiry: chosenExpiry } : {}) })
        .where(eq(quote.id, chosenQuoteId));
    });
  },

  async findAll(scope: ScopeOrTrusted): Promise<Quote[]> {
    const rows = await db
      .select({ quote })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(eq(quote.isFreeQuote, false), isNull(quote.deleted_at), ...buildTransactionScopeConds(scope)))
      .orderBy(desc(quote.date_created));
    return rows.map((r) => r.quote);
  },

  async findByStatus(status: Quote['quote_status'], scope: ScopeOrTrusted): Promise<Quote[]> {
    const rows = await db
      .select({ quote })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .where(and(sql`${quote.quote_status} = ${status}`, isNull(quote.deleted_at), ...buildTransactionScopeConds(scope)))
      .orderBy(desc(quote.date_created));
    return rows.map((r) => r.quote);
  },

  async findFreeQuotesPaginated(page: number = 0, pageSize: number = 12, scheduledOnly = false, scheduleFilter = "none", search = "", rangeStart = "", rangeEnd = "", scope: ScopeOrTrusted, unscheduledOnly = false, showOnPortal = false, portalStatus: PortalStatus = "all") {
    const scopeConds = buildTransactionScopeConds(scope);
    const offset = page * pageSize;
    const searchPattern = search.trim() ? `%${search.trim().toLowerCase()}%` : null;

    // Resolve the date range: prefer client-supplied UTC bounds, fall back to server-computed range
    const clientRange = rangeStart && rangeEnd
      ? { start: new Date(rangeStart), end: new Date(rangeEnd) }
      : null;
    const resolvedRange = clientRange ?? getScheduleDateRange(scheduleFilter);

    // Step 1: Get paginated quote IDs using a single query.
    // For scheduledOnly, INNER JOIN travel_deal so the pagination OFFSET is always
    // applied over exactly the filtered set — avoids the pre-filter + inArray drift bug.
    const searchCondition = searchPattern
      ? or(
          sql`LOWER(${quote.title}) LIKE ${searchPattern}`,
          sql`EXISTS (SELECT 1 FROM ${tour_operator} WHERE ${tour_operator.id} = ${quote.main_tour_operator_id} AND LOWER(${tour_operator.name}) LIKE ${searchPattern})`,
          sql`EXISTS (SELECT 1 FROM ${quote_accomodation} JOIN ${accomodation_list} ON ${quote_accomodation.accomodation_id} = ${accomodation_list.id} WHERE ${quote_accomodation.quote_id} = ${quote.id} AND LOWER(${accomodation_list.name}) LIKE ${searchPattern})`,
          sql`EXISTS (SELECT 1 FROM ${quote_accomodation} JOIN ${accomodation_list} ON ${quote_accomodation.accomodation_id} = ${accomodation_list.id} JOIN ${resorts} ON ${accomodation_list.resorts_id} = ${resorts.id} JOIN ${destination} ON ${resorts.destination_id} = ${destination.id} WHERE ${quote_accomodation.quote_id} = ${quote.id} AND LOWER(${destination.name}) LIKE ${searchPattern})`,
          sql`EXISTS (SELECT 1 FROM ${quote_accomodation} JOIN ${accomodation_list} ON ${quote_accomodation.accomodation_id} = ${accomodation_list.id} JOIN ${resorts} ON ${accomodation_list.resorts_id} = ${resorts.id} JOIN ${destination} ON ${resorts.destination_id} = ${destination.id} JOIN ${country} ON ${destination.country_id} = ${country.id} WHERE ${quote_accomodation.quote_id} = ${quote.id} AND LOWER(${country.country_name}) LIKE ${searchPattern})`,
          sql`EXISTS (SELECT 1 FROM ${quote_flights} JOIN ${airport} ON ${quote_flights.departing_airport_id} = ${airport.id} WHERE ${quote_flights.quote_id} = ${quote.id} AND LOWER(${airport.airport_name}) LIKE ${searchPattern})`
        )
      : undefined;

    const baseWhereConditions: any[] = [
      eq(quote.isFreeQuote, true),
      eq(quote.is_active, true),
      eq(transaction.is_test, false),
      eq(quote.not_for_social, false),
      ...scopeConds,
      ...(searchCondition ? [searchCondition] : []),
      ...(unscheduledOnly
        ? [sql`NOT EXISTS (SELECT 1 FROM ${travel_deal} WHERE ${travel_deal.quote_id} = ${quote.id} AND ${travel_deal.onlySocialsId} IS NOT NULL)`]
        : []),
      ...(showOnPortal ? [eq(quote.show_on_portal, true)] : []),
      // Portal age bucket. A post is "active" for PORTAL_ACTIVE_WINDOW_DAYS from
      // portal_added_at (stamped by setPortalVisibility) and "expired" after that.
      // An unstamped row counts as expired — it can't be inside the window, which
      // matches how the portal's own recency query treats a NULL portal_added_at.
      // Only meaningful alongside showOnPortal, so it's ignored otherwise.
      // Parenthesised explicitly: drizzle's and() concatenates raw sql`` fragments
      // without wrapping them, so a bare OR here would bind looser than the AND.
      ...(showOnPortal && portalStatus === "active"
        ? [sql`(${quote.portal_added_at} IS NOT NULL AND ${quote.portal_added_at} >= now() - make_interval(days => ${PORTAL_ACTIVE_WINDOW_DAYS}))`]
        : []),
      ...(showOnPortal && portalStatus === "expired"
        ? [sql`(${quote.portal_added_at} IS NULL OR ${quote.portal_added_at} < now() - make_interval(days => ${PORTAL_ACTIVE_WINDOW_DAYS}))`]
        : []),
    ];

    let ids: string[];

    if (scheduledOnly) {
      const dealJoinConditions: any[] = [
        eq(travel_deal.quote_id, quote.id),
        isNotNull(travel_deal.onlySocialsId),
        ...(resolvedRange ? [
          gte(travel_deal.postSchedule, resolvedRange.start),
          lte(travel_deal.postSchedule, resolvedRange.end),
        ] : []),
      ];

      const pagedRows = await db
        .selectDistinct({ id: quote.id, date_created: quote.date_created })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .innerJoin(travel_deal, and(...dealJoinConditions))
        .where(and(...baseWhereConditions))
        .orderBy(desc(quote.date_created))
        .limit(pageSize)
        .offset(offset);

      ids = pagedRows.map(r => r.id);
    } else {
      const rows = await db
        .select({ id: quote.id })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(and(...baseWhereConditions))
        .orderBy(desc(quote.date_created))
        .limit(pageSize)
        .offset(offset);

      ids = rows.map(r => r.id);
    }

    if (ids.length === 0) return [];

    // Step 2: Fetch all data for these specific quotes using JOINs
    const results = await db
      .select({
        // Quote data
        quote: quote,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        client_id: transaction.client_id,

        // Flight data (only outbound, leg 0)
        flight_id: quote_flights.id,
        flight_number: quote_flights.flight_number,
        flight_departure_date: quote_flights.departure_date_time,
        flight_arrival_date: quote_flights.arrival_date_time,
        flight_type: quote_flights.flight_type,
        flight_leg_order: quote_flights.leg_order,
        departing_airport_name: sql<string>`(
          SELECT airport_table.airport_name
          FROM quote_flights
          LEFT JOIN airport_table ON quote_flights.departing_airport_id = airport_table.id
          WHERE quote_flights.quote_id = quote_table.id
          ORDER BY quote_flights.departure_date_time ASC
          LIMIT 1
        )`,
        arrival_airport_name: sql<string>`CASE WHEN ${arriveAirport.airport_code} IS NOT NULL AND ${arriveAirport.airport_code} <> '' THEN concat(${arriveAirport.airport_name}, ' (', ${arriveAirport.airport_code}, ')') ELSE ${arriveAirport.airport_name} END`,

        // Accommodation data (only primary)
        accommodation_id: quote_accomodation.id,
        accommodation_name: accomodation_list.name,
        board_basis_name: board_basis.type,
        room_type: quote_accomodation.room_type,
        check_in_date: quote_accomodation.check_in_date_time,
        country_id: country.id,
        country_name: country.country_name,
        destination_id: destination.id,
        destination_name: destination.name,

        // Travel deal data
        deal_id: travel_deal.id,
        only_socials_id: travel_deal.onlySocialsId,
        post_schedule: travel_deal.postSchedule,

        // Image data
        image_id: quoteImages.id,
        image_url: quoteImages.url,
        image_is_primary: quoteImages.isPrimary,
        // Fallback: primary image from the primary accommodation
        accommodation_image_url: sql<string | null>`(
          SELECT ai.image_url
          FROM accommodation_images ai
          WHERE ai.accommodation_id = ${quote_accomodation.accomodation_id}
          ORDER BY ai."isPrimary" DESC NULLS LAST
          LIMIT 1
        )`,
        // Fallback: primary image from the quote's lodge
        lodge_image_url: sql<string | null>`(
          SELECT li.image_url
          FROM lodge_images li
          WHERE li.lodge_id = ${quote.lodge_id}
          ORDER BY li."isPrimary" DESC NULLS LAST
          LIMIT 1
        )`,
        // Lodge name and park name for hot tub break quotes
        lodge_name: sql<string | null>`(
          SELECT l.lodge_name
          FROM lodges_table l
          WHERE l.id = ${quote.lodge_id}
          LIMIT 1
        )`,
        park_name: sql<string | null>`(
          SELECT p.name
          FROM lodges_table l
          JOIN park_table p ON p.id = l.park_id
          WHERE l.id = ${quote.lodge_id}
          LIMIT 1
        )`,
        park_location: sql<string | null>`(
          SELECT p.county
          FROM lodges_table l
          JOIN park_table p ON p.id = l.park_id
          WHERE l.id = ${quote.lodge_id}
          LIMIT 1
        )`,
        lodge_code: sql<string | null>`(
          SELECT l.lodge_code
          FROM lodges_table l
          WHERE l.id = ${quote.lodge_id}
          LIMIT 1
        )`,
      })
      .from(quote)
      .where(inArray(quote.id, ids))
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))

      // LEFT JOIN for flights
      .leftJoin(quote_flights, eq(quote_flights.quote_id, quote.id))
      .leftJoin(arriveAirport, eq(quote_flights.arrival_airport_id, arriveAirport.id))

      // LEFT JOIN for primary accommodation
      .leftJoin(
        quote_accomodation,
        and(
          eq(quote_accomodation.quote_id, quote.id),
          eq(quote_accomodation.is_primary, true)
        )
      )
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))

      // LEFT JOIN for images
      .leftJoin(quoteImages, eq(quoteImages.quoteId, quote.id))

      // LEFT JOIN for travel deal — restrict to the scheduled deal when filtering
      .leftJoin(travel_deal, and(
        eq(travel_deal.quote_id, quote.id),
        ...(scheduledOnly ? [isNotNull(travel_deal.onlySocialsId) as any] : []),
        ...(scheduledOnly && resolvedRange
          ? [gte(travel_deal.postSchedule, resolvedRange.start) as any, lte(travel_deal.postSchedule, resolvedRange.end) as any]
          : [])
      ))

      .orderBy(desc(quote.date_created), desc(quoteImages.isPrimary));

    // Group results by quote ID
    const quoteMap = new Map<string, any>();

    for (const row of results) {
      const quoteId = row.quote.id;

      if (!quoteMap.has(quoteId)) {
        quoteMap.set(quoteId, {
          ...row.quote,
          holiday_type_name: row.holiday_type_name,
          main_tour_operator_name: row.main_tour_operator_name,
          client_id: row.client_id,
          country_id: row.country_id,
          country_name: row.country_name,
          destination_id: row.destination_id,
          destination_name: row.destination_name,
          departing_airport_name: row.departing_airport_name,
          dealId: row.deal_id ?? null,
          onlySocialsId: row.only_socials_id ?? null,
          postSchedule: row.post_schedule ? row.post_schedule.toISOString() : null,
          lodge_name: row.lodge_name ?? null,
          park_name: row.park_name ?? null,
          park_location: row.park_location ?? null,
          lodge_code: row.lodge_code ?? null,
          cruises: [],
          flights: [],
          accommodations: row.accommodation_id ? [{
            id: row.accommodation_id,
            accomodation_name: row.accommodation_name,
            board_basis_name: row.board_basis_name,
            room_type: row.room_type,
            check_in_date_time: row.check_in_date,
          }] : [],
          images: [],
        });
      }

      // Add flight if it's outbound and leg 0 (or null)
      const existingQuote = quoteMap.get(quoteId)!;
      if (row.flight_id &&
          row.flight_type === 'outbound' &&
          (row.flight_leg_order === 0 || row.flight_leg_order === null) &&
          existingQuote.flights.length === 0) {
        existingQuote.flights.push({
          id: row.flight_id,
          flight_number: row.flight_number,
          flight_type: row.flight_type,
          leg_order: row.flight_leg_order,
          departure_date_time: row.flight_departure_date,
          arrival_date_time: row.flight_arrival_date,
          departing_airport_name: row.departing_airport_name,
          arrival_airport_name: row.arrival_airport_name,
        });
      }

      // Add image: accommodation > lodge > direct quote image
      if (existingQuote.images.length === 0) {
        if (row.accommodation_image_url) {
          existingQuote.images.push({
            id: 'accom',
            image_url: row.accommodation_image_url,
            isPrimary: true,
          });
        } else if (row.lodge_image_url) {
          existingQuote.images.push({
            id: 'lodge',
            image_url: row.lodge_image_url,
            isPrimary: true,
          });
        } else if (row.image_id) {
          existingQuote.images.push({
            id: row.image_id,
            image_url: row.image_url,
            isPrimary: row.image_is_primary,
          });
        }
      }
    }

    // Attach cruise data so cruise quotes render their cruise-specific fields
    // (cruise line, ship, cabin type, departure date, embarkation) on the cards.
    const cruiseRows = await db.select().from(quote_cruise).where(inArray(quote_cruise.quote_id, ids));
    for (const c of cruiseRows) {
      const q = c.quote_id ? quoteMap.get(c.quote_id) : undefined;
      if (q) q.cruises.push(c);
    }

    // Return quotes in the original order
    return ids.map(id => quoteMap.get(id)).filter(Boolean);
  },

  /** Batch, org-agnostic projection of FREE quotes for the embeddings backfill
   *  script — org id + resolved names only (no raw ids in the name fields).
   *  Uses the same "free quote" definition as findFreeQuotesPaginated, but
   *  additionally requires a non-null transaction.org_id since ai_embeddings
   *  rows must be org-scoped. Ordered by date_created for stable paging. */
  async findFreeQuoteEmbeddingRows(offset: number, limit: number): Promise<Array<QuoteEmbeddingDetails & { orgId: string }>> {
    const rows = await db
      .select({
        id: quote.id,
        orgId: transaction.org_id,
        quote_ref: quote.quote_ref,
        title: quote.title,
        quote_status: quote.quote_status,
        isFreeQuote: quote.isFreeQuote,
        sales_price: quote.sales_price,
        price_per_person: quote.price_per_person,
        num_of_nights: quote.num_of_nights,
        adult: quote.adult,
        child: quote.child,
        infant: quote.infant,
        travel_date: quote.travel_date,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        board_basis_name: board_basis.type,
        country_name: country.country_name,
        destination_name: destination.name,
        resort_name: resorts.name,
        departing_airport_name: sql<string | null>`(
          SELECT airport_table.airport_name
          FROM quote_flights
          LEFT JOIN airport_table ON quote_flights.departing_airport_id = airport_table.id
          WHERE quote_flights.quote_id = quote_table.id
          ORDER BY quote_flights.departure_date_time ASC
          LIMIT 1
        )`,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
      .where(
        and(
          eq(quote.isFreeQuote, true),
          eq(quote.is_active, true),
          isNull(quote.deleted_at),
          eq(transaction.is_test, false),
          eq(quote.not_for_social, false),
          isNotNull(transaction.org_id),
        ),
      )
      .orderBy(quote.date_created, quote.id)
      .limit(limit)
      .offset(offset);

    return rows.map((r) => ({ ...r, orgId: r.orgId as string }));
  },

  async create(data: InsertQuote): Promise<Quote> {
    const [result] = await db.insert(quote).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [result] = await db.update(quote).set(data).where(and(eq(quote.id, id), isNull(quote.deleted_at))).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.update(quote).set({ deleted_at: new Date(), is_active: false }).where(eq(quote.id, id));
  },

  async findTokenById(id: string): Promise<{ token: string | null } | undefined> {
    const [row] = await db.select({ token: quote.quote_token }).from(quote).where(eq(quote.id, id)).limit(1);
    return row;
  },

  async findTitleAndPortalVisibilityById(id: string) {
    const [row] = await db
      .select({ title: quote.title, show_on_portal: quote.show_on_portal })
      .from(quote)
      .where(eq(quote.id, id))
      .limit(1);
    return row;
  },

  /** Set show_on_portal flag, optionally also assigning a fresh quote_token. */
  async setPortalVisibility(id: string, showOnPortal: boolean, token?: string): Promise<void> {
    const updates: Record<string, any> = { show_on_portal: showOnPortal };
    if (token) updates.quote_token = token;
    // Stamp when the deal was added to the portal — drives the "Latest Deals"
    // 6-day recency window. Re-adding a deal refreshes the window.
    if (showOnPortal) updates.portal_added_at = sql`now()`;
    await db.update(quote).set(updates).where(eq(quote.id, id));
  },

  async setFeatured(id: string, isFeatured: boolean): Promise<void> {
    await db.update(quote).set({ is_featured: isFeatured }).where(eq(quote.id, id));
  },

  /** Resolve the destination name for an accommodation (accommodation → resort → destination). */
  async findDestinationNameByAccommodationId(accommodationId: string): Promise<string | null> {
    const [row] = await db
      .select({ destinationName: destination.name })
      .from(accomodation_list)
      .innerJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .innerJoin(destination, eq(resorts.destination_id, destination.id))
      .where(eq(accomodation_list.id, accommodationId))
      .limit(1);
    return row?.destinationName ?? null;
  },

  /** Bulk-clear is_future_deal on quotes whose future_deal_date has arrived. */
  async activateDueFutureDeals(): Promise<{ id: string }[]> {
    return db
      .update(quote)
      .set({ is_future_deal: false, future_deal_date: null })
      .where(
        and(
          eq(quote.is_future_deal, true),
          sql`${quote.future_deal_date} <= CURRENT_DATE`,
          sql`${quote.transaction_id} IN (SELECT id FROM ${transaction} WHERE ${transaction.status} IN ('on_enquiry', 'on_quote'))`,
        ),
      )
      .returning({ id: quote.id });
  },

  /** Lean projection for the AI's Facebook-deal reply context: the flight legs
   *  (with resolved airport names + times) and accommodation rows (hotel,
   *  board basis, resort chain) of a deal's quote. Deliberately NOT
   *  findWithDetails — that fans out 12 queries (transfers, cruises,
   *  passengers, images…) this per-turn path doesn't need. */
  async findDealReplyContext(quoteId: string) {
    const [flights, accommodations] = await Promise.all([
      db
        .select({
          flight_number: quote_flights.flight_number,
          flight_type: quote_flights.flight_type,
          departure_date_time: quote_flights.departure_date_time,
          arrival_date_time: quote_flights.arrival_date_time,
          departing_airport_name: departAirport.airport_name,
          arrival_airport_name: arriveAirport.airport_name,
        })
        .from(quote_flights)
        .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
        .leftJoin(arriveAirport, eq(quote_flights.arrival_airport_id, arriveAirport.id))
        .where(eq(quote_flights.quote_id, quoteId))
        .orderBy(quote_flights.leg_order),
      db
        .select({
          accomodation_name: accomodation_list.name,
          board_basis_name: board_basis.type,
          is_primary: quote_accomodation.is_primary,
          resort_name: resorts.name,
          destination_name: destination.name,
          country_name: country.country_name,
        })
        .from(quote_accomodation)
        .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
        .where(eq(quote_accomodation.quote_id, quoteId)),
    ]);
    return { flights, accommodations };
  },

  async findWithDetails(id: string) {
    const [q] = await db
      .select({
        quote: quote,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        lead_source: transaction.lead_source,
        user_id: transaction.user_id,
        is_test: transaction.is_test,
        lodge_id: quote.lodge_id,
        park_id: lodges.park_id,
        lodge_name: lodges.lodge_name,
        lodge_code: lodges.lodge_code,
        park_name: park.name,
        park_location: park.county,
      })
      .from(quote)
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(lodges, eq(quote.lodge_id, lodges.id))
      .leftJoin(park, eq(lodges.park_id, park.id))
      .where(and(eq(quote.id, id), isNull(quote.deleted_at)))
      .limit(1);

    if (!q) return undefined;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images, quoteTags_list, dealImgs] = await Promise.all([
      db.select({
        flight: quote_flights,
        departing_airport_name: sql<string>`CASE WHEN ${departAirport.airport_code} IS NOT NULL AND ${departAirport.airport_code} <> '' THEN concat(${departAirport.airport_name}, ' (', ${departAirport.airport_code}, ')') ELSE ${departAirport.airport_name} END`,
        arrival_airport_name: sql<string>`CASE WHEN ${arriveAirport.airport_code} IS NOT NULL AND ${arriveAirport.airport_code} <> '' THEN concat(${arriveAirport.airport_name}, ' (', ${arriveAirport.airport_code}, ')') ELSE ${arriveAirport.airport_name} END`,
        tour_operator_name: flightTourOp.name,
      })
        .from(quote_flights)
        .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
        .leftJoin(arriveAirport, eq(quote_flights.arrival_airport_id, arriveAirport.id))
        .leftJoin(flightTourOp, eq(quote_flights.tour_operator_id, flightTourOp.id))
        .where(eq(quote_flights.quote_id, id))
        .orderBy(quote_flights.leg_order),

      db.select({
        accommodation: quote_accomodation,
        accomodation_name: accomodation_list.name,
        board_basis_name: board_basis.type,
        tour_operator_name: accomTourOp.name,
        room_type_name: room_type.name,
        resort_id: resorts.id,
        resort_name: resorts.name,
        destination_id: destination.id,
        destination_name: destination.name,
        country_id: country.id,
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

      db.select({
        transfer: quote_transfers,
        tour_operator_name: transferTourOp.name,
      })
        .from(quote_transfers)
        .leftJoin(transferTourOp, eq(quote_transfers.tour_operator_id, transferTourOp.id))
        .where(eq(quote_transfers.quote_id, id)),

      db.select({
        carHire: quote_car_hire,
        tour_operator_name: carHireTourOp.name,
      })
        .from(quote_car_hire)
        .leftJoin(carHireTourOp, eq(quote_car_hire.tour_operator_id, carHireTourOp.id))
        .where(eq(quote_car_hire.quote_id, id)),

      db.select({
        attractionTicket: quote_attraction_ticket,
        tour_operator_name: attractionTourOp.name,
      })
        .from(quote_attraction_ticket)
        .leftJoin(attractionTourOp, eq(quote_attraction_ticket.tour_operator_id, attractionTourOp.id))
        .where(eq(quote_attraction_ticket.quote_id, id)),

      db.select({
        loungePass: quote_lounge_pass,
        airport_name: sql<string>`concat(${loungeAirport.airport_name}, ' (', ${loungeAirport.airport_code}, ')')`,
        tour_operator_name: loungeTourOp.name,
      })
        .from(quote_lounge_pass)
        .leftJoin(loungeAirport, eq(quote_lounge_pass.airport_id, loungeAirport.id))
        .leftJoin(loungeTourOp, eq(quote_lounge_pass.tour_operator_id, loungeTourOp.id))
        .where(eq(quote_lounge_pass.quote_id, id)),

      db.select({
        airportParking: quote_airport_parking,
        airport_name: sql<string>`concat(${parkingAirport.airport_name}, ' (', ${parkingAirport.airport_code}, ')')`,
        tour_operator_name: parkingTourOp.name,
      })
        .from(quote_airport_parking)
        .leftJoin(parkingAirport, eq(quote_airport_parking.airport_id, parkingAirport.id))
        .leftJoin(parkingTourOp, eq(quote_airport_parking.tour_operator_id, parkingTourOp.id))
        .where(eq(quote_airport_parking.quote_id, id)),

      db.select({
        cruise: quote_cruise,
        tour_operator_name: cruiseTourOp.name,
      })
        .from(quote_cruise)
        .leftJoin(cruiseTourOp, eq(quote_cruise.tour_operator_id, cruiseTourOp.id))
        .where(eq(quote_cruise.quote_id, id)),

      db.select().from(passengers).where(eq(passengers.quote_id, id)),
      db.select().from(quoteImages).where(eq(quoteImages.quoteId, id)).orderBy(asc(quoteImages.position), asc(quoteImages.id)),

      // Fetch tags through junction table
      db.select({
        tagName: tags.name,
      })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(eq(quoteTags.quoteId, id)),

      // Legacy fallback: deal_images owned by this quote (used only when no quote_images exist)
      db.select().from(deal_images).where(eq(deal_images.owner_id, id)),
    ]);

    // Fetch cruise extras and itineraries (depend on cruise IDs from above)
    const cruiseIds = cruises.map(c => c.cruise.id);
    let cruiseItemExtras: { id: string; cruise_extra_id: string | null; quote_cruise_id: string | null; name: string | null }[] = [];
    let cruiseItineraries: { id: string; quote_cruise_id: string | null; day_number: number | null; description: string | null; sub_description: string | null }[] = [];
    if (cruiseIds.length > 0) {
      [cruiseItemExtras, cruiseItineraries] = await Promise.all([
        db.select({
          id: quote_cruise_item_extra.id,
          cruise_extra_id: quote_cruise_item_extra.cruise_extra_id,
          quote_cruise_id: quote_cruise_item_extra.quote_cruise_id,
          name: cruise_extra_item.name,
        })
          .from(quote_cruise_item_extra)
          .leftJoin(cruise_extra_item, eq(quote_cruise_item_extra.cruise_extra_id, cruise_extra_item.id))
          .where(inArray(quote_cruise_item_extra.quote_cruise_id, cruiseIds)),
        db.select().from(quote_cruise_itinerary).where(inArray(quote_cruise_itinerary.quote_cruise_id, cruiseIds)),
      ]);
    }

    return {
      ...q.quote,
      park_id: q.park_id,
      lodge_name: q.lodge_name,
      lodge_code: q.lodge_code,
      park_name: q.park_name,
      park_location: q.park_location,
      holiday_type_name: q.holiday_type_name,
      main_tour_operator_name: q.main_tour_operator_name,
      lead_source: q.lead_source,
      user_id: q.user_id,
      country_id: accommodations[0]?.country_id || null,
      country_name: accommodations[0]?.country_name || null,
       destination_id: accommodations[0]?.destination_id || null,
      destination_name: accommodations[0]?.destination_name || null,
      resort_id: accommodations[0]?.resort_id || null,
      resort_name: accommodations[0]?.resort_name || null,
      tags: quoteTags_list.map(t => t.tagName), // Extract tag names as array
      flights: flights.map(f => ({ ...f.flight, departing_airport_name: f.departing_airport_name, arrival_airport_name: f.arrival_airport_name, tour_operator_name: f.tour_operator_name })),
      accommodations: accommodations.map(a => ({
        ...a.accommodation,
        destination_name: a.destination_name,
        accomodation_name: a.accomodation_name,
        board_basis_name: a.board_basis_name,
        tour_operator_name: a.tour_operator_name,
        room_type_name: a.room_type_name,
        // Include location IDs for frontend use
        resort_id: a.resort_id,
        destination_id: a.destination_id,
        country_id: a.country_id,
      })),
      transfers: transfers.map(t => ({ ...t.transfer, tour_operator_name: t.tour_operator_name })),
      carHires: carHires.map(c => ({ ...c.carHire, tour_operator_name: c.tour_operator_name })),
      attractionTickets: attractionTickets.map(t => ({ ...t.attractionTicket, tour_operator_name: t.tour_operator_name })),
      loungePasses: loungePasses.map(p => ({ ...p.loungePass, airport_name: p.airport_name, tour_operator_name: p.tour_operator_name })),
      airportParkings: airportParkings.map(p => ({ ...p.airportParking, airport_name: p.airport_name, tour_operator_name: p.tour_operator_name })),
      cruises: cruises.map(c => ({
        ...c.cruise,
        tour_operator_name: c.tour_operator_name,
        extras: cruiseItemExtras.filter(e => e.quote_cruise_id === c.cruise.id),
        itinerary: cruiseItineraries
          .filter(i => i.quote_cruise_id === c.cruise.id)
          .sort((a, b) => (a.day_number || 0) - (b.day_number || 0)),
      })),
      passengers: passengerList,
      // Only the quote's OWN images. The shared accommodation/lodge libraries are
      // deliberately not merged in any more: an agent's gallery should show what
      // they put on this quote, not every photo any colleague ever uploaded for
      // that hotel. Uploads are still copied into those libraries on create (see
      // quote.service writeQuoteSections) — they're just not read back here.
      //
      // deal_images stays as a fallback: it's this quote's own legacy storage
      // (owner_id = quote id), not shared inventory.
      images: (() => {
        const seen = new Set<string>();
        const result: Array<{ id: string; image_url: string | null; isPrimary: boolean | null; owner_id: string; owner_type: string; s3Key: null }> = [];
        const ownImgs = images.length > 0
          ? images.map(img => ({ id: img.id, image_url: img.url, isPrimary: img.isPrimary, owner_id: id, owner_type: 'quote', s3Key: null as null }))
          : dealImgs.map(img => ({ id: img.id, image_url: img.image_url, isPrimary: img.isPrimary, owner_id: id, owner_type: 'quote', s3Key: null as null }));
        for (const img of ownImgs) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push(img); }
        }
        return result;
      })(),
    };
  },

  async addFlight(data: InsertQuoteFlight): Promise<QuoteFlight> {
    const [result] = await db.insert(quote_flights).values(data).returning();
    return result;
  },

  async updateFlight(id: string, data: Partial<InsertQuoteFlight>): Promise<QuoteFlight | undefined> {
    const [result] = await db.update(quote_flights).set(data).where(eq(quote_flights.id, id)).returning();
    return result;
  },

  async removeFlight(id: string): Promise<void> {
    await db.delete(quote_flights).where(eq(quote_flights.id, id));
  },

  async addAccommodation(data: InsertQuoteAccomodation): Promise<QuoteAccomodation> {
    const [result] = await db.insert(quote_accomodation).values(data).returning();
    return result;
  },

  async updateAccommodation(id: string, data: Partial<InsertQuoteAccomodation>): Promise<QuoteAccomodation | undefined> {
    const [result] = await db.update(quote_accomodation).set(data).where(eq(quote_accomodation.id, id)).returning();
    return result;
  },

  async removeAccommodation(id: string): Promise<void> {
    await db.delete(quote_accomodation).where(eq(quote_accomodation.id, id));
  },

  async addTransfer(data: InsertQuoteTransfer) {
    const [result] = await db.insert(quote_transfers).values(data).returning();
    return result;
  },

  async removeTransfer(id: string): Promise<void> {
    await db.delete(quote_transfers).where(eq(quote_transfers.id, id));
  },

  async addCarHire(data: InsertQuoteCarHire) {
    const [result] = await db.insert(quote_car_hire).values(data).returning();
    return result;
  },

  async removeCarHire(id: string): Promise<void> {
    await db.delete(quote_car_hire).where(eq(quote_car_hire.id, id));
  },

  async addAttractionTicket(data: InsertQuoteAttractionTicket) {
    const [result] = await db.insert(quote_attraction_ticket).values(data).returning();
    return result;
  },

  async removeAttractionTicket(id: string): Promise<void> {
    await db.delete(quote_attraction_ticket).where(eq(quote_attraction_ticket.id, id));
  },

  async addLoungePass(data: InsertQuoteLoungePass) {
    const [result] = await db.insert(quote_lounge_pass).values(data).returning();
    return result;
  },

  async removeLoungePass(id: string): Promise<void> {
    await db.delete(quote_lounge_pass).where(eq(quote_lounge_pass.id, id));
  },

  async addAirportParking(data: InsertQuoteAirportParking) {
    const [result] = await db.insert(quote_airport_parking).values(data).returning();
    return result;
  },

  async removeAirportParking(id: string): Promise<void> {
    await db.delete(quote_airport_parking).where(eq(quote_airport_parking.id, id));
  },

  async addPassenger(data: InsertPassenger) {
    const [result] = await db.insert(passengers).values(data).returning();
    return result;
  },

  async removePassenger(id: string): Promise<void> {
    await db.delete(passengers).where(eq(passengers.id, id));
  },

  async replaceChildPassengers(ownerId: string, ownerType: "quote" | "booking", ages: number[]): Promise<void> {
    if (ownerType === "quote") {
      await db.delete(passengers).where(and(eq(passengers.quote_id, ownerId), eq(passengers.type, "child")));
      if (ages.length > 0) {
        await db.insert(passengers).values(ages.map(age => ({ quote_id: ownerId, type: "child", age })));
      }
    } else {
      await db.delete(passengers).where(and(eq(passengers.booking_id, ownerId), eq(passengers.type, "child")));
      if (ages.length > 0) {
        await db.insert(passengers).values(ages.map(age => ({ booking_id: ownerId, type: "child", age })));
      }
    }
  },

  async upsertFlightByType(quoteId: string, flightType: string, data: Partial<InsertQuoteFlight>, legOrder: number = 0): Promise<QuoteFlight> {
    const converted = convertFlightDates(data as Record<string, unknown>) as Partial<InsertQuoteFlight>;
    const [existing] = await db.select().from(quote_flights)
      .where(and(eq(quote_flights.quote_id, quoteId), eq(quote_flights.flight_type, flightType), eq(quote_flights.leg_order, legOrder)))
      .limit(1);

    if (existing) {
      const [result] = await db.update(quote_flights).set({ ...converted, leg_order: legOrder }).where(eq(quote_flights.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_flights).values({ ...converted, quote_id: quoteId, flight_type: flightType, leg_order: legOrder }).returning();
      return result;
    }
  },

  async replaceConnectingLegs(quoteId: string, flightType: string, legs: Partial<InsertQuoteFlight>[]): Promise<QuoteFlight[]> {
    return db.transaction(async (tx) => {
      await tx.delete(quote_flights)
        .where(sql`${quote_flights.quote_id} = ${quoteId} AND ${quote_flights.flight_type} = ${flightType} AND ${quote_flights.leg_order} > 0`);

      if (legs.length === 0) return [];

      const rows = legs.map((leg, i) => ({
        ...(convertFlightDates(leg as Record<string, unknown>) as Partial<InsertQuoteFlight>),
        quote_id: quoteId,
        flight_type: flightType,
        leg_order: i + 1,
      }));
      return tx.insert(quote_flights).values(rows).returning();
    });
  },

  async upsertPrimaryAccommodation(quoteId: string, data: Partial<InsertQuoteAccomodation>): Promise<QuoteAccomodation> {
    const converted = convertAccommodationDates(data as Record<string, unknown>) as Partial<InsertQuoteAccomodation>;
    const [existing] = await db.select().from(quote_accomodation)
      .where(and(eq(quote_accomodation.quote_id, quoteId), eq(quote_accomodation.is_primary, true)))
      .limit(1);

    if (existing) {
      const [result] = await db.update(quote_accomodation).set(converted).where(eq(quote_accomodation.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_accomodation).values({ ...converted, quote_id: quoteId, is_primary: true }).returning();
      return result;
    }
  },

  async upsertCruise(quoteId: string, data: Record<string, unknown>): Promise<void> {
    const values = {
      cruise_line: (data.cruiseLine as string) || null,
      ship: (data.shipName as string) || null,
      cruise_date: (data.cruiseDate as string) || null,
      cabin_type: (data.cabinType as string) || null,
      cabin_number: (data.cabinNumber as string) || null,
      embarkation: (data.embarkation as string) || null,
      debarkation: (data.debarkation as string) || null,
      cruise_name: (data.cruiseTitle as string) || null,
      tour_operator_id: (data.tourOperatorId as string) || null,
      pre_cruise_stay: Number(data.preCruiseStay) || 0,
      post_cruise_stay: Number(data.postCruiseStay) || 0,
    };

    const [existing] = await db.select().from(quote_cruise).where(eq(quote_cruise.quote_id, quoteId)).limit(1);
    let cruiseRow;
    if (existing) {
      [cruiseRow] = await db.update(quote_cruise).set(values).where(eq(quote_cruise.id, existing.id)).returning();
    } else {
      [cruiseRow] = await db.insert(quote_cruise)
        .values({ ...values, quote_id: quoteId })
        .returning();
    }

    const cruiseId = cruiseRow.id;

    await db.transaction(async (tx) => {
      // Replace the per-quote day-by-day itinerary snapshot.
      const itinerary = Array.isArray(data.cruiseItinerary) ? (data.cruiseItinerary as Array<Record<string, unknown>>) : undefined;
      if (itinerary !== undefined) {
        await tx.delete(quote_cruise_itinerary).where(eq(quote_cruise_itinerary.quote_cruise_id, cruiseId));
        const itineraryRows = itinerary
          .map((d) => {
            const dayNo = Number(d.day ?? d.day_number);
            if (!Number.isFinite(dayNo)) return null;
            return {
              quote_cruise_id: cruiseId,
              day_number: dayNo,
              description: (d.description as string) || null,
              sub_description: (d.subDescription as string) || (d.sub_description as string) || null,
            };
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);
        if (itineraryRows.length > 0) {
          await tx.insert(quote_cruise_itinerary).values(itineraryRows);
        }
      }

      // Cruise extras: comma-separated free text → find-or-create catalog items, then re-link.
      if (data.cruiseExtras !== undefined) {
        await tx.delete(quote_cruise_item_extra).where(eq(quote_cruise_item_extra.quote_cruise_id, cruiseId));
        const names = String(data.cruiseExtras || "")
          .split(",")
          .map((n) => n.trim())
          .filter((n) => n.length > 0);

        if (names.length > 0) {
          // Resolve all existing catalog items in one query.
          const existingExtras = await tx
            .select({ id: cruise_extra_item.id, name: cruise_extra_item.name })
            .from(cruise_extra_item)
            .where(inArray(cruise_extra_item.name, names));

          const existingByName = new Map(existingExtras.map((e) => [e.name?.toLowerCase() ?? '', e.id]));

          // Insert any missing catalog items one-by-one (they are rare; names are unique).
          const extraIds: string[] = [];
          for (const name of names) {
            const existing = existingByName.get(name.toLowerCase());
            if (existing) {
              extraIds.push(existing);
            } else {
              const [created] = await tx.insert(cruise_extra_item).values({ name }).returning();
              extraIds.push(created.id);
            }
          }

          // Bulk-insert the link rows.
          await tx.insert(quote_cruise_item_extra).values(
            extraIds.map((extraId) => ({ quote_cruise_id: cruiseId, cruise_extra_id: extraId })),
          );
        }
      }
    });
  },

  async removeFlightsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_flights).where(eq(quote_flights.quote_id, quoteId));
  },

  async removeAccommodationsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_accomodation).where(eq(quote_accomodation.quote_id, quoteId));
  },

  async saveImagesToAccommodation(accommodationId: string, imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) return;
    await db.insert(accommodation_images)
      .values(imageUrls.map((url) => ({ accommodation_id: accommodationId, image_url: url })))
      .onConflictDoNothing();
  },

  async saveImagesToLodge(lodgeId: string, imageUrls: string[]): Promise<void> {
    if (imageUrls.length === 0) return;
    await db.insert(lodge_images)
      .values(imageUrls.map((url) => ({ lodge_id: lodgeId, image_url: url })))
      .onConflictDoNothing();
  },

  async replaceTransfers(quoteId: string, transfers: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_transfers).where(eq(quote_transfers.quote_id, quoteId));
      if (transfers.length === 0) return;
      await tx.insert(quote_transfers).values(
        transfers.map((t) => ({
          quote_id: quoteId,
          booking_ref: (t.booking_ref as string) || null,
          tour_operator_id: (t.tour_operator_id as string) || null,
          pick_up_location: (t.pick_up_location as string) || null,
          drop_off_location: (t.drop_off_location as string) || null,
          pick_up_time: toDateOrNull(t.pick_up_time),
          drop_off_time: toDateOrNull(t.drop_off_time),
          note: (t.note as string) || null,
          cost: t.cost != null ? String(t.cost) : null,
          commission: t.commission != null ? String(t.commission) : null,
          is_included_in_package: (t.is_included_in_package as boolean) ?? true,
        }) as InsertQuoteTransfer),
      );
    });
  },

  async replaceCarHires(quoteId: string, carHires: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_car_hire).where(eq(quote_car_hire.quote_id, quoteId));
      if (carHires.length === 0) return;
      await tx.insert(quote_car_hire).values(
        carHires.map((c) => ({
          quote_id: quoteId,
          booking_ref: (c.booking_ref as string) || null,
          tour_operator_id: (c.tour_operator_id as string) || null,
          pick_up_location: (c.pick_up_location as string) || null,
          drop_off_location: (c.drop_off_location as string) || null,
          pick_up_time: toDateOrNull(c.pick_up_time),
          drop_off_time: toDateOrNull(c.drop_off_time),
          no_of_days: (c.no_of_days as number) ?? 1,
          driver_age: (c.driver_age as number) ?? 25,
          cost: c.cost != null ? String(c.cost) : null,
          commission: c.commission != null ? String(c.commission) : null,
          is_included_in_package: (c.is_included_in_package as boolean) ?? true,
        }) as InsertQuoteCarHire),
      );
    });
  },

  async replaceAttractionTickets(quoteId: string, tickets: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_attraction_ticket).where(eq(quote_attraction_ticket.quote_id, quoteId));
      if (tickets.length === 0) return;
      await tx.insert(quote_attraction_ticket).values(
        tickets.map((t) => ({
          quote_id: quoteId,
          booking_ref: (t.booking_ref as string) || null,
          tour_operator_id: (t.tour_operator_id as string) || null,
          ticket_type: (t.ticket_type as string) || null,
          date_of_visit: toDateOrNull(t.date_of_visit),
          number_of_tickets: (t.number_of_tickets as number) ?? 1,
          cost: t.cost != null ? String(t.cost) : null,
          commission: t.commission != null ? String(t.commission) : null,
          is_included_in_package: (t.is_included_in_package as boolean) ?? true,
        }) as InsertQuoteAttractionTicket),
      );
    });
  },

  async replaceLoungePasses(quoteId: string, passes: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_lounge_pass).where(eq(quote_lounge_pass.quote_id, quoteId));
      if (passes.length === 0) return;
      await tx.insert(quote_lounge_pass).values(
        passes.map((p) => ({
          quote_id: quoteId,
          booking_ref: (p.booking_ref as string) || null,
          tour_operator_id: (p.tour_operator_id as string) || null,
          airport_id: (p.airport_id as string) || null,
          terminal: (p.terminal as string) || null,
          date_of_usage: toDateOrNull(p.date_of_usage),
          note: (p.note as string) || null,
          cost: p.cost != null ? String(p.cost) : null,
          commission: p.commission != null ? String(p.commission) : null,
          is_included_in_package: (p.is_included_in_package as boolean) ?? true,
        }) as InsertQuoteLoungePass),
      );
    });
  },

  async replaceAirportParkings(quoteId: string, parkings: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_airport_parking).where(eq(quote_airport_parking.quote_id, quoteId));
      if (parkings.length === 0) return;
      await tx.insert(quote_airport_parking).values(
        parkings.map((p) => ({
          quote_id: quoteId,
          booking_ref: (p.booking_ref as string) || null,
          tour_operator_id: (p.tour_operator_id as string) || null,
          airport_id: (p.airport_id as string) || null,
          parking_type: (p.parking_type as string) || null,
          parking_date: toDateOrNull(p.parking_date),
          car_make: (p.car_make as string) || null,
          car_model: (p.car_model as string) || null,
          colour: (p.colour as string) || null,
          car_reg_number: (p.car_reg_number as string) || null,
          duration: (p.duration as string) || null,
          cost: p.cost != null ? String(p.cost) : null,
          commission: p.commission != null ? String(p.commission) : null,
          is_included_in_package: (p.is_included_in_package as boolean) ?? true,
        }) as InsertQuoteAirportParking),
      );
    });
  },

  async replaceExtraAccommodations(quoteId: string, accomms: Array<Record<string, unknown>>): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.delete(quote_accomodation)
        .where(and(eq(quote_accomodation.quote_id, quoteId), eq(quote_accomodation.is_primary, false)));
      if (accomms.length === 0) return;
      await tx.insert(quote_accomodation).values(
        accomms.map((a) => {
          const converted = convertAccommodationDates(a) as Partial<InsertQuoteAccomodation>;
          return {
            ...converted,
            quote_id: quoteId,
            is_primary: false,
            booking_ref: (a.booking_ref as string) || null,
            tour_operator_id: (a.tour_operator_id as string) || null,
            accomodation_id: (a.accomodation_id as string) || null,
            board_basis_id: (a.board_basis_id as string) || null,
            room_type: (a.room_type as string) || null,
            no_of_nights: (a.no_of_nights as number) ?? 0,
            cost: a.cost != null ? String(a.cost) : null,
            commission: a.commission != null ? String(a.commission) : null,
            is_included_in_package: (a.is_included_in_package as boolean) ?? true,
          } as InsertQuoteAccomodation;
        }),
      );
    });
  },

  async findRecentClientEngagement(opts: {
    orgId: string | null;
    userId?: string | null;
    limit?: number;
  }) {
    const { orgId, userId, limit = 10 } = opts;
    // Include public-link views (viewerName IS NULL) too — anonymous views still
    // represent client engagement and must bump the quote up the recency list.
    // The frontend already handles null viewerName.
    const whereParts: any[] = [];
    if (orgId) whereParts.push(eq(transaction.org_id, orgId));
    if (userId) whereParts.push(eq(transaction.user_id, userId));

    const grouped = await db
      .select({
        quoteId: quoteViewsTable.quoteId,
        lastViewedAt: sql<Date>`max(${quoteViewsTable.viewedAt})`,
        quoteTitle: quote.title,
        destinationName: destination.name,
        countryName: country.country_name,
        clientId: transaction.client_id,
        clientFirstName: clientTable.firstName,
        clientSurename: clientTable.surename,
      })
      .from(quoteViewsTable)
      .innerJoin(quote, eq(quote.id, quoteViewsTable.quoteId))
      .innerJoin(transaction, eq(transaction.id, quote.transaction_id))
      .leftJoin(clientTable, eq(clientTable.id, transaction.client_id))
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(accomodation_list, eq(accomodation_list.id, quote_accomodation.accomodation_id))
      .leftJoin(resorts, eq(resorts.id, accomodation_list.resorts_id))
      .leftJoin(destination, eq(destination.id, resorts.destination_id))
      .leftJoin(country, eq(country.id, destination.country_id))
      .where(and(...whereParts))
      .groupBy(
        quoteViewsTable.quoteId,
        quote.title,
        destination.name,
        country.country_name,
        transaction.client_id,
        clientTable.firstName,
        clientTable.surename,
      )
      .orderBy(desc(sql`max(${quoteViewsTable.viewedAt})`))
      .limit(limit);

    if (grouped.length === 0) return [];

    const quoteIds = grouped.map((g) => g.quoteId);
    const allViews = await db
      .select({
        quoteId: quoteViewsTable.quoteId,
        viewedAt: quoteViewsTable.viewedAt,
        viewerName: quoteViewsTable.viewerName,
        deviceType: quoteViewsTable.deviceType,
        browser: quoteViewsTable.browser,
      })
      .from(quoteViewsTable)
      .where(inArray(quoteViewsTable.quoteId, quoteIds))
      .orderBy(desc(quoteViewsTable.viewedAt));

    const viewsByQuote = new Map<string, typeof allViews>();
    for (const v of allViews) {
      const list = viewsByQuote.get(v.quoteId) ?? [];
      list.push(v);
      viewsByQuote.set(v.quoteId, list);
    }

    return grouped.map((g) => {
      const views = viewsByQuote.get(g.quoteId) ?? [];
      return {
        quoteId: g.quoteId,
        quoteTitle: g.quoteTitle || g.destinationName || g.countryName || "Quote",
        clientId: g.clientId,
        clientName: [g.clientFirstName, g.clientSurename].filter((v) => v && v !== "NULL").join(" ").trim() || "Unknown",
        // Count every view from the join-free views list so the badge matches the
        // expanded view list exactly (not count(*) on the joined query, which
        // multiplied per accommodation/destination row).
        clientViewCount: views.length,
        lastViewedAt: g.lastViewedAt,
        views,
      };
    });
  },
};
