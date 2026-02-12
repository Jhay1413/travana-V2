import { db } from "../config/database";
import {
  enquiry_table, enquiry_destination, enquiry_resorts, enquiry_accomodation,
  enquiry_board_basis, enquiry_departure_airport, enquiry_departure_port,
  enquiry_cruise_line, enquiry_cruise_destination, enquiry_passenger,
  package_type, destination, resorts, accomodation_list, board_basis, airport,
  port, cruise_line, cruise_destination,
} from "@shared/schema";
import type { EnquiryTable, InsertEnquiryTable } from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";

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
    const [enq] = await db
      .select({
        enquiry: enquiry_table,
        holiday_type_name: package_type.name,
      })
      .from(enquiry_table)
      .leftJoin(package_type, eq(enquiry_table.holiday_type_id, package_type.id))
      .where(eq(enquiry_table.id, id))
      .limit(1);

    if (!enq) return undefined;

    const [destinations, resortList, accommodations, boardBases, airports, ports, cruiseLines, cruiseDestinations, passengerList] = await Promise.all([
      db.select({
        enquiry_id: enquiry_destination.enquiry_id,
        destination_id: enquiry_destination.destination_id,
        destination_name: destination.name,
      })
        .from(enquiry_destination)
        .leftJoin(destination, eq(enquiry_destination.destination_id, destination.id))
        .where(eq(enquiry_destination.enquiry_id, id)),

      db.select({
        enquiry_id: enquiry_resorts.enquiry_id,
        resorts_id: enquiry_resorts.resorts_id,
        resort_name: resorts.name,
      })
        .from(enquiry_resorts)
        .leftJoin(resorts, eq(enquiry_resorts.resorts_id, resorts.id))
        .where(eq(enquiry_resorts.enquiry_id, id)),

      db.select({
        enquiry_id: enquiry_accomodation.enquiry_id,
        accomodation_id: enquiry_accomodation.accomodation_id,
        accomodation_name: accomodation_list.name,
      })
        .from(enquiry_accomodation)
        .leftJoin(accomodation_list, eq(enquiry_accomodation.accomodation_id, accomodation_list.id))
        .where(eq(enquiry_accomodation.enquiry_id, id)),

      db.select({
        enquiry_id: enquiry_board_basis.enquiry_id,
        board_basis_id: enquiry_board_basis.board_basis_id,
        board_basis_name: board_basis.type,
      })
        .from(enquiry_board_basis)
        .leftJoin(board_basis, eq(enquiry_board_basis.board_basis_id, board_basis.id))
        .where(eq(enquiry_board_basis.enquiry_id, id)),

      db.select({
        enquiry_id: enquiry_departure_airport.enquiry_id,
        airport_id: enquiry_departure_airport.airport_id,
        airport_name: sql<string>`concat(${airport.airport_name}, ' (', ${airport.airport_code}, ')')`,
      })
        .from(enquiry_departure_airport)
        .leftJoin(airport, eq(enquiry_departure_airport.airport_id, airport.id))
        .where(eq(enquiry_departure_airport.enquiry_id, id)),

      db.select({
        enquiry_id: enquiry_departure_port.enquiry_id,
        port_id: enquiry_departure_port.port_id,
        port_name: port.name,
      })
        .from(enquiry_departure_port)
        .leftJoin(port, eq(enquiry_departure_port.port_id, port.id))
        .where(eq(enquiry_departure_port.enquiry_id, id)),
      db.select({
        enquiry_id: enquiry_cruise_line.enquiry_id,
        cruise_line_id: enquiry_cruise_line.cruise_line_id,
        cruise_line_name: cruise_line.name,
      })
        .from(enquiry_cruise_line)
        .leftJoin(cruise_line, eq(enquiry_cruise_line.cruise_line_id, cruise_line.id))
        .where(eq(enquiry_cruise_line.enquiry_id, id)),
      db.select({
        enquiry_id: enquiry_cruise_destination.enquiry_id,
        cruise_destination_id: enquiry_cruise_destination.cruise_destination_id,
        cruise_destination_name: cruise_destination.name,
      })
        .from(enquiry_cruise_destination)
        .leftJoin(cruise_destination, eq(enquiry_cruise_destination.cruise_destination_id, cruise_destination.id))
        .where(eq(enquiry_cruise_destination.enquiry_id, id)),
      db.select().from(enquiry_passenger).where(eq(enquiry_passenger.enquiry_id, id)),
    ]);

    return {
      ...enq.enquiry,
      holiday_type_name: enq.holiday_type_name,
      destinations,
      resorts: resortList,
      accommodations,
      boardBases,
      airports,
      ports,
      cruiseLines,
      cruiseDestinations,
      passengers: passengerList,
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
