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
    const [clientCount, quoteStats, revenueStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clients),
      db.select({
        total: sql<number>`count(*)`,
        inPlay: sql<number>`count(*) FILTER (WHERE ${quotes.status} = 'In Play')`,
        won: sql<number>`count(*) FILTER (WHERE ${quotes.status} = 'Won')`,
        lost: sql<number>`count(*) FILTER (WHERE ${quotes.status} = 'Lost')`,
      }).from(quotes),
      db.select({
        total: sql<number>`COALESCE(SUM(CAST(${commissions.netToAgency} AS DECIMAL)), 0)`,
        avg: sql<number>`COALESCE(AVG(CAST(${commissions.netToAgency} AS DECIMAL)), 0)`,
      }).from(commissions),
    ]);

    return {
      totalClients: Number(clientCount[0].count),
      totalQuotes: Number(quoteStats[0].total),
      totalRevenue: Number(revenueStats[0].total),
      avgDealSize: Number(revenueStats[0].avg),
      inPlayCount: Number(quoteStats[0].inPlay),
      wonCount: Number(quoteStats[0].won),
      lostCount: Number(quoteStats[0].lost),
    };
  },
};
