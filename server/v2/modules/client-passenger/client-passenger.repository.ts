import { and, asc, eq, gte, isNull, or, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { booking, clientPassenger, transaction, type ClientPassengerRow } from '@shared/schema';
import type { LeadPassportFields, PassengerFields } from './client-passenger.types';
import { clientPassengerLegacy as legacy, fromLegacyRow, stripNewColumns, withLegacyFallback } from './client-passenger-legacy.schema';

// Every read and write tries the real table first and, only while the passport columns are not in the database yet
// (Postgres 42703), repeats on the legacy column set without them. See client-passenger-legacy.schema.ts.
export const clientPassengerRepository = {
  /** All saved rows for a client, lead (if any) first, then oldest-created first. */
  async findByClient(clientId: string): Promise<ClientPassengerRow[]> {
    return withLegacyFallback(
      () =>
        db
          .select()
          .from(clientPassenger)
          .where(eq(clientPassenger.clientId, clientId))
          .orderBy(sql`${clientPassenger.isLead} DESC`, asc(clientPassenger.createdAt), asc(clientPassenger.id)),
      async () =>
        (
          await db
            .select()
            .from(legacy)
            .where(eq(legacy.clientId, clientId))
            .orderBy(sql`${legacy.isLead} DESC`, asc(legacy.createdAt), asc(legacy.id))
        ).map(fromLegacyRow),
    );
  },

  async findLead(clientId: string): Promise<ClientPassengerRow | null> {
    return withLegacyFallback(
      async () => {
        const [row] = await db
          .select()
          .from(clientPassenger)
          .where(and(eq(clientPassenger.clientId, clientId), eq(clientPassenger.isLead, true)))
          .limit(1);
        return row ?? null;
      },
      async () => {
        const [row] = await db.select().from(legacy).where(and(eq(legacy.clientId, clientId), eq(legacy.isLead, true))).limit(1);
        return row ? fromLegacyRow(row) : null;
      },
    );
  },

  /** A passenger row only if it belongs to this client. */
  async findOne(clientId: string, passengerId: string): Promise<ClientPassengerRow | null> {
    return withLegacyFallback(
      async () => {
        const [row] = await db
          .select()
          .from(clientPassenger)
          .where(and(eq(clientPassenger.id, passengerId), eq(clientPassenger.clientId, clientId)))
          .limit(1);
        return row ?? null;
      },
      async () => {
        const [row] = await db.select().from(legacy).where(and(eq(legacy.id, passengerId), eq(legacy.clientId, clientId))).limit(1);
        return row ? fromLegacyRow(row) : null;
      },
    );
  },

  async create(clientId: string, fields: PassengerFields): Promise<ClientPassengerRow> {
    return withLegacyFallback(
      async () => {
        const [row] = await db.insert(clientPassenger).values({ clientId, isLead: false, ...fields }).returning();
        return row!;
      },
      async () => {
        const [row] = await db.insert(legacy).values({ clientId, isLead: false, ...stripNewColumns(fields) }).returning();
        return fromLegacyRow(row!);
      },
    );
  },

  async update(clientId: string, passengerId: string, fields: Partial<PassengerFields>): Promise<ClientPassengerRow | null> {
    return withLegacyFallback(
      async () => {
        const [row] = await db
          .update(clientPassenger)
          .set({ ...fields, updatedAt: new Date() })
          .where(and(eq(clientPassenger.id, passengerId), eq(clientPassenger.clientId, clientId), eq(clientPassenger.isLead, false)))
          .returning();
        return row ?? null;
      },
      async () => {
        const [row] = await db
          .update(legacy)
          .set({ ...stripNewColumns(fields), updatedAt: new Date() })
          .where(and(eq(legacy.id, passengerId), eq(legacy.clientId, clientId), eq(legacy.isLead, false)))
          .returning();
        return row ? fromLegacyRow(row) : null;
      },
    );
  },

  async remove(clientId: string, passengerId: string): Promise<boolean> {
    const rows = await db
      .delete(clientPassenger)
      .where(and(eq(clientPassenger.id, passengerId), eq(clientPassenger.clientId, clientId), eq(clientPassenger.isLead, false)))
      .returning({ id: clientPassenger.id });
    return rows.length > 0;
  },

  /** Insert or update the single lead row (a partial unique index guarantees at most one per client). */
  async upsertLead(clientId: string, fields: LeadPassportFields): Promise<ClientPassengerRow> {
    return withLegacyFallback(
      async () => {
        const [row] = await db
          .insert(clientPassenger)
          .values({ clientId, isLead: true, ...fields })
          .onConflictDoUpdate({
            target: clientPassenger.clientId,
            targetWhere: sql`${clientPassenger.isLead} = true`,
            set: { ...fields, updatedAt: new Date() },
          })
          .returning();
        return row!;
      },
      async () => {
        const legacyFields = stripNewColumns(fields);
        const [row] = await db
          .insert(legacy)
          .values({ clientId, isLead: true, ...legacyFields })
          .onConflictDoUpdate({
            target: legacy.clientId,
            targetWhere: sql`${legacy.isLead} = true`,
            set: { ...legacyFields, updatedAt: new Date() },
          })
          .returning();
        return fromLegacyRow(row!);
      },
    );
  },

  /**
   * Earliest travel date >= fromYmd on this client's live bookings, or null. "Cancelled" = the booking
   * is LOST (booking_status) or soft-deleted (is_active = false), or its transaction is inactive/test.
   */
  async findNextDepartureDate(clientId: string, fromYmd: string): Promise<string | null> {
    const [row] = await db
      .select({ travelDate: sql<string | null>`MIN(${booking.travel_date})` })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(
        and(
          eq(transaction.client_id, clientId),
          eq(transaction.is_test, false),
          eq(transaction.is_active, true),
          or(isNull(booking.is_active), eq(booking.is_active, true)),
          or(isNull(booking.booking_status), sql`${booking.booking_status} <> 'LOST'`),
          gte(booking.travel_date, fromYmd),
        ),
      );
    return row?.travelDate ?? null;
  },
};
