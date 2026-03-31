import { db } from "../config/database";
import {
  quote, quote_flights, quote_accomodation, quote_transfers, quote_car_hire,
  quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  quote_cruise, quote_cruise_item_extra, quote_cruise_itinerary,
  passengers, deal_images, quoteImages, tags, quoteTags,
  accommodation_images, lodge_images,
  package_type, tour_operator, airport, accomodation_list, board_basis,
  transaction, resorts, destination, country, room_type,
  lodges,
  park,
  travel_deal,
} from "@shared/schema";
import type {
  Quote, InsertQuote, QuoteFlight, InsertQuoteFlight, QuoteAccomodation, InsertQuoteAccomodation,
  InsertQuoteTransfer, InsertQuoteCarHire, InsertQuoteAttractionTicket,
  InsertQuoteLoungePass, InsertQuoteAirportParking, InsertPassenger,
} from "@shared/schema";
import { eq, desc, sql, and, or, inArray, isNotNull, gte, lte } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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
    const [result] = await db.select().from(quote).where(eq(quote.id, id)).limit(1);
    return result;
  },

  async findByTransactionId(transactionId: string): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.transaction_id, transactionId)).orderBy(desc(quote.date_created));
  },

  async findAll(): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.isFreeQuote, false)).orderBy(desc(quote.date_created));
  },

  async findByStatus(status: Quote['quote_status']): Promise<Quote[]> {
    return await db.select().from(quote).where(sql`${quote.quote_status} = ${status}`).orderBy(desc(quote.date_created));
  },

  async findFreeQuotesPaginated(page: number = 0, pageSize: number = 12, scheduledOnly = false, scheduleFilter = "none", search = "", rangeStart = "", rangeEnd = "") {
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
      ...(searchCondition ? [searchCondition] : []),
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

      // Fetch ALL matching distinct IDs first, then slice for the page.
      // This avoids SELECT DISTINCT + OFFSET drift when a quote has multiple
      // matching travel_deal rows — OFFSET on a non-deduplicated set is unreliable.
      const allRows = await db
        .selectDistinct({ id: quote.id, date_created: quote.date_created })
        .from(quote)
        .innerJoin(travel_deal, and(...dealJoinConditions))
        .where(and(...baseWhereConditions))
        .orderBy(desc(quote.date_created));

      ids = allRows.slice(offset, offset + pageSize).map(r => r.id);
    } else {
      const rows = await db
        .select({ id: quote.id })
        .from(quote)
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

    // Return quotes in the original order
    return ids.map(id => quoteMap.get(id)).filter(Boolean);
  },

  async create(data: InsertQuote): Promise<Quote> {
    const [result] = await db.insert(quote).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [result] = await db.update(quote).set(data).where(eq(quote.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(quote).where(eq(quote.id, id));
  },

  async findWithDetails(id: string) {
    const [q] = await db
      .select({
        quote: quote,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        lead_source: transaction.lead_source,
        user_id: transaction.user_id,
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
      .where(eq(quote.id, id))
      .limit(1);

    if (!q) return undefined;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images, quoteTags_list, accommodationImgs, lodgeImgs] = await Promise.all([
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
      db.select().from(quoteImages).where(eq(quoteImages.quoteId, id)),
      
      // Fetch tags through junction table
      db.select({
        tagName: tags.name,
      })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(eq(quoteTags.quoteId, id)),

      // Fetch accommodation images through quote_accomodation junction
      db.select({
        id: accommodation_images.id,
        accommodation_id: accommodation_images.accommodation_id,
        image_url: accommodation_images.image_url,
        isPrimary: accommodation_images.isPrimary,
      })
        .from(accommodation_images)
        .innerJoin(
          quote_accomodation,
          and(
            eq(quote_accomodation.accomodation_id, accommodation_images.accommodation_id),
            eq(quote_accomodation.quote_id, id)
          )
        ),

      // Fetch lodge images if quote has a lodge
      q.quote.lodge_id
        ? db.select({
            id: lodge_images.id,
            lodge_id: lodge_images.lodge_id,
            image_url: lodge_images.image_url,
            isPrimary: lodge_images.isPrimary,
          }).from(lodge_images).where(eq(lodge_images.lodge_id, q.quote.lodge_id))
        : Promise.resolve([]),
    ]);

    // Fetch cruise extras and itineraries (depend on cruise IDs from above)
    const cruiseIds = cruises.map(c => c.cruise.id);
    let cruiseItemExtras: { id: string; cruise_extra_id: string | null; quote_cruise_id: string | null }[] = [];
    let cruiseItineraries: { id: string; quote_cruise_id: string | null; day_number: number | null; description: string | null }[] = [];
    if (cruiseIds.length > 0) {
      [cruiseItemExtras, cruiseItineraries] = await Promise.all([
        db.select().from(quote_cruise_item_extra).where(inArray(quote_cruise_item_extra.quote_cruise_id, cruiseIds)),
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
      images: (() => {
        const seen = new Set<string>();
        const result: Array<{ id: string; image_url: string | null; isPrimary: boolean | null; owner_id: string; owner_type: string; s3Key: null }> = [];
        for (const img of images) {
          const url = img.url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: id, owner_type: 'quote', s3Key: null }); }
        }
        for (const img of accommodationImgs) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.accommodation_id, owner_type: 'accommodation', s3Key: null }); }
        }
        for (const img of (lodgeImgs as Array<{ id: string; lodge_id: string; image_url: string; isPrimary: boolean | null }>)) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.lodge_id, owner_type: 'lodge', s3Key: null }); }
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

  async upsertFlightByType(quoteId: string, flightType: string, data: Partial<InsertQuoteFlight>, legOrder: number = 0): Promise<QuoteFlight> {
    const converted = convertFlightDates(data as Record<string, unknown>) as Partial<InsertQuoteFlight>;
    const existing = await db.select().from(quote_flights)
      .where(eq(quote_flights.quote_id, quoteId))
      .then(rows => rows.find(r => r.flight_type === flightType && r.leg_order === legOrder));

    if (existing) {
      const [result] = await db.update(quote_flights).set({ ...converted, leg_order: legOrder }).where(eq(quote_flights.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_flights).values({ ...converted, quote_id: quoteId, flight_type: flightType, leg_order: legOrder }).returning();
      return result;
    }
  },

  async replaceConnectingLegs(quoteId: string, flightType: string, legs: Partial<InsertQuoteFlight>[]): Promise<QuoteFlight[]> {
    await db.delete(quote_flights)
      .where(sql`${quote_flights.quote_id} = ${quoteId} AND ${quote_flights.flight_type} = ${flightType} AND ${quote_flights.leg_order} > 0`);

    const results: QuoteFlight[] = [];
    for (let i = 0; i < legs.length; i++) {
      const converted = convertFlightDates(legs[i] as Record<string, unknown>) as Partial<InsertQuoteFlight>;
      const [result] = await db.insert(quote_flights).values({
        ...converted,
        quote_id: quoteId,
        flight_type: flightType,
        leg_order: i + 1,
      }).returning();
      results.push(result);
    }
    return results;
  },

  async upsertPrimaryAccommodation(quoteId: string, data: Partial<InsertQuoteAccomodation>): Promise<QuoteAccomodation> {
    const converted = convertAccommodationDates(data as Record<string, unknown>) as Partial<InsertQuoteAccomodation>;
    const existing = await db.select().from(quote_accomodation)
      .where(eq(quote_accomodation.quote_id, quoteId))
      .then(rows => rows.find(r => r.is_primary));

    if (existing) {
      const [result] = await db.update(quote_accomodation).set(converted).where(eq(quote_accomodation.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_accomodation).values({ ...converted, quote_id: quoteId, is_primary: true }).returning();
      return result;
    }
  },

  async removeFlightsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_flights).where(eq(quote_flights.quote_id, quoteId));
  },

  async removeAccommodationsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_accomodation).where(eq(quote_accomodation.quote_id, quoteId));
  },

  async saveImagesToAccommodation(accommodationId: string, imageUrls: string[]): Promise<void> {
    for (const url of imageUrls) {
      await db.insert(accommodation_images)
        .values({ accommodation_id: accommodationId, image_url: url })
        .onConflictDoNothing();
    }
  },

  async saveImagesToLodge(lodgeId: string, imageUrls: string[]): Promise<void> {
    for (const url of imageUrls) {
      await db.insert(lodge_images)
        .values({ lodge_id: lodgeId, image_url: url })
        .onConflictDoNothing();
    }
  },

  async replaceTransfers(quoteId: string, transfers: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_transfers).where(eq(quote_transfers.quote_id, quoteId));
    for (const t of transfers) {
      await db.insert(quote_transfers).values({
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
      } as InsertQuoteTransfer);
    }
  },

  async replaceCarHires(quoteId: string, carHires: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_car_hire).where(eq(quote_car_hire.quote_id, quoteId));
    for (const c of carHires) {
      await db.insert(quote_car_hire).values({
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
      } as InsertQuoteCarHire);
    }
  },

  async replaceAttractionTickets(quoteId: string, tickets: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_attraction_ticket).where(eq(quote_attraction_ticket.quote_id, quoteId));
    for (const t of tickets) {
      await db.insert(quote_attraction_ticket).values({
        quote_id: quoteId,
        booking_ref: (t.booking_ref as string) || null,
        tour_operator_id: (t.tour_operator_id as string) || null,
        ticket_type: (t.ticket_type as string) || null,
        date_of_visit: toDateOrNull(t.date_of_visit),
        number_of_tickets: (t.number_of_tickets as number) ?? 1,
        cost: t.cost != null ? String(t.cost) : null,
        commission: t.commission != null ? String(t.commission) : null,
        is_included_in_package: (t.is_included_in_package as boolean) ?? true,
      } as InsertQuoteAttractionTicket);
    }
  },

  async replaceLoungePasses(quoteId: string, passes: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_lounge_pass).where(eq(quote_lounge_pass.quote_id, quoteId));
    for (const p of passes) {
      await db.insert(quote_lounge_pass).values({
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
      } as InsertQuoteLoungePass);
    }
  },

  async replaceAirportParkings(quoteId: string, parkings: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_airport_parking).where(eq(quote_airport_parking.quote_id, quoteId));
    for (const p of parkings) {
      await db.insert(quote_airport_parking).values({
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
      } as InsertQuoteAirportParking);
    }
  },

  async replaceExtraAccommodations(quoteId: string, accomms: Array<Record<string, unknown>>): Promise<void> {
    await db.delete(quote_accomodation)
      .where(and(eq(quote_accomodation.quote_id, quoteId), eq(quote_accomodation.is_primary, false)));
    for (const a of accomms) {
      const converted = convertAccommodationDates(a) as Partial<InsertQuoteAccomodation>;
      await db.insert(quote_accomodation).values({
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
      } as InsertQuoteAccomodation);
    }
  },
};
