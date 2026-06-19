import { db } from '../../config/database';
import { clientTable } from '@shared/schema';
import { and, asc, eq, or, ilike, sql } from 'drizzle-orm';

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

    const matchCondition = or(
      nameCondition,
      ilike(clientTable.email, term),
      ilike(clientTable.phoneNumber, term),
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

    return {
      clients: pageRows.map((c) => ({
        id: c.id,
        name: [c.title, c.firstName, c.surename]
          .filter((v) => v && v !== 'NULL')
          .join(' ')
          .trim() || 'Unknown',
        subtitle: [c.phoneNumber, c.email, c.city].filter(Boolean).join(' · '),
      })),
      nextOffset: hasMore ? offset + limit : null,
    };
  },
};
