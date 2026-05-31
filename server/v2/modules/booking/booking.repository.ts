import { db } from "../../config/database";
import {
  booking, booking_flights, booking_accomodation, booking_transfers,
  booking_car_hire, booking_attraction_ticket, booking_lounge_pass,
  booking_airport_parking, booking_cruise, booking_cruise_item_extra,
  booking_cruise_itinerary, passengers, deal_images, bookingImages, accommodation_images, lodge_images,
  package_type, tour_operator, airport, accomodation_list, board_basis,
  transaction, resorts, destination, country, room_type, referral, clientTable,
} from "@shared/schema";
import type {
  Booking, InsertBooking, InsertBookingFlight, BookingFlight,
  InsertBookingAccomodation, BookingAccomodation, InsertBookingTransfer,
  InsertBookingCarHire, InsertBookingAttractionTicket, InsertBookingLoungePass,
  InsertBookingAirportParking, InsertBookingCruise, InsertBookingCruiseItemExtra,
  InsertBookingCruiseItinerary,
} from "@shared/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { buildTransactionScopeConds, type ScopeOrTrusted } from "../../utils/scope-conditions";

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

export const bookingRepository = {
  async findById(id: string): Promise<Booking | undefined> {
    const [result] = await db.select().from(booking).where(eq(booking.id, id)).limit(1);
    return result;
  },

  async bookingInScope(id: string, scope: ScopeOrTrusted): Promise<boolean> {
    const scopeConds = buildTransactionScopeConds(scope);
    const [row] = await db
      .select({ id: booking.id })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(and(eq(booking.id, id), ...scopeConds))
      .limit(1);
    return !!row;
  },

  async transactionInScope(transactionId: string, scope: ScopeOrTrusted): Promise<boolean> {
    const scopeConds = buildTransactionScopeConds(scope);
    const [row] = await db
      .select({ id: transaction.id })
      .from(transaction)
      .where(and(eq(transaction.id, transactionId), ...scopeConds))
      .limit(1);
    return !!row;
  },

  async flightInScope(flightId: string, scope: ScopeOrTrusted): Promise<boolean> {
    const scopeConds = buildTransactionScopeConds(scope);
    const [row] = await db
      .select({ id: booking_flights.id })
      .from(booking_flights)
      .innerJoin(booking, eq(booking_flights.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(and(eq(booking_flights.id, flightId), ...scopeConds))
      .limit(1);
    return !!row;
  },

  async accommodationInScope(accommodationId: string, scope: ScopeOrTrusted): Promise<boolean> {
    const scopeConds = buildTransactionScopeConds(scope);
    const [row] = await db
      .select({ id: booking_accomodation.id })
      .from(booking_accomodation)
      .innerJoin(booking, eq(booking_accomodation.booking_id, booking.id))
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(and(eq(booking_accomodation.id, accommodationId), ...scopeConds))
      .limit(1);
    return !!row;
  },

  async findByTransactionId(transactionId: string): Promise<Booking | undefined> {
    const [result] = await db.select().from(booking).where(eq(booking.transaction_id, transactionId)).limit(1);
    return result;
  },

  async countByClientId(clientId: string): Promise<number> {
    const result = await db
      .select({ count: sql<number>`cast(count(*) as int)` })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(eq(transaction.client_id, clientId));
    return result[0]?.count || 0;
  },

  async findAll(orgId: string | null): Promise<Booking[]> {
    if (!orgId) {
      return db.select().from(booking).orderBy(desc(booking.date_created));
    }
    const rows = await db
      .select({ booking })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(eq(clientTable.orgId, orgId))
      .orderBy(desc(booking.date_created));
    return rows.map((r) => r.booking);
  },

  async findAllWithImages(scope: ScopeOrTrusted) {
    const scopeConds = buildTransactionScopeConds(scope);
    const baseQuery = db
      .select({ booking })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
    const rows = scopeConds.length > 0
      ? await baseQuery.where(and(...scopeConds)).orderBy(desc(booking.date_created))
      : await baseQuery.orderBy(desc(booking.date_created));
    const bookings = rows.map((r) => r.booking);
    if (bookings.length === 0) return [];

    const bookingIds = bookings.map(b => b.id);
    const lodgeIds = bookings.map(b => b.lodge_id).filter((id): id is string => id !== null);

    const [dealImgs, bookingImgs, accommodationImgs, lodgeImgs] = await Promise.all([
      db.select().from(deal_images).where(inArray(deal_images.owner_id, bookingIds)),

      db.select().from(bookingImages).where(inArray(bookingImages.bookingId, bookingIds)),

      db.select({
        booking_id: booking_accomodation.booking_id,
        id: accommodation_images.id,
        accommodation_id: accommodation_images.accommodation_id,
        image_url: accommodation_images.image_url,
        isPrimary: accommodation_images.isPrimary,
      })
        .from(accommodation_images)
        .innerJoin(
          booking_accomodation,
          and(
            eq(booking_accomodation.accomodation_id, accommodation_images.accommodation_id),
            inArray(booking_accomodation.booking_id, bookingIds)
          )
        ),

      lodgeIds.length > 0
        ? db.select({
            id: lodge_images.id,
            lodge_id: lodge_images.lodge_id,
            image_url: lodge_images.image_url,
            isPrimary: lodge_images.isPrimary,
          }).from(lodge_images).where(inArray(lodge_images.lodge_id, lodgeIds))
        : Promise.resolve([]),
    ]);

    const dealImgsByBookingId = new Map<string, typeof dealImgs>();
    for (const img of dealImgs) {
      const list = dealImgsByBookingId.get(img.owner_id) ?? [];
      list.push(img);
      dealImgsByBookingId.set(img.owner_id, list);
    }

    const bookingImgsByBookingId = new Map<string, typeof bookingImgs>();
    for (const img of bookingImgs) {
      if (!img.bookingId) continue;
      const list = bookingImgsByBookingId.get(img.bookingId) ?? [];
      list.push(img);
      bookingImgsByBookingId.set(img.bookingId, list);
    }

    const accomImgsByBookingId = new Map<string, (typeof accommodationImgs)[number][]>();
    for (const img of accommodationImgs) {
      if (!img.booking_id) continue;
      const list = accomImgsByBookingId.get(img.booking_id) ?? [];
      list.push(img);
      accomImgsByBookingId.set(img.booking_id, list);
    }

    const lodgeImgsByLodgeId = new Map<string, (typeof lodgeImgs)[number][]>();
    for (const img of lodgeImgs) {
      const list = lodgeImgsByLodgeId.get(img.lodge_id) ?? [];
      list.push(img);
      lodgeImgsByLodgeId.set(img.lodge_id, list);
    }

    return bookings.map(b => {
      const seen = new Set<string>();
      const images: { id: string; image_url: string | null; isPrimary: boolean | null; owner_id: string; s3Key: string | null }[] = [];

      for (const img of bookingImgsByBookingId.get(b.id) ?? []) {
        const url = img.url || '';
        if (url && !seen.has(url)) {
          seen.add(url);
          images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: b.id, s3Key: null });
        }
      }
      for (const img of dealImgsByBookingId.get(b.id) ?? []) {
        const url = img.image_url || '';
        if (url && !seen.has(url)) { seen.add(url); images.push(img); }
      }
      for (const img of accomImgsByBookingId.get(b.id) ?? []) {
        const url = img.image_url || '';
        if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.accommodation_id, s3Key: null }); }
      }
      if (b.lodge_id) {
        for (const img of lodgeImgsByLodgeId.get(b.lodge_id) ?? []) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); images.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.lodge_id, s3Key: null }); }
        }
      }

      return { ...b, images };
    });
  },

  async create(data: InsertBooking): Promise<Booking> {
    const [result] = await db.insert(booking).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertBooking>): Promise<Booking | undefined> {
    const [result] = await db.update(booking).set(data).where(eq(booking.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(booking).where(eq(booking.id, id));
  },

  async findWithDetails(id: string) {
    const [b] = await db
      .select({
        booking: booking,
        holiday_type_name: package_type.name,
        main_tour_operator_name: tour_operator.name,
        lead_source: transaction.lead_source,
        user_id: transaction.user_id,
      })
      .from(booking)
      .leftJoin(package_type, eq(booking.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(booking.main_tour_operator_id, tour_operator.id))
      .leftJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(eq(booking.id, id))
      .limit(1);

    if (!b) return undefined;

    const bookingTransactionId = b.booking.transaction_id;
    const bookingLodgeId = b.booking.lodge_id;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images, bookingImgs, referralRows, accommodationImgs, lodgeImgs] = await Promise.all([
      db.select({
        flight: booking_flights,
        departing_airport_name: sql<string>`concat(${departAirport.airport_name}, ' (', ${departAirport.airport_code}, ')')`,
        arrival_airport_name: sql<string>`concat(${arriveAirport.airport_name}, ' (', ${arriveAirport.airport_code}, ')')`,
        tour_operator_name: flightTourOp.name,
      })
        .from(booking_flights)
        .leftJoin(departAirport, eq(booking_flights.departing_airport_id, departAirport.id))
        .leftJoin(arriveAirport, eq(booking_flights.arrival_airport_id, arriveAirport.id))
        .leftJoin(flightTourOp, eq(booking_flights.tour_operator_id, flightTourOp.id))
        .where(eq(booking_flights.booking_id, id)),

      db.select({
        accommodation: booking_accomodation,
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
        .from(booking_accomodation)
        .leftJoin(accomodation_list, eq(booking_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
        .leftJoin(destination, eq(resorts.destination_id, destination.id))
        .leftJoin(country, eq(destination.country_id, country.id))
        .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
        .leftJoin(accomTourOp, eq(booking_accomodation.tour_operator_id, accomTourOp.id))
        .leftJoin(room_type, sql`CASE WHEN ${booking_accomodation.room_type} ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN ${booking_accomodation.room_type}::uuid ELSE NULL END = ${room_type.id}`)
        .where(eq(booking_accomodation.booking_id, id)),

      db.select({
        transfer: booking_transfers,
        tour_operator_name: transferTourOp.name,
      })
        .from(booking_transfers)
        .leftJoin(transferTourOp, eq(booking_transfers.tour_operator_id, transferTourOp.id))
        .where(eq(booking_transfers.booking_id, id)),

      db.select({
        carHire: booking_car_hire,
        tour_operator_name: carHireTourOp.name,
      })
        .from(booking_car_hire)
        .leftJoin(carHireTourOp, eq(booking_car_hire.tour_operator_id, carHireTourOp.id))
        .where(eq(booking_car_hire.booking_id, id)),

      db.select({
        attractionTicket: booking_attraction_ticket,
        tour_operator_name: attractionTourOp.name,
      })
        .from(booking_attraction_ticket)
        .leftJoin(attractionTourOp, eq(booking_attraction_ticket.tour_operator_id, attractionTourOp.id))
        .where(eq(booking_attraction_ticket.booking_id, id)),

      db.select({
        loungePass: booking_lounge_pass,
        airport_name: sql<string>`concat(${loungeAirport.airport_name}, ' (', ${loungeAirport.airport_code}, ')')`,
        tour_operator_name: loungeTourOp.name,
      })
        .from(booking_lounge_pass)
        .leftJoin(loungeAirport, eq(booking_lounge_pass.airport_id, loungeAirport.id))
        .leftJoin(loungeTourOp, eq(booking_lounge_pass.tour_operator_id, loungeTourOp.id))
        .where(eq(booking_lounge_pass.booking_id, id)),

      db.select({
        airportParking: booking_airport_parking,
        airport_name: sql<string>`concat(${parkingAirport.airport_name}, ' (', ${parkingAirport.airport_code}, ')')`,
        tour_operator_name: parkingTourOp.name,
      })
        .from(booking_airport_parking)
        .leftJoin(parkingAirport, eq(booking_airport_parking.airport_id, parkingAirport.id))
        .leftJoin(parkingTourOp, eq(booking_airport_parking.tour_operator_id, parkingTourOp.id))
        .where(eq(booking_airport_parking.booking_id, id)),

      db.select({
        cruise: booking_cruise,
        tour_operator_name: cruiseTourOp.name,
      })
        .from(booking_cruise)
        .leftJoin(cruiseTourOp, eq(booking_cruise.tour_operator_id, cruiseTourOp.id))
        .where(eq(booking_cruise.booking_id, id)),

      db.select().from(passengers).where(eq(passengers.booking_id, id)),
      db.select().from(deal_images).where(eq(deal_images.owner_id, id)),
      db.select().from(bookingImages).where(eq(bookingImages.bookingId, id)),
      bookingTransactionId
        ? db.select({ id: referral.id }).from(referral).where(eq(referral.transactionId, bookingTransactionId)).limit(1)
        : Promise.resolve([]),

      // Fetch accommodation images through booking_accomodation junction
      db.select({
        id: accommodation_images.id,
        accommodation_id: accommodation_images.accommodation_id,
        image_url: accommodation_images.image_url,
        isPrimary: accommodation_images.isPrimary,
      })
        .from(accommodation_images)
        .innerJoin(
          booking_accomodation,
          and(
            eq(booking_accomodation.accomodation_id, accommodation_images.accommodation_id),
            eq(booking_accomodation.booking_id, id)
          )
        ),

      // Fetch lodge images if booking has a lodge
      bookingLodgeId
        ? db.select({
            id: lodge_images.id,
            lodge_id: lodge_images.lodge_id,
            image_url: lodge_images.image_url,
            isPrimary: lodge_images.isPrimary,
          }).from(lodge_images).where(eq(lodge_images.lodge_id, bookingLodgeId))
        : Promise.resolve([]),
    ]);

    return {
      ...b.booking,
      holiday_type_name: b.holiday_type_name,
      main_tour_operator_name: b.main_tour_operator_name,
      lead_source: b.lead_source,
      user_id: b.user_id,
      country_id: accommodations[0]?.country_id || null,
      country_name: accommodations[0]?.country_name || null,
      destination_id: accommodations[0]?.destination_id || null,
      destination_name: accommodations[0]?.destination_name || null,
      resort_id: accommodations[0]?.resort_id || null,
      resort_name: accommodations[0]?.resort_name || null,
      flights: flights.map(f => ({ ...f.flight, departing_airport_name: f.departing_airport_name, arrival_airport_name: f.arrival_airport_name, tour_operator_name: f.tour_operator_name })),
      accommodations: accommodations.map(a => ({
        ...a.accommodation,
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
      cruises: cruises.map(c => ({ ...c.cruise, tour_operator_name: c.tour_operator_name })),
      passengers: passengerList,
      hasReferral: referralRows.length > 0,
      images: (() => {
        const seen = new Set<string>();
        const result: any[] = [];
        for (const img of bookingImgs) {
          const url = img.url || '';
          if (url && !seen.has(url)) {
            seen.add(url);
            result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: id, s3Key: null });
          }
        }
        for (const img of images) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push(img); }
        }
        for (const img of accommodationImgs) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.accommodation_id, s3Key: null }); }
        }
        for (const img of (lodgeImgs as Array<{ id: string; lodge_id: string; image_url: string; isPrimary: boolean | null }>)) {
          const url = img.image_url || '';
          if (url && !seen.has(url)) { seen.add(url); result.push({ id: img.id, image_url: url, isPrimary: img.isPrimary, owner_id: img.lodge_id, s3Key: null }); }
        }
        return result;
      })(),
    };
  },

  async addFlight(data: InsertBookingFlight) {
    const [result] = await db.insert(booking_flights).values(data).returning();
    return result;
  },

  async removeFlight(id: string): Promise<void> {
    await db.delete(booking_flights).where(eq(booking_flights.id, id));
  },

  async addAccommodation(data: InsertBookingAccomodation) {
    const [result] = await db.insert(booking_accomodation).values(data).returning();
    return result;
  },

  async removeAccommodation(id: string): Promise<void> {
    await db.delete(booking_accomodation).where(eq(booking_accomodation.id, id));
  },

  async addTransfer(data: InsertBookingTransfer) {
    const [result] = await db.insert(booking_transfers).values(data).returning();
    return result;
  },

  async removeTransfer(id: string): Promise<void> {
    await db.delete(booking_transfers).where(eq(booking_transfers.id, id));
  },

  async addCarHire(data: InsertBookingCarHire) {
    const [result] = await db.insert(booking_car_hire).values(data).returning();
    return result;
  },

  async addAttractionTicket(data: InsertBookingAttractionTicket) {
    const [result] = await db.insert(booking_attraction_ticket).values(data).returning();
    return result;
  },

  async addLoungePass(data: InsertBookingLoungePass) {
    const [result] = await db.insert(booking_lounge_pass).values(data).returning();
    return result;
  },

  async addAirportParking(data: InsertBookingAirportParking) {
    const [result] = await db.insert(booking_airport_parking).values(data).returning();
    return result;
  },

  async addCruise(data: InsertBookingCruise) {
    const [result] = await db.insert(booking_cruise).values(data).returning();
    return result;
  },

  async addCruiseItemExtra(data: InsertBookingCruiseItemExtra) {
    const [result] = await db.insert(booking_cruise_item_extra).values(data).returning();
    return result;
  },

  async addCruiseItinerary(data: InsertBookingCruiseItinerary) {
    const [result] = await db.insert(booking_cruise_itinerary).values(data).returning();
    return result;
  },

  async replaceTransfers(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    await db.delete(booking_transfers).where(eq(booking_transfers.booking_id, bookingId));
    for (const item of items) {
      await db.insert(booking_transfers).values({
        ...item,
        booking_id: bookingId,
        pick_up_time: toDateOrNull(item.pick_up_time),
        drop_off_time: toDateOrNull(item.drop_off_time),
      } as InsertBookingTransfer);
    }
  },

  async replaceCarHires(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    await db.delete(booking_car_hire).where(eq(booking_car_hire.booking_id, bookingId));
    for (const item of items) {
      await db.insert(booking_car_hire).values({
        ...item,
        booking_id: bookingId,
        pick_up_time: toDateOrNull(item.pick_up_time),
        drop_off_time: toDateOrNull(item.drop_off_time),
      } as InsertBookingCarHire);
    }
  },

  async replaceAttractionTickets(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    await db.delete(booking_attraction_ticket).where(eq(booking_attraction_ticket.booking_id, bookingId));
    for (const item of items) {
      await db.insert(booking_attraction_ticket).values({
        ...item,
        booking_id: bookingId,
        date_of_visit: toDateOrNull(item.date_of_visit),
      } as InsertBookingAttractionTicket);
    }
  },

  async replaceLoungePasses(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    await db.delete(booking_lounge_pass).where(eq(booking_lounge_pass.booking_id, bookingId));
    for (const item of items) {
      await db.insert(booking_lounge_pass).values({
        ...item,
        booking_id: bookingId,
        date_of_usage: toDateOrNull(item.date_of_usage),
      } as InsertBookingLoungePass);
    }
  },

  async replaceAirportParkings(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    await db.delete(booking_airport_parking).where(eq(booking_airport_parking.booking_id, bookingId));
    for (const item of items) {
      await db.insert(booking_airport_parking).values({
        ...item,
        booking_id: bookingId,
        parking_date: toDateOrNull(item.parking_date),
      } as InsertBookingAirportParking);
    }
  },

  async replaceExtraAccommodations(bookingId: string, items: Record<string, unknown>[]): Promise<void> {
    // Delete non-primary accommodations
    const existing = await db.select().from(booking_accomodation).where(eq(booking_accomodation.booking_id, bookingId));
    const nonPrimary = existing.filter(a => !a.is_primary);
    for (const a of nonPrimary) {
      await db.delete(booking_accomodation).where(eq(booking_accomodation.id, a.id));
    }
    for (const item of items) {
      await db.insert(booking_accomodation).values({
        ...item,
        booking_id: bookingId,
        is_primary: false,
        check_in_date_time: toDateOrNull(item.check_in_date_time),
      } as InsertBookingAccomodation);
    }
  },

  async upsertFlightByType(bookingId: string, flightType: string, data: Partial<InsertBookingFlight>): Promise<BookingFlight> {
    const converted = convertFlightDates(data as Record<string, unknown>) as Partial<InsertBookingFlight>;
    const existing = await db.select().from(booking_flights)
      .where(eq(booking_flights.booking_id, bookingId))
      .then(rows => rows.find(r => r.flight_type === flightType));

    if (existing) {
      const [result] = await db.update(booking_flights).set(converted).where(eq(booking_flights.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(booking_flights).values({ ...converted, booking_id: bookingId, flight_type: flightType }).returning();
      return result;
    }
  },

  async upsertPrimaryAccommodation(bookingId: string, data: Partial<InsertBookingAccomodation>): Promise<BookingAccomodation> {
    const converted = convertAccommodationDates(data as Record<string, unknown>) as Partial<InsertBookingAccomodation>;
    const existing = await db.select().from(booking_accomodation)
      .where(eq(booking_accomodation.booking_id, bookingId))
      .then(rows => rows.find(r => r.is_primary));

    if (existing) {
      const [result] = await db.update(booking_accomodation).set(converted).where(eq(booking_accomodation.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(booking_accomodation).values({ ...converted, booking_id: bookingId, is_primary: true }).returning();
      return result;
    }
  },

  async addImages(bookingId: string, images: Array<{ url: string; isPrimary?: boolean | null }>) {
    if (images.length === 0) return [];
    const rows = images.map((img) => ({
      id: crypto.randomUUID(),
      bookingId,
      url: img.url,
      isPrimary: img.isPrimary ?? false,
    }));
    return db.insert(bookingImages).values(rows).returning();
  },
};
