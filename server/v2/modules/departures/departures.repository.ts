import { asc, eq, sql } from "drizzle-orm";
import { AppError } from "../../utils/error-handler";
import { db } from "../../config/database";
import { booking, bookingDepartureChecks, clientTable, tour_operator, transaction, user } from "@shared/schema";
import { departureWhere, destinationExpr } from "./departures.sql";
import type { CheckStamp, DepartureChecks, DepartureFilter, DepartureRawRow, StoredChecks } from "./departures.types";

/** Postgres 42P01 (undefined_table), possibly wrapped by the driver. */
function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "42P01" || e?.cause?.code === "42P01";
}

/** Until the migration is applied the table is missing: say so instead of a bare 500. */
async function guardMigrated<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (err) {
    if (isMissingTable(err)) throw new AppError("Departures table not migrated yet", 500);
    throw err;
  }
}

/** Reads and the one write for the departures checklist. Every read starts from departureWhere (org first). */
export const departuresRepository = {
  /** Live bookings in the filter, soonest first then by client name. A booking with no checks row reads as nulls. */
  async listRows(f: DepartureFilter): Promise<DepartureRawRow[]> {
    return guardMigrated(() => db
      .select({
        bookingId: booking.id,
        transactionId: transaction.id,
        clientId: clientTable.id,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
        travelDate: booking.travel_date,
        nights: booking.num_of_nights,
        title: booking.title,
        destination: destinationExpr(),
        operatorName: tour_operator.name,
        operatorLogoUrl: tour_operator.logo_url,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
        checkIn: bookingDepartureChecks.checkIn,
        ticketsInHouse: bookingDepartureChecks.ticketsInHouse,
        passportInfo: bookingDepartureChecks.passportInfo,
        ticketsPickUp: bookingDepartureChecks.ticketsPickUp,
        completed: bookingDepartureChecks.completed,
        fullyPaid: bookingDepartureChecks.fullyPaid,
        lastChangeBy: bookingDepartureChecks.lastChangeBy,
        lastChangeByName: bookingDepartureChecks.lastChangeByName,
        lastChangeAt: bookingDepartureChecks.lastChangeAt,
        lastChangeWhat: bookingDepartureChecks.lastChangeWhat,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(tour_operator, eq(tour_operator.id, booking.main_tour_operator_id))
      .leftJoin(bookingDepartureChecks, eq(bookingDepartureChecks.bookingId, booking.id))
      .where(departureWhere(f))
      .orderBy(
        asc(booking.travel_date),
        asc(sql`lower(${clientTable.firstName} || ' ' || ${clientTable.surename})`),
        asc(booking.id),
      ));
  },

  /** One in-scope booking (no date bound), or null when it is outside the filter. */
  async findRow(f: DepartureFilter & { bookingId: string }): Promise<DepartureRawRow | null> {
    const rows = await departuresRepository.listRows(f);
    return rows[0] ?? null;
  },

  async findUserName(userId: string): Promise<string | null> {
    const [row] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId)).limit(1);
    return row?.name ?? null;
  },

  /**
   * Insert the checks row on the first tick, else update ONLY the keys in `patch` plus the stamp, so
   * two people ticking different boxes at once do not overwrite each other.
   */
  async upsertCheck(
    orgId: string,
    bookingId: string,
    patch: Partial<DepartureChecks>,
    stamp: CheckStamp,
  ): Promise<StoredChecks> {
    const stampCols = {
      lastChangeBy: stamp.by,
      lastChangeByName: stamp.byName,
      lastChangeAt: stamp.at,
      lastChangeWhat: stamp.what,
    };
    // Completing is decided in the same statement as the write: it only sticks while all four checks
    // are ticked, so a concurrent untick cannot be overwritten into an inconsistent row. A first
    // insert has the four at false, so it never starts completed.
    const completing = patch.completed === true;
    const insertPatch = completing ? { ...patch, completed: false } : patch;
    const updatePatch = completing
      ? { ...patch, completed: sql`${bookingDepartureChecks.checkIn} AND ${bookingDepartureChecks.ticketsInHouse} AND ${bookingDepartureChecks.passportInfo} AND ${bookingDepartureChecks.ticketsPickUp}` }
      : patch;
    const [row] = await guardMigrated(() => db
      .insert(bookingDepartureChecks)
      .values({ bookingId, orgId, ...insertPatch, ...stampCols })
      .onConflictDoUpdate({
        target: bookingDepartureChecks.bookingId,
        set: { ...updatePatch, ...stampCols, updatedAt: sql`now()` },
      })
      .returning({
        checkIn: bookingDepartureChecks.checkIn,
        ticketsInHouse: bookingDepartureChecks.ticketsInHouse,
        passportInfo: bookingDepartureChecks.passportInfo,
        ticketsPickUp: bookingDepartureChecks.ticketsPickUp,
        completed: bookingDepartureChecks.completed,
        fullyPaid: bookingDepartureChecks.fullyPaid,
        lastChangeBy: bookingDepartureChecks.lastChangeBy,
        lastChangeByName: bookingDepartureChecks.lastChangeByName,
        lastChangeAt: bookingDepartureChecks.lastChangeAt,
        lastChangeWhat: bookingDepartureChecks.lastChangeWhat,
      }));
    return row;
  },
};
