import { db } from '../../config/database';
import { clientTable, booking, transaction } from '@shared/schema';
import { and, asc, eq, or, ilike, sql } from 'drizzle-orm';
import { phoneDigitsCondition } from '../../utils/phone-search';

interface SearchOpts {
  orgId: string | null;
  limit?: number;
  offset?: number;
}

export const searchRepository = {
  async globalSearch(searchTerm: string, opts: SearchOpts) {
    const { orgId, limit = 15, offset = 0 } = opts;
    const term = `%${searchTerm}%`;
    const words = searchTerm.trim().split(/\s+/).filter(Boolean);
    const fullName = sql`concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename})`;
    const nameCondition =
      words.length > 1
        ? and(...words.map((w) => sql`${fullName} ILIKE ${'%' + w + '%'}`))
        : or(ilike(clientTable.firstName, term), ilike(clientTable.surename, term));

    const phoneDigits = phoneDigitsCondition(clientTable.phoneNumber, searchTerm);
    const matchCondition = or(
      nameCondition,
      ilike(clientTable.email, term),
      ilike(clientTable.phoneNumber, term),
      ...(phoneDigits ? [phoneDigits] : []),
      ilike(clientTable.city, term),
    );

    // Exclude merged (soft-archived) duplicates from search results.
    const activeOnly = eq(clientTable.status, "active");
    const whereClause = orgId
      ? and(matchCondition, eq(clientTable.orgId, orgId), activeOnly)
      : and(matchCondition, activeOnly);

    const rows = await db
      .select({
        id: clientTable.id,
        title: clientTable.title,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
        phoneNumber: clientTable.phoneNumber,
        email: clientTable.email,
        city: clientTable.city,
      })
      .from(clientTable)
      .where(whereClause)
      .orderBy(
        sql`CASE
          WHEN lower(concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename})) = lower(${searchTerm})
            OR lower(${clientTable.firstName}) = lower(${searchTerm})
            OR lower(${clientTable.surename}) = lower(${searchTerm})
          THEN 1
          WHEN ${clientTable.firstName} ILIKE ${searchTerm + '%'} OR ${clientTable.surename} ILIKE ${searchTerm + '%'}
            OR concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ILIKE ${searchTerm + '%'}
          THEN 2
          WHEN ${clientTable.firstName} ILIKE ${term} OR ${clientTable.surename} ILIKE ${term}
            OR concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ILIKE ${term}
          THEN 3
          ELSE 4
        END`,
        asc(clientTable.id),
      )
      .limit(limit + 1)
      .offset(offset);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;

    // Bookings are only matched on the first page; client results drive the
    // infinite-scroll pagination via nextOffset.
    const bookings = offset === 0 ? await this.searchBookings(searchTerm, { orgId, limit }) : [];

    return {
      clients: pageRows.map((c) => ({
        id: c.id,
        name: [c.title, c.firstName, c.surename]
          .filter((v) => v && v !== 'NULL')
          .join(' ')
          .trim() || 'Unknown',
        subtitle: [c.phoneNumber, c.email, c.city].filter(Boolean).join(' · '),
      })),
      bookings,
      nextOffset: hasMore ? offset + limit : null,
    };
  },

  async searchBookings(searchTerm: string, opts: { orgId: string | null; limit?: number }) {
    const { orgId, limit = 15 } = opts;
    const term = `%${searchTerm}%`;

    const matchCondition = or(
      ilike(booking.hays_ref, term),
      ilike(booking.supplier_ref, term),
    );
    const activeOnly = eq(booking.is_active, true);
    const whereClause = orgId
      ? and(matchCondition, eq(transaction.org_id, orgId), activeOnly)
      : and(matchCondition, activeOnly);

    const rows = await db
      .select({
        id: booking.id,
        haysRef: booking.hays_ref,
        title: booking.title,
        travelDate: booking.travel_date,
        clientId: transaction.client_id,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(whereClause)
      .orderBy(
        sql`CASE WHEN ${booking.hays_ref} ILIKE ${searchTerm + '%'} THEN 1 ELSE 2 END`,
        asc(booking.hays_ref),
      )
      .limit(limit);

    return rows.map((b) => {
      const clientName = [b.firstName, b.surename]
        .filter((v) => v && v !== 'NULL')
        .join(' ')
        .trim();
      return {
        id: b.id,
        clientId: b.clientId,
        name: b.haysRef ? `Hays Ref: ${b.haysRef}` : (b.title || 'Booking'),
        subtitle: [clientName, b.title].filter(Boolean).join(' · '),
      };
    });
  },
};
