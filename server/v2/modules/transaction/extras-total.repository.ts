import { db } from "../../config/database";
import { quote, booking } from "@shared/schema";
import { sql } from "drizzle-orm";
import { quoteExtrasTotalExpr, bookingExtrasTotalExpr } from "../../utils/commission-sql";

// Per-quote / per-booking total of the extras the customer pays for on top of
// the package (cost of every extra NOT marked "Included in package"). Uses the
// same SQL expressions as the pipeline totals (dealValueExpr), so card sums and
// server totals cannot drift. Attached to quote/booking rows as `extras_total`.
export async function fetchExtrasTotalMaps(
  quoteIds: string[],
  bookingIds: string[],
): Promise<{ quoteMap: Map<string, number>; bookingMap: Map<string, number> }> {
  const quoteMap = new Map<string, number>();
  const bookingMap = new Map<string, number>();
  const tasks: Promise<unknown>[] = [];

  if (quoteIds.length > 0) {
    const ids = sql.join(quoteIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT ${quote.id} AS id, ${quoteExtrasTotalExpr()} AS total
        FROM ${quote} WHERE ${quote.id} IN (${ids})
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; total: string | null }>) {
          quoteMap.set(r.id, parseFloat(r.total ?? "0") || 0);
        }
      }),
    );
  }

  if (bookingIds.length > 0) {
    const ids = sql.join(bookingIds.map((id) => sql`${id}`), sql`, `);
    tasks.push(
      db.execute(sql`
        SELECT ${booking.id} AS id, ${bookingExtrasTotalExpr()} AS total
        FROM ${booking} WHERE ${booking.id} IN (${ids})
      `).then((res) => {
        for (const r of res.rows as Array<{ id: string; total: string | null }>) {
          bookingMap.set(r.id, parseFloat(r.total ?? "0") || 0);
        }
      }),
    );
  }

  await Promise.all(tasks);
  return { quoteMap, bookingMap };
}
