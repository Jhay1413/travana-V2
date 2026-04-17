import { db } from "../config/database";
import { clientTable } from "@shared/schema";
import { and, or, ilike, sql } from "drizzle-orm";

export type SearchResult = {
  clients: Array<{
    id: string;
    name: string;
    subtitle: string;
  }>;
  quotes: [];
  bookings: [];
};

export const searchRepository = {
  async globalSearch(searchTerm: string, clientLimit: number = 15): Promise<SearchResult> {
    const term = `%${searchTerm}%`;

    const words = searchTerm.trim().split(/\s+/).filter(Boolean);

    // For multi-word searches, require ALL words to appear somewhere in the full name.
    // This prevents "bell" matching "Michael Campbell" when searching "steven bell".
    const fullName = sql`concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename})`;
    const nameCondition = words.length > 1
      ? and(...words.map((w) => sql`${fullName} ILIKE ${"%" + w + "%"}`))
      : or(ilike(clientTable.firstName, term), ilike(clientTable.surename, term));

    const clients = await db
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
      .where(
        or(
          nameCondition,
          ilike(clientTable.email, term),
          ilike(clientTable.phoneNumber, term),
          ilike(clientTable.city, term),
        )
      )
      // Rank 1: exact name match, Rank 2: starts-with, Rank 3: contains, Rank 4: other
      .orderBy(
        sql`CASE
          WHEN lower(concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename})) = lower(${searchTerm})
            OR lower(${clientTable.firstName}) = lower(${searchTerm})
            OR lower(${clientTable.surename}) = lower(${searchTerm})
          THEN 1
          WHEN ${clientTable.firstName} ILIKE ${searchTerm + "%"} OR ${clientTable.surename} ILIKE ${searchTerm + "%"}
            OR concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ILIKE ${searchTerm + "%"}
          THEN 2
          WHEN ${clientTable.firstName} ILIKE ${term} OR ${clientTable.surename} ILIKE ${term}
            OR concat_ws(' ', ${clientTable.firstName}, ${clientTable.surename}) ILIKE ${term}
          THEN 3
          ELSE 4
        END`
      )
      .limit(clientLimit);

    return {
      clients: clients.map((c) => ({
        id: c.id,
        name: [c.title, c.firstName, c.surename]
          .filter((v) => v && v !== "NULL")
          .join(" ")
          .trim() || "Unknown",
        subtitle: [c.phoneNumber, c.email, c.city].filter(Boolean).join(" · "),
      })),
      quotes: [],
      bookings: [],
    };
  },
};
