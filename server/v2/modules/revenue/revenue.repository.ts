import { db } from "../../config/database";
import { booking, transaction, clientTable, user } from "@shared/schema";
import { sql, eq, and, gte, lte, isNotNull } from "drizzle-orm";

export const revenueRepository = {
  async getForwardsForMonth(year: number, month: number): Promise<{
    totalCommission: number;
    dealCount: number;
  }> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const travelDateStart = new Date(monthStart);
    travelDateStart.setDate(travelDateStart.getDate() + 56);

    const travelDateEnd = new Date(monthEnd);
    travelDateEnd.setDate(travelDateEnd.getDate() + 56);

    const result = await db
      .select({
        totalCommission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        dealCount: sql<number>`COUNT(*)`,
      })
      .from(booking)
      .where(
        and(
          gte(booking.travel_date, travelDateStart.toISOString().split('T')[0]),
          lte(booking.travel_date, travelDateEnd.toISOString().split('T')[0]),
          eq(booking.is_active, true),
          isNotNull(booking.package_commission)
        )
      );

    return {
      totalCommission: Number(result[0]?.totalCommission || 0),
      dealCount: Number(result[0]?.dealCount || 0),
    };
  },

  async getBookingsForMonth(year: number, month: number): Promise<Array<{
    bookingId: string;
    clientId: string;
    clientFirstName: string;
    clientSurename: string;
    travelDate: string;
    commission: number;
    agentId: string;
    agentFirstName: string;
    agentLastName: string;
    title: string | null;
  }>> {
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const travelDateStart = new Date(monthStart);
    travelDateStart.setDate(travelDateStart.getDate() + 56);

    const travelDateEnd = new Date(monthEnd);
    travelDateEnd.setDate(travelDateEnd.getDate() + 56);

    const bookings = await db
      .select({
        bookingId: booking.id,
        clientId: clientTable.id,
        clientFirstName: clientTable.firstName,
        clientSurename: clientTable.surename,
        travelDate: booking.travel_date,
        commission: booking.package_commission,
        agentId: user.id,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
        title: booking.title,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .innerJoin(user, eq(transaction.user_id, user.id))
      .where(
        and(
          gte(booking.travel_date, travelDateStart.toISOString().split('T')[0]),
          lte(booking.travel_date, travelDateEnd.toISOString().split('T')[0]),
          eq(booking.is_active, true),
          isNotNull(booking.package_commission)
        )
      )
      .orderBy(booking.travel_date);

    return bookings.map((b) => ({
      bookingId: b.bookingId,
      clientId: b.clientId,
      clientFirstName: b.clientFirstName || '',
      clientSurename: b.clientSurename || '',
      travelDate: b.travelDate,
      commission: Number(b.commission || 0),
      agentId: b.agentId,
      agentFirstName: b.agentFirstName,
      agentLastName: b.agentLastName,
      title: b.title,
    }));
  },

  async getAgentPerformance(): Promise<Array<{
    agentId: string;
    agentFirstName: string;
    agentLastName: string;
    totalCommission: number;
    dealCount: number;
  }>> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const results = await db
      .select({
        agentId: user.id,
        agentFirstName: user.firstName,
        agentLastName: user.lastName,
        totalCommission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        dealCount: sql<number>`COUNT(*)`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(user, eq(transaction.user_id, user.id))
      .where(
        and(
          eq(booking.is_active, true),
          isNotNull(booking.package_commission),
          gte(booking.travel_date, now.toISOString().split('T')[0]),
          lte(booking.travel_date, oneYearFromNow.toISOString().split('T')[0])
        )
      )
      .groupBy(user.id, user.firstName, user.lastName)
      .orderBy(sql`SUM(CAST(${booking.package_commission} AS DECIMAL)) DESC`);

    return results.map((r) => ({
      agentId: r.agentId,
      agentFirstName: r.agentFirstName,
      agentLastName: r.agentLastName,
      totalCommission: Number(r.totalCommission || 0),
      dealCount: Number(r.dealCount || 0),
    }));
  },

  async getTotalStats(): Promise<{
    totalCommission: number;
    totalDeals: number;
  }> {
    const now = new Date();
    const oneYearFromNow = new Date(now);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    const result = await db
      .select({
        totalCommission: sql<number>`COALESCE(SUM(CAST(${booking.package_commission} AS DECIMAL)), 0)`,
        totalDeals: sql<number>`COUNT(*)`,
      })
      .from(booking)
      .where(
        and(
          eq(booking.is_active, true),
          isNotNull(booking.package_commission),
          gte(booking.travel_date, now.toISOString().split('T')[0]),
          lte(booking.travel_date, oneYearFromNow.toISOString().split('T')[0])
        )
      );

    return {
      totalCommission: Number(result[0]?.totalCommission || 0),
      totalDeals: Number(result[0]?.totalDeals || 0),
    };
  },
};
