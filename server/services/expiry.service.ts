import { db } from "../config/database";
import { enquiry_table, quote, transaction } from "@shared/schema";
import { eq, and, sql, ne } from "drizzle-orm";

export async function expireStaleEnquiriesAndQuotes(): Promise<void> {
  const [expiredEnquiries, expiredQuotes] = await Promise.all([
    db
      .update(enquiry_table)
      .set({ is_expired: true })
      .where(
        and(
          eq(enquiry_table.is_expired, false),
          sql`${enquiry_table.date_created} < NOW() - INTERVAL '7 days'`,
          sql`${enquiry_table.transaction_id} IN (
            SELECT id FROM ${transaction} WHERE ${transaction.status} = 'on_enquiry'
          )`
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
          sql`${quote.date_created} < NOW() - INTERVAL '7 days'`,
          sql`${quote.transaction_id} NOT IN (
            SELECT id FROM ${transaction} WHERE ${transaction.status} = 'on_booking'
          )`
        )
      )
      .returning({ id: quote.id }),
  ]);

  const [activatedEnquiries, activatedQuotes] = await Promise.all([
    db
      .update(enquiry_table)
      .set({ is_future_deal: false, future_deal_date: null })
      .where(
        and(
          eq(enquiry_table.is_future_deal, true),
          sql`${enquiry_table.future_deal_date} <= CURRENT_DATE`,
          sql`${enquiry_table.transaction_id} IN (
            SELECT id FROM ${transaction} WHERE ${transaction.status} = 'on_enquiry'
          )`
        )
      )
      .returning({ id: enquiry_table.id }),

    db
      .update(quote)
      .set({ is_future_deal: false, future_deal_date: null })
      .where(
        and(
          eq(quote.is_future_deal, true),
          sql`${quote.future_deal_date} <= CURRENT_DATE`,
          sql`${quote.transaction_id} IN (
            SELECT id FROM ${transaction} WHERE ${transaction.status} IN ('on_enquiry', 'on_quote')
          )`
        )
      )
      .returning({ id: quote.id }),
  ]);

  console.log(
    `[Expiry] Marked ${expiredEnquiries.length} enquiries and ${expiredQuotes.length} quotes as expired.`
  );
  console.log(
    `[Expiry] Activated ${activatedEnquiries.length} enquiries and ${activatedQuotes.length} quotes from future deal.`
  );
}
