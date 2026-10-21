import { db } from "../../config/database";
import { booking_upsell, tour_operator } from "@shared/schema";
import type { InsertBookingUpsell, BookingUpsell } from "@shared/schema";
import { eq, and, desc, getTableColumns, gte, lt, sql } from "drizzle-orm";

/** An upsell row plus the operator's display fields (null when it has none or the link was removed). */
export type BookingUpsellWithOperator = BookingUpsell & {
  tour_operator_name: string | null;
  tour_operator_logo_url: string | null;
};

/** All upsell columns unchanged, plus the operator name/logo for labelling. */
export const upsellWithOperatorColumns = {
  ...getTableColumns(booking_upsell),
  tour_operator_name: tour_operator.name,
  tour_operator_logo_url: tour_operator.logo_url,
};

export const bookingUpsellRepository = {
  /** Active upsells for a booking, newest first. */
  async findByBooking(bookingId: string): Promise<BookingUpsellWithOperator[]> {
    return db
      .select(upsellWithOperatorColumns)
      .from(booking_upsell)
      .leftJoin(tour_operator, eq(tour_operator.id, booking_upsell.tour_operator_id))
      .where(and(eq(booking_upsell.booking_id, bookingId), eq(booking_upsell.is_active, true)))
      .orderBy(desc(booking_upsell.added_at));
  },

  async findById(id: string): Promise<BookingUpsell | undefined> {
    const [row] = await db.select().from(booking_upsell).where(eq(booking_upsell.id, id)).limit(1);
    return row;
  },

  async create(data: InsertBookingUpsell): Promise<BookingUpsell> {
    const [row] = await db.insert(booking_upsell).values(data).returning();
    return row;
  },

  async update(id: string, data: Partial<InsertBookingUpsell>): Promise<BookingUpsell | undefined> {
    const [row] = await db
      .update(booking_upsell)
      .set({ ...data, updated_at: new Date() })
      .where(eq(booking_upsell.id, id))
      .returning();
    return row;
  },

  /** Soft delete — keeps the row for auditability/idempotency of reports. */
  async softDelete(id: string): Promise<BookingUpsell | undefined> {
    const [row] = await db
      .update(booking_upsell)
      .set({ is_active: false, updated_at: new Date() })
      .where(eq(booking_upsell.id, id))
      .returning();
    return row;
  },

  /**
   * Total active upsell commission recognised in the half-open range
   * [start, end) by `added_at`. Used by the Phase 4 reporting integration to
   * attribute upsells to the month they were added.
   */
  async sumCommissionByAddedRange(start: Date, end: Date): Promise<number> {
    const [row] = await db
      .select({
        total: sql<number>`COALESCE(SUM(CAST(${booking_upsell.commission} AS DECIMAL)), 0)`,
      })
      .from(booking_upsell)
      .where(
        and(
          eq(booking_upsell.is_active, true),
          gte(booking_upsell.added_at, start),
          lt(booking_upsell.added_at, end),
        ),
      );
    return Number(row?.total ?? 0);
  },
};
