import { db } from "../config/database";
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
  notifications,
} from "@shared/schema";
import type { QuoteView, InsertQuoteView, QuoteCustomerAction, InsertQuoteCustomerAction } from "@shared/schema";
import { eq, desc, sql, and, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import crypto from "crypto";

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
  generateToken(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.randomBytes(6);
    let token = "";
    for (let i = 0; i < 6; i++) {
      token += chars[bytes[i] % chars.length];
    }
    return token;
  },

  async setToken(quoteId: string): Promise<string> {
    const existing = await db.select({ token: quote.quote_token }).from(quote).where(eq(quote.id, quoteId)).limit(1);
    if (existing[0]?.token) return existing[0].token;

    const token = this.generateToken();
    await db.update(quote).set({ quote_token: token }).where(eq(quote.id, quoteId));
    return token;
  },

  async findByToken(token: string) {
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
      .where(eq(quote.quote_token, token))
      .limit(1);

    if (!q) return undefined;

    const id = q.quote.id;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images, quoteTags_list, accommodationImgs, lodgeImgs, agentData] = await Promise.all([
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

      q.quote.lodge_id
        ? db.select({
            id: lodge_images.id,
            lodge_id: lodge_images.lodge_id,
            image_url: lodge_images.image_url,
            isPrimary: lodge_images.isPrimary,
          }).from(lodge_images).where(eq(lodge_images.lodge_id, q.quote.lodge_id))
        : Promise.resolve([]),

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
      const [guruData] = await db.select().from(destinationGuruTable).where(eq(destinationGuruTable.destination, destName)).limit(1);
      destinationGuru = guruData || null;
    }

    const allImages: Array<{ id: string; image_url: string | null; isPrimary: boolean | null }> = [];
    const seen = new Set<string>();
    for (const img of images) {
      const url = img.url || "";
      if (url && !seen.has(url)) { seen.add(url); allImages.push({ id: img.id, image_url: url, isPrimary: img.isPrimary }); }
    }
    for (const img of accommodationImgs) {
      const url = img.image_url || "";
      if (url && !seen.has(url)) { seen.add(url); allImages.push({ id: img.id, image_url: url, isPrimary: img.isPrimary }); }
    }
    for (const img of (lodgeImgs as Array<{ id: string; lodge_id: string; image_url: string; isPrimary: boolean | null }>)) {
      const url = img.image_url || "";
      if (url && !seen.has(url)) { seen.add(url); allImages.push({ id: img.id, image_url: url, isPrimary: img.isPrimary }); }
    }

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
          .map((i: any) => ({ day: i.day_number, description: i.description })),
      })),
      passengers: passengerList.map(p => ({
        title: p.title,
        firstName: p.first_name,
        lastName: p.last_name,
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
    const [result] = await db.insert(quoteViewsTable).values({ quoteId, ...viewData }).returning();
    return result;
  },

  async getViews(quoteId: string): Promise<QuoteView[]> {
    return db.select().from(quoteViewsTable).where(eq(quoteViewsTable.quoteId, quoteId)).orderBy(desc(quoteViewsTable.viewedAt));
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
    return {
      totalViews: views.length,
      uniqueViews: seenIps.size,
      firstViewed: views.length > 0 ? views[views.length - 1].viewedAt : null,
      lastViewed: views.length > 0 ? views[0].viewedAt : null,
      deviceBreakdown,
      views,
    };
  },

  async createCustomerAction(data: InsertQuoteCustomerAction): Promise<QuoteCustomerAction> {
    const [result] = await db.insert(quoteCustomerActionsTable).values(data).returning();
    return result;
  },

  async getCustomerActions(quoteId: string): Promise<QuoteCustomerAction[]> {
    return db.select().from(quoteCustomerActionsTable).where(eq(quoteCustomerActionsTable.quoteId, quoteId)).orderBy(desc(quoteCustomerActionsTable.createdAt));
  },

  async updateSentInfo(quoteId: string, sentVia: string) {
    const [existing] = await db.select({ sentAt: quote.quote_sent_at }).from(quote).where(eq(quote.id, quoteId)).limit(1);
    const updates: Record<string, any> = { quote_sent_via: sentVia };
    if (!existing?.sentAt) {
      updates.quote_sent_at = new Date();
    }
    await db.update(quote).set(updates).where(eq(quote.id, quoteId));
  },

  async findQuoteIdByToken(token: string): Promise<string | null> {
    const [result] = await db.select({ id: quote.id }).from(quote).where(eq(quote.quote_token, token)).limit(1);
    return result?.id || null;
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

  async notifyAgent(quoteId: string, title: string, message: string, link?: string) {
    const agentUserId = await this.getAgentUserIdByQuoteId(quoteId);
    if (!agentUserId) return;
    await db.insert(notifications).values({
      userId: agentUserId,
      type: "quote_viewed",
      title,
      message,
      link: link || null,
    });
  },
};
