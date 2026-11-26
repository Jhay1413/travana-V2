// Intentionally outside the shop/homeworker partition: portal reads are client-facing and token-gated, not staff reads.
import { db } from '../../config/database';
import { board_basis, booking, booking_accomodation, transaction } from '@shared/schema';
import { and, eq } from 'drizzle-orm';

export interface PortalBookingFactsRow {
  boardName: string | null;
  adult: number | null;
  child: number | null;
  infant: number | null;
}

export const portalSummaryRepository = {
  /** Board basis and party size of one booking of THIS customer (null when it is not theirs or not live). */
  async findBookingFacts(clientId: string, bookingId: string): Promise<PortalBookingFactsRow | null> {
    const [row] = await db
      .select({
        boardName: board_basis.type,
        adult: booking.adult,
        child: booking.child,
        infant: booking.infant,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(booking_accomodation, and(eq(booking_accomodation.booking_id, booking.id), eq(booking_accomodation.is_primary, true)))
      .leftJoin(board_basis, eq(booking_accomodation.board_basis_id, board_basis.id))
      .where(and(eq(booking.id, bookingId), eq(transaction.client_id, clientId), eq(booking.is_active, true)))
      .limit(1);
    return row ?? null;
  },
};
