import { db } from '../../config/database';
import {
  airport,
  enquiry_departure_airport,
  enquiry_table,
  quote,
  quote_flights,
  transaction,
  type InsertAirport,
} from '@shared/schema';
import { eq, inArray, sql } from 'drizzle-orm';

export interface DepartureUsageRow {
  airportId: string;
  code: string | null;
  uses: number;
}

export const airportRepository = {
  async findAll(opts?: { countryIds?: string[] }) {
    const query = db.select().from(airport);
    if (opts?.countryIds?.length) {
      return query.where(inArray(airport.country_id, opts.countryIds)).orderBy(airport.airport_name);
    }
    return query.orderBy(airport.airport_name);
  },

  // How often each airport is a DEPARTURE airport on this organisation's
  // enquiries. Org scope comes from transaction.org_id; other orgs never count.
  async countEnquiryDepartures(orgId: string): Promise<DepartureUsageRow[]> {
    return db
      .select({
        airportId: airport.id,
        code: airport.airport_code,
        uses: sql<number>`count(*)`.mapWith(Number),
      })
      .from(enquiry_departure_airport)
      .innerJoin(airport, eq(airport.id, enquiry_departure_airport.airport_id))
      .innerJoin(enquiry_table, eq(enquiry_table.id, enquiry_departure_airport.enquiry_id))
      .innerJoin(transaction, eq(transaction.id, enquiry_table.transaction_id))
      .where(eq(transaction.org_id, orgId))
      .groupBy(airport.id, airport.airport_code);
  },

  // Same, for the departing airport of flights on this organisation's quotes.
  async countQuoteDepartures(orgId: string): Promise<DepartureUsageRow[]> {
    return db
      .select({
        airportId: airport.id,
        code: airport.airport_code,
        uses: sql<number>`count(*)`.mapWith(Number),
      })
      .from(quote_flights)
      .innerJoin(airport, eq(airport.id, quote_flights.departing_airport_id))
      .innerJoin(quote, eq(quote.id, quote_flights.quote_id))
      .innerJoin(transaction, eq(transaction.id, quote.transaction_id))
      .where(eq(transaction.org_id, orgId))
      .groupBy(airport.id, airport.airport_code);
  },

  async findById(id: string) {
    const [row] = await db.select().from(airport).where(eq(airport.id, id)).limit(1);
    return row || null;
  },

  async create(data: InsertAirport) {
    const [row] = await db.insert(airport).values(data).returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(airport).where(eq(airport.id, id));
  },
};
