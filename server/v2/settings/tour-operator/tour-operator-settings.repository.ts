import { and, asc, eq, ilike, sql, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import { db } from '../../config/database';
import {
  booking,
  booking_accomodation,
  booking_airport_parking,
  booking_attraction_ticket,
  booking_car_hire,
  booking_cruise,
  booking_flights,
  booking_lounge_pass,
  booking_transfers,
  booking_upsell,
  org_tour_operator,
  quote,
  quote_accomodation,
  quote_airport_parking,
  quote_attraction_ticket,
  quote_car_hire,
  quote_cruise,
  quote_flights,
  quote_lounge_pass,
  quote_transfers,
  supplier_scraper,
  tour_operator,
  type InsertTourOperatorLookup,
  type TourOperatorLookup,
} from '@shared/schema';
import { escapeLike } from '../../utils/escape-like';

export interface CataloguePage {
  rows: TourOperatorLookup[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OperatorReferences {
  /** Agencies (org_tour_operator links) that use this operator. */
  links: number;
  /** Quotes, bookings, upsells and scrapers that point at it (all 20 FK columns). */
  records: number;
}

/** Every column that holds a tour_operator id (20 of them). */
export const REFERENCING: Array<[PgTable, PgColumn]> = [
  [quote, quote.main_tour_operator_id],
  [quote_flights, quote_flights.tour_operator_id],
  [quote_accomodation, quote_accomodation.tour_operator_id],
  [quote_transfers, quote_transfers.tour_operator_id],
  [quote_car_hire, quote_car_hire.tour_operator_id],
  [quote_attraction_ticket, quote_attraction_ticket.tour_operator_id],
  [quote_lounge_pass, quote_lounge_pass.tour_operator_id],
  [quote_airport_parking, quote_airport_parking.tour_operator_id],
  [quote_cruise, quote_cruise.tour_operator_id],
  [booking, booking.main_tour_operator_id],
  [booking_flights, booking_flights.tour_operator_id],
  [booking_accomodation, booking_accomodation.tour_operator_id],
  [booking_transfers, booking_transfers.tour_operator_id],
  [booking_car_hire, booking_car_hire.tour_operator_id],
  [booking_attraction_ticket, booking_attraction_ticket.tour_operator_id],
  [booking_lounge_pass, booking_lounge_pass.tour_operator_id],
  [booking_airport_parking, booking_airport_parking.tour_operator_id],
  [booking_cruise, booking_cruise.tour_operator_id],
  [booking_upsell, booking_upsell.tour_operator_id],
  [supplier_scraper, supplier_scraper.tour_operator_id],
];

/** The platform catalogue (identity only). Platform admins only; no tenant scoping applies. */
export const tourOperatorSettingsRepository = {
  async findAll(page: number, limit: number, search: string): Promise<CataloguePage> {
    const conds: SQL[] = [];
    if (search) conds.push(ilike(tour_operator.name, `%${escapeLike(search)}%`));
    const where = conds.length > 0 ? and(...conds) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(tour_operator).where(where);
    const rows = await db
      .select()
      .from(tour_operator)
      .where(where)
      .orderBy(asc(tour_operator.name))
      .limit(limit)
      .offset((page - 1) * limit);
    const total = Number(count);
    return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(id: string): Promise<TourOperatorLookup | null> {
    const [row] = await db.select().from(tour_operator).where(eq(tour_operator.id, id)).limit(1);
    return row ?? null;
  },

  /** Case-insensitive, trimmed exact name match (mirrors the unique index). */
  async findByLowerName(name: string): Promise<TourOperatorLookup | null> {
    const [row] = await db
      .select()
      .from(tour_operator)
      .where(sql`lower(${tour_operator.name}) = ${name.trim().toLowerCase()}`)
      .limit(1);
    return row ?? null;
  },

  /** Returns null when the name already exists (unique index race). */
  async create(values: InsertTourOperatorLookup): Promise<TourOperatorLookup | null> {
    const [row] = await db.insert(tour_operator).values(values).onConflictDoNothing().returning();
    return row ?? null;
  },

  async update(id: string, values: Partial<InsertTourOperatorLookup>): Promise<TourOperatorLookup | null> {
    const [row] = await db
      .update(tour_operator)
      .set({ ...values, updated_at: new Date() })
      .where(eq(tour_operator.id, id))
      .returning();
    return row ?? null;
  },

  async remove(id: string): Promise<void> {
    await db.delete(tour_operator).where(eq(tour_operator.id, id));
  },

  /** How many agencies and records use this operator; a delete would cascade/null all of them. */
  async countReferences(id: string): Promise<OperatorReferences> {
    const parts = REFERENCING.map(([table, column]) => sql`(select count(*) from ${table} where ${column} = ${id})`);
    const [row] = await db
      .select({
        links: sql<number>`(select count(*) from ${org_tour_operator} where ${org_tour_operator.tour_operator_id} = ${id})`,
        records: sql<number>`${sql.join(parts, sql` + `)}`,
      })
      .from(tour_operator)
      .where(eq(tour_operator.id, id))
      .limit(1);
    return { links: Number(row?.links ?? 0), records: Number(row?.records ?? 0) };
  },
};
