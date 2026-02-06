import { db } from "../config/database";
import { clients, quotes, commissions } from "@shared/schema";
import { sql, eq } from "drizzle-orm";

export const dashboardRepository = {
  async getStats(): Promise<{
    totalClients: number;
    totalQuotes: number;
    totalRevenue: number;
    avgDealSize: number;
    inPlayCount: number;
    wonCount: number;
    lostCount: number;
  }> {
    const [clientCount] = await db.select({ count: sql<number>`count(*)` }).from(clients);
    const [quoteCount] = await db.select({ count: sql<number>`count(*)` }).from(quotes);
    const [revenue] = await db.select({ total: sql<number>`COALESCE(SUM(CAST(${commissions.netToAgency} AS DECIMAL)), 0)` }).from(commissions);
    const [avgDeal] = await db.select({ avg: sql<number>`COALESCE(AVG(CAST(${commissions.netToAgency} AS DECIMAL)), 0)` }).from(commissions);
    const [inPlay] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "In Play"));
    const [won] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "Won"));
    const [lost] = await db.select({ count: sql<number>`count(*)` }).from(quotes).where(eq(quotes.status, "Lost"));

    return {
      totalClients: Number(clientCount.count),
      totalQuotes: Number(quoteCount.count),
      totalRevenue: Number(revenue.total),
      avgDealSize: Number(avgDeal.avg),
      inPlayCount: Number(inPlay.count),
      wonCount: Number(won.count),
      lostCount: Number(lost.count),
    };
  },
};
