import { isNotNull, sql, type SQL } from "drizzle-orm";
import { quote, transaction } from "@shared/schema";

/**
 * WHERE-clause fragments to exclude rows that should NOT count toward
 * aggregate quote stats (commission totals, funnel counts, leaderboards, etc.):
 *
 * - free quotes (`quote.isFreeQuote = true`) — quick-comparison rows, not real deals
 * - quotes whose transaction has no client (`transaction.client_id IS NULL`) —
 *   anonymous demos / scratch entries
 *
 * NULL `isFreeQuote` values are treated as not-free for backwards compatibility
 * with rows created before the column was added.
 *
 * Every caller must already `innerJoin(transaction, eq(quote.transaction_id, transaction.id))`.
 */
export function quoteStatsConds(): SQL[] {
  return [
    sql`(${quote.isFreeQuote} IS NULL OR ${quote.isFreeQuote} = false)`,
    isNotNull(transaction.client_id),
  ];
}
