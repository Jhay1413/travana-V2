import { db } from "../config/database";
import {
  enquiry_table, enquiry_destination, enquiry_resorts, enquiry_accomodation,
  enquiry_board_basis, enquiry_departure_airport, enquiry_departure_port,
  enquiry_cruise_line, enquiry_cruise_destination, enquiry_passenger,
} from "@shared/schema";
import type { EnquiryTable, InsertEnquiryTable } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

export const enquiryTableRepository = {
  async findById(id: string): Promise<EnquiryTable | undefined> {
    const [result] = await db.select().from(enquiry_table).where(eq(enquiry_table.id, id)).limit(1);
    return result;
  },

  async findByTransactionId(transactionId: string): Promise<EnquiryTable | undefined> {
    const [result] = await db.select().from(enquiry_table).where(eq(enquiry_table.transaction_id, transactionId)).limit(1);
    return result;
  },

  async findAll(): Promise<EnquiryTable[]> {
    return await db.select().from(enquiry_table).orderBy(desc(enquiry_table.date_created));
  },

  async create(data: InsertEnquiryTable): Promise<EnquiryTable> {
    const [result] = await db.insert(enquiry_table).values(data).returning();
    return result;
  },

  async update(id: string, data: Partial<InsertEnquiryTable>): Promise<EnquiryTable | undefined> {
    const [result] = await db.update(enquiry_table).set(data).where(eq(enquiry_table.id, id)).returning();
    return result;
  },

  async remove(id: string): Promise<void> {
    await db.delete(enquiry_table).where(eq(enquiry_table.id, id));
  },

  async findWithRelations(id: string) {
    const [enq] = await db.select().from(enquiry_table).where(eq(enquiry_table.id, id)).limit(1);
    if (!enq) return undefined;

    const [destinations, resorts, accommodations, boardBases, airports, ports, cruiseLines, cruiseDestinations, passengers] = await Promise.all([
      db.select().from(enquiry_destination).where(eq(enquiry_destination.enquiry_id, id)),
      db.select().from(enquiry_resorts).where(eq(enquiry_resorts.enquiry_id, id)),
      db.select().from(enquiry_accomodation).where(eq(enquiry_accomodation.enquiry_id, id)),
      db.select().from(enquiry_board_basis).where(eq(enquiry_board_basis.enquiry_id, id)),
      db.select().from(enquiry_departure_airport).where(eq(enquiry_departure_airport.enquiry_id, id)),
      db.select().from(enquiry_departure_port).where(eq(enquiry_departure_port.enquiry_id, id)),
      db.select().from(enquiry_cruise_line).where(eq(enquiry_cruise_line.enquiry_id, id)),
      db.select().from(enquiry_cruise_destination).where(eq(enquiry_cruise_destination.enquiry_id, id)),
      db.select().from(enquiry_passenger).where(eq(enquiry_passenger.enquiry_id, id)),
    ]);

    return {
      ...enq,
      destinations,
      resorts,
      accommodations,
      boardBases,
      airports,
      ports,
      cruiseLines,
      cruiseDestinations,
      passengers,
    };
  },

  async addDestination(enquiryId: string, destinationId: string) {
    await db.insert(enquiry_destination).values({ enquiry_id: enquiryId, destination_id: destinationId });
  },

  async addResort(enquiryId: string, resortsId: string) {
    await db.insert(enquiry_resorts).values({ enquiry_id: enquiryId, resorts_id: resortsId });
  },

  async addAccommodation(enquiryId: string, accommodationId: string) {
    await db.insert(enquiry_accomodation).values({ enquiry_id: enquiryId, accomodation_id: accommodationId });
  },

  async addBoardBasis(enquiryId: string, boardBasisId: string) {
    await db.insert(enquiry_board_basis).values({ enquiry_id: enquiryId, board_basis_id: boardBasisId });
  },

  async addDepartureAirport(enquiryId: string, airportId: string) {
    await db.insert(enquiry_departure_airport).values({ enquiry_id: enquiryId, airport_id: airportId });
  },

  async addPassenger(enquiryId: string, type: string, age: number) {
    const [result] = await db.insert(enquiry_passenger).values({ enquiry_id: enquiryId, type, age }).returning();
    return result;
  },

  async clearRelations(enquiryId: string) {
    await Promise.all([
      db.delete(enquiry_destination).where(eq(enquiry_destination.enquiry_id, enquiryId)),
      db.delete(enquiry_resorts).where(eq(enquiry_resorts.enquiry_id, enquiryId)),
      db.delete(enquiry_accomodation).where(eq(enquiry_accomodation.enquiry_id, enquiryId)),
      db.delete(enquiry_board_basis).where(eq(enquiry_board_basis.enquiry_id, enquiryId)),
      db.delete(enquiry_departure_airport).where(eq(enquiry_departure_airport.enquiry_id, enquiryId)),
      db.delete(enquiry_departure_port).where(eq(enquiry_departure_port.enquiry_id, enquiryId)),
      db.delete(enquiry_cruise_line).where(eq(enquiry_cruise_line.enquiry_id, enquiryId)),
      db.delete(enquiry_cruise_destination).where(eq(enquiry_cruise_destination.enquiry_id, enquiryId)),
      db.delete(enquiry_passenger).where(eq(enquiry_passenger.enquiry_id, enquiryId)),
    ]);
  },
};
