import { db } from "../config/database";
import {
  quote, quote_flights, quote_accomodation, quote_transfers, quote_car_hire,
  quote_attraction_ticket, quote_lounge_pass, quote_airport_parking,
  quote_cruise, quote_cruise_item_extra, quote_cruise_itinerary,
  passengers, deal_images,
  package_type, tour_operator, airport, accomodation_list, board_basis,
} from "@shared/schema";
import type { Quote, InsertQuote, QuoteFlight, InsertQuoteFlight, QuoteAccomodation, InsertQuoteAccomodation } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

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

export const newQuoteRepository = {
  async findById(id: string): Promise<Quote | undefined> {
    const [result] = await db.select().from(quote).where(eq(quote.id, id)).limit(1);
    return result;
  },

  async findByTransactionId(transactionId: string): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.transaction_id, transactionId)).orderBy(desc(quote.date_created));
  },

  async findAll(): Promise<Quote[]> {
    return await db.select().from(quote).orderBy(desc(quote.date_created));
  },

  async findByStatus(status: string): Promise<Quote[]> {
    return await db.select().from(quote).where(eq(quote.quote_status, status as any)).orderBy(desc(quote.date_created));
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
      })
      .from(quote)
      .leftJoin(package_type, eq(quote.holiday_type_id, package_type.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .where(eq(quote.id, id))
      .limit(1);

    if (!q) return undefined;

    const [flights, accommodations, transfers, carHires, attractionTickets, loungePasses, airportParkings, cruises, passengerList, images] = await Promise.all([
      db.select({
        flight: quote_flights,
        departing_airport_name: sql<string>`concat(${departAirport.airport_name}, ' (', ${departAirport.airport_code}, ')')`,
        arrival_airport_name: sql<string>`concat(${arriveAirport.airport_name}, ' (', ${arriveAirport.airport_code}, ')')`,
        tour_operator_name: flightTourOp.name,
      })
        .from(quote_flights)
        .leftJoin(departAirport, eq(quote_flights.departing_airport_id, departAirport.id))
        .leftJoin(arriveAirport, eq(quote_flights.arrival_airport_id, arriveAirport.id))
        .leftJoin(flightTourOp, eq(quote_flights.tour_operator_id, flightTourOp.id))
        .where(eq(quote_flights.quote_id, id)),

      db.select({
        accommodation: quote_accomodation,
        accomodation_name: accomodation_list.name,
        board_basis_name: board_basis.type,
        tour_operator_name: accomTourOp.name,
      })
        .from(quote_accomodation)
        .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
        .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
        .leftJoin(accomTourOp, eq(quote_accomodation.tour_operator_id, accomTourOp.id))
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
      db.select().from(deal_images).where(eq(deal_images.owner_id, id)),
    ]);

    return {
      ...q.quote,
      holiday_type_name: q.holiday_type_name,
      main_tour_operator_name: q.main_tour_operator_name,
      flights: flights.map(f => ({ ...f.flight, departing_airport_name: f.departing_airport_name, arrival_airport_name: f.arrival_airport_name, tour_operator_name: f.tour_operator_name })),
      accommodations: accommodations.map(a => ({ ...a.accommodation, accomodation_name: a.accomodation_name, board_basis_name: a.board_basis_name, tour_operator_name: a.tour_operator_name })),
      transfers: transfers.map(t => ({ ...t.transfer, tour_operator_name: t.tour_operator_name })),
      carHires: carHires.map(c => ({ ...c.carHire, tour_operator_name: c.tour_operator_name })),
      attractionTickets: attractionTickets.map(t => ({ ...t.attractionTicket, tour_operator_name: t.tour_operator_name })),
      loungePasses: loungePasses.map(p => ({ ...p.loungePass, airport_name: p.airport_name, tour_operator_name: p.tour_operator_name })),
      airportParkings: airportParkings.map(p => ({ ...p.airportParking, airport_name: p.airport_name, tour_operator_name: p.tour_operator_name })),
      cruises: cruises.map(c => ({ ...c.cruise, tour_operator_name: c.tour_operator_name })),
      passengers: passengerList,
      images,
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

  async addTransfer(data: any) {
    const [result] = await db.insert(quote_transfers).values(data).returning();
    return result;
  },

  async removeTransfer(id: string): Promise<void> {
    await db.delete(quote_transfers).where(eq(quote_transfers.id, id));
  },

  async addCarHire(data: any) {
    const [result] = await db.insert(quote_car_hire).values(data).returning();
    return result;
  },

  async removeCarHire(id: string): Promise<void> {
    await db.delete(quote_car_hire).where(eq(quote_car_hire.id, id));
  },

  async addAttractionTicket(data: any) {
    const [result] = await db.insert(quote_attraction_ticket).values(data).returning();
    return result;
  },

  async removeAttractionTicket(id: string): Promise<void> {
    await db.delete(quote_attraction_ticket).where(eq(quote_attraction_ticket.id, id));
  },

  async addLoungePass(data: any) {
    const [result] = await db.insert(quote_lounge_pass).values(data).returning();
    return result;
  },

  async removeLoungePass(id: string): Promise<void> {
    await db.delete(quote_lounge_pass).where(eq(quote_lounge_pass.id, id));
  },

  async addAirportParking(data: any) {
    const [result] = await db.insert(quote_airport_parking).values(data).returning();
    return result;
  },

  async removeAirportParking(id: string): Promise<void> {
    await db.delete(quote_airport_parking).where(eq(quote_airport_parking.id, id));
  },

  async addPassenger(data: any) {
    const [result] = await db.insert(passengers).values(data).returning();
    return result;
  },

  async removePassenger(id: string): Promise<void> {
    await db.delete(passengers).where(eq(passengers.id, id));
  },

  async upsertFlightByType(quoteId: string, flightType: string, data: Partial<InsertQuoteFlight>): Promise<QuoteFlight> {
    const existing = await db.select().from(quote_flights)
      .where(eq(quote_flights.quote_id, quoteId))
      .then(rows => rows.find(r => r.flight_type === flightType));

    if (existing) {
      const [result] = await db.update(quote_flights).set(data).where(eq(quote_flights.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_flights).values({ ...data, quote_id: quoteId, flight_type: flightType }).returning();
      return result;
    }
  },

  async upsertPrimaryAccommodation(quoteId: string, data: Partial<InsertQuoteAccomodation>): Promise<QuoteAccomodation> {
    const existing = await db.select().from(quote_accomodation)
      .where(eq(quote_accomodation.quote_id, quoteId))
      .then(rows => rows.find(r => r.is_primary));

    if (existing) {
      const [result] = await db.update(quote_accomodation).set(data).where(eq(quote_accomodation.id, existing.id)).returning();
      return result;
    } else {
      const [result] = await db.insert(quote_accomodation).values({ ...data, quote_id: quoteId, is_primary: true }).returning();
      return result;
    }
  },

  async removeFlightsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_flights).where(eq(quote_flights.quote_id, quoteId));
  },

  async removeAccommodationsByQuote(quoteId: string): Promise<void> {
    await db.delete(quote_accomodation).where(eq(quote_accomodation.quote_id, quoteId));
  },
};
