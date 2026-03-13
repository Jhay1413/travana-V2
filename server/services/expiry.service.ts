import { db } from "../config/database";
import { enquiry_table, quote } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export async function expireStaleEnquiriesAndQuotes(): Promise<void> {
  const sevenDaysAgo = sql`NOW() - INTERVAL '7 days'`;

  const [expiredEnquiries, expiredQuotes] = await Promise.all([
    db
      .update(enquiry_table)
      .set({ is_expired: true })
      .where(
        and(
          eq(enquiry_table.is_expired, false),
          sql`${enquiry_table.date_created} < ${sevenDaysAgo}`
        )
      )
      .returning({ id: enquiry_table.id }),

    db
      .update(quote)
      .set({ is_expired: true })
      .where(
        and(
          eq(quote.is_expired, false),
          eq(quote.isFreeQuote, false),
          sql`${quote.date_created} < ${sevenDaysAgo}`
        )
      )
      .returning({ id: quote.id }),
  ]);

  console.log(
    `[Expiry] Marked ${expiredEnquiries.length} enquiries and ${expiredQuotes.length} quotes as expired.`
  );
}
