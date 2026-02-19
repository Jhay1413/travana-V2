import { db } from "../config/database";
import { clientTable, transaction, quote, booking, enquiry_table, enquiry_destination, destination, quote_flights, airport } from "@shared/schema";
import { sql, eq, and, gte, lte, desc, isNotNull } from "drizzle-orm";
import type {
  ClientDashboardKPIs,
  RebookingClient,
  RebookingDashboard,
  VIPClient,
  VIPDashboard,
  BehaviourDashboard,
  ClientListItem,
  ClientListResponse,
} from "../types/dashboard";

export const dashboardRepository = {
  async getStats(): Promise<{
    totalClients: number;
    totalQuotes: number;
    totalRevenue: number;
    avgDealSize: number;
    totalTransactions: number;
    enquiryCount: number;
    quotedCount: number;
    bookedCount: number;
  }> {
    const [clientCount, transactionStats, quoteStats, revenueStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientTable),
      db.select({
        total: sql<number>`count(*)`,
        enquiry: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_enquiry')`,
        quoted: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_quote')`,
        booked: sql<number>`count(*) FILTER (WHERE ${transaction.status} = 'on_booking')`,
      }).from(transaction),
      db.select({
        total: sql<number>`count(*)`,
      }).from(quote),
      db.select({
        total: sql<number>`COALESCE(SUM(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
        avg: sql<number>`COALESCE(AVG(CAST(${quote.sales_price} AS DECIMAL)), 0)`,
      }).from(quote),
    ]);

    return {
      totalClients: Number(clientCount[0].count),
      totalQuotes: Number(quoteStats[0].total),
      totalRevenue: Number(revenueStats[0].total),
      avgDealSize: Number(revenueStats[0].avg),
      totalTransactions: Number(transactionStats[0].total),
      enquiryCount: Number(transactionStats[0].enquiry),
      quotedCount: Number(transactionStats[0].quoted),
      bookedCount: Number(transactionStats[0].booked),
    };
  },

  async getClientKPIs(): Promise<ClientDashboardKPIs> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalClients, newThisMonth, bookingStats, repeatStats, leadTimeStats, closeRateStats] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(clientTable),

      db.select({ count: sql<number>`count(*)` })
        .from(clientTable)
        .where(gte(clientTable.createdAt, startOfMonth)),

      db.select({
        avgValue: sql<number>`COALESCE(AVG(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
        totalRevenue: sql<number>`COALESCE(SUM(CAST(${booking.sales_price} AS DECIMAL)), 0)`,
        totalBookings: sql<number>`count(*)`,
      }).from(booking).where(eq(booking.is_active, true)),

      db.execute(sql`
        SELECT 
          COUNT(DISTINCT sub.client_id) as repeat_count,
          (SELECT COUNT(*) FROM client_table) as total_count
        FROM (
          SELECT t.client_id, COUNT(b.id) as booking_count
          FROM transaction t
          JOIN booking_table b ON b.transaction_id = t.id AND b.is_active = true
          WHERE t.client_id IS NOT NULL
          GROUP BY t.client_id
          HAVING COUNT(b.id) > 1
        ) sub
      `),

      db.execute(sql`
        SELECT COALESCE(AVG(lead_days), 0) as avg_lead_days
        FROM (
          SELECT EXTRACT(DAY FROM (b.travel_date::timestamp - b.date_created)) as lead_days
          FROM booking_table b
          WHERE b.is_active = true
            AND b.travel_date IS NOT NULL
            AND b.date_created IS NOT NULL
            AND b.travel_date::timestamp > b.date_created
        ) sub
        WHERE lead_days > 0 AND lead_days < 730
      `),

      db.execute(sql`
        SELECT 
          COUNT(*) FILTER (WHERE t.status = 'on_booking') as booked,
          COUNT(*) as total
        FROM transaction t
        WHERE t.is_active = true
      `),
    ]);

    const total = Number(totalClients[0].count) || 1;
    const repeatRow = (repeatStats as any).rows?.[0] || (repeatStats as any)[0] || {};
    const repeatCount = Number(repeatRow.repeat_count || 0);
    const totalForRepeat = Number(repeatRow.total_count || total);

    const leadRow = (leadTimeStats as any).rows?.[0] || (leadTimeStats as any)[0] || {};
    const closeRow = (closeRateStats as any).rows?.[0] || (closeRateStats as any)[0] || {};

    const bookedCount = Number(closeRow.booked || 0);
    const totalTxns = Number(closeRow.total || 1);

    const totalBookingsCount = Number(bookingStats[0].totalBookings) || 1;
    const totalRevenue = Number(bookingStats[0].totalRevenue);

    const clientsWithBookings = await db.execute(sql`
      SELECT COUNT(DISTINCT t.client_id) as count
      FROM transaction t
      JOIN booking_table b ON b.transaction_id = t.id AND b.is_active = true
      WHERE t.client_id IS NOT NULL
    `);
    const uniqueBookedClients = Number((clientsWithBookings as any).rows?.[0]?.count || (clientsWithBookings as any)[0]?.count || 1);

    return {
      totalActiveClients: Number(totalClients[0].count),
      newClientsThisMonth: Number(newThisMonth[0].count),
      repeatClientsPercent: totalForRepeat > 0 ? Math.round((repeatCount / totalForRepeat) * 100) : 0,
      avgBookingValue: Math.round(Number(bookingStats[0].avgValue)),
      avgLifetimeValue: uniqueBookedClients > 0 ? Math.round(totalRevenue / uniqueBookedClients) : 0,
      avgLeadTimeDays: Math.round(Number(leadRow.avg_lead_days || 0)),
      closeRatePercent: totalTxns > 0 ? Math.round((bookedCount / totalTxns) * 100) : 0,
    };
  },

  async getRebookingDashboard(): Promise<RebookingDashboard> {
    const result = await db.execute(sql`
      WITH client_booking_stats AS (
        SELECT 
          t.client_id,
          CONCAT(ct."firstName", ' ', ct.surename) as client_name,
          COUNT(b.id) as total_bookings,
          MAX(b.date_created) as last_booking_date,
          MAX(b.travel_date) as last_travel_date,
          COALESCE(SUM(CAST(b.sales_price AS DECIMAL)), 0) as lifetime_value,
          CASE 
            WHEN COUNT(b.id) > 1 THEN
              EXTRACT(DAY FROM (MAX(b.date_created) - MIN(b.date_created))) / NULLIF(COUNT(b.id) - 1, 0)
            ELSE NULL
          END as avg_cycle_days,
          EXTRACT(DAY FROM (NOW() - MAX(b.date_created))) as days_since_last
        FROM transaction t
        JOIN client_table ct ON ct.id = t.client_id
        JOIN booking_table b ON b.transaction_id = t.id AND b.is_active = true
        WHERE t.client_id IS NOT NULL
        GROUP BY t.client_id, ct."firstName", ct.surename
        HAVING COUNT(b.id) >= 1
      )
      SELECT *,
        CASE
          WHEN total_bookings >= 2 AND days_since_last <= COALESCE(avg_cycle_days, 365) * 1.2 THEN 'hot'
          WHEN total_bookings >= 1 AND days_since_last <= COALESCE(avg_cycle_days, 365) * 1.8 THEN 'warm'
          ELSE 'cold'
        END as segment
      FROM client_booking_stats
      ORDER BY lifetime_value DESC
      LIMIT 100
    `);

    const rows: any[] = (result as any).rows || result as any[];
    const hot: RebookingClient[] = [];
    const warm: RebookingClient[] = [];
    const cold: RebookingClient[] = [];

    for (const row of rows) {
      const client: RebookingClient = {
        clientId: row.client_id,
        clientName: row.client_name || "Unknown",
        lastBookingDate: row.last_booking_date ? new Date(row.last_booking_date).toISOString() : null,
        lastTravelDate: row.last_travel_date ? String(row.last_travel_date) : null,
        totalBookings: Number(row.total_bookings),
        lifetimeValue: Number(row.lifetime_value),
        avgBookingCycleDays: row.avg_cycle_days ? Math.round(Number(row.avg_cycle_days)) : null,
        daysSinceLastBooking: row.days_since_last ? Math.round(Number(row.days_since_last)) : null,
        segment: row.segment as "hot" | "warm" | "cold",
      };
      if (client.segment === "hot") hot.push(client);
      else if (client.segment === "warm") warm.push(client);
      else cold.push(client);
    }

    return { hot, warm, cold };
  },

  async getVIPDashboard(): Promise<VIPDashboard> {
    const result = await db.execute(sql`
      WITH client_stats AS (
        SELECT 
          ct.id as client_id,
          CONCAT(ct."firstName", ' ', ct.surename) as client_name,
          COALESCE(SUM(CAST(b.sales_price AS DECIMAL)), 0) as lifetime_value,
          COUNT(b.id) as total_bookings,
          COALESCE(AVG(CAST(b.sales_price AS DECIMAL)), 0) as avg_booking_value
        FROM client_table ct
        LEFT JOIN transaction t ON t.client_id = ct.id
        LEFT JOIN booking_table b ON b.transaction_id = t.id AND b.is_active = true
        GROUP BY ct.id, ct."firstName", ct.surename
      ),
      referral_counts AS (
        SELECT "referrerId" as client_id, COUNT(*) as referral_count
        FROM client_table
        WHERE "referrerId" IS NOT NULL
        GROUP BY "referrerId"
      )
      SELECT 
        cs.*,
        COALESCE(rc.referral_count, 0) as referral_count
      FROM client_stats cs
      LEFT JOIN referral_counts rc ON rc.client_id = cs.client_id::text
      ORDER BY cs.lifetime_value DESC
      LIMIT 50
    `);

    const rows: any[] = (result as any).rows || result as any[];

    const mapToVIP = (row: any): VIPClient => ({
      clientId: row.client_id,
      clientName: row.client_name || "Unknown",
      lifetimeValue: Math.round(Number(row.lifetime_value)),
      totalBookings: Number(row.total_bookings),
      referralCount: Number(row.referral_count),
      avgBookingValue: Math.round(Number(row.avg_booking_value)),
    });

    const allClients = rows.map(mapToVIP);

    const byLifetimeValue = [...allClients]
      .sort((a, b) => b.lifetimeValue - a.lifetimeValue)
      .slice(0, 10);

    const byBookings = [...allClients]
      .sort((a, b) => b.totalBookings - a.totalBookings || b.lifetimeValue - a.lifetimeValue)
      .slice(0, 10);

    const byReferrals = [...allClients]
      .filter(c => c.referralCount > 0)
      .sort((a, b) => b.referralCount - a.referralCount)
      .slice(0, 10);

    return { byLifetimeValue, byBookings, byReferrals };
  },

  async getBehaviourDashboard(): Promise<BehaviourDashboard> {
    const [bookingMonthsRes, departureMonthsRes, destinationsRes, airportsRes, leadTrendRes] = await Promise.all([
      db.execute(sql`
        SELECT EXTRACT(MONTH FROM b.date_created) as month, COUNT(*) as count
        FROM booking_table b
        WHERE b.is_active = true AND b.date_created IS NOT NULL
        GROUP BY month ORDER BY month
      `),

      db.execute(sql`
        SELECT EXTRACT(MONTH FROM b.travel_date::timestamp) as month, COUNT(*) as count
        FROM booking_table b
        WHERE b.is_active = true AND b.travel_date IS NOT NULL
        GROUP BY month ORDER BY month
      `),

      db.execute(sql`
        SELECT d.name, COUNT(*) as count
        FROM enquiry_destination ed
        JOIN destination_table d ON d.id = ed.destination_id
        GROUP BY d.name
        ORDER BY count DESC
        LIMIT 10
      `),

      db.execute(sql`
        SELECT a.airport_name as name, COUNT(*) as count
        FROM quote_flights qf
        JOIN airport_table a ON a.id = qf.departing_airport_id
        WHERE qf.departing_airport_id IS NOT NULL
        GROUP BY a.airport_name
        ORDER BY count DESC
        LIMIT 10
      `),

      db.execute(sql`
        SELECT 
          TO_CHAR(b.date_created, 'YYYY-MM') as month,
          COALESCE(AVG(EXTRACT(DAY FROM (b.travel_date::timestamp - b.date_created))), 0) as avg_days
        FROM booking_table b
        WHERE b.is_active = true
          AND b.travel_date IS NOT NULL
          AND b.date_created IS NOT NULL
          AND b.travel_date::timestamp > b.date_created
        GROUP BY TO_CHAR(b.date_created, 'YYYY-MM')
        ORDER BY month DESC
        LIMIT 12
      `),
    ]);

    const toRows = (r: any): any[] => (r as any).rows || r as any[];

    return {
      bookingMonths: toRows(bookingMonthsRes).map(r => ({ month: Number(r.month), count: Number(r.count) })),
      departureMonths: toRows(departureMonthsRes).map(r => ({ month: Number(r.month), count: Number(r.count) })),
      topDestinations: toRows(destinationsRes).map(r => ({ name: String(r.name), count: Number(r.count) })),
      topAirports: toRows(airportsRes).map(r => ({ name: String(r.name), count: Number(r.count) })),
      avgLeadTimeTrend: toRows(leadTrendRes).map(r => ({ month: String(r.month), avgDays: Math.round(Number(r.avg_days)) })).reverse(),
    };
  },

  async getClientList(params: { page?: number; limit?: number; sortBy?: string; sortDir?: string; search?: string }): Promise<ClientListResponse> {
    const page = params.page || 1;
    const limit = params.limit || 25;
    const offset = (page - 1) * limit;
    const search = params.search?.trim();

    const searchPattern = search ? `%${search}%` : "%";
    const hasSearch = search ? true : false;

    const sortColumn = params.sortBy || "lifetime_value";
    const sortDir = params.sortDir === "asc" ? "ASC" : "DESC";

    const validSorts: Record<string, string> = {
      lifetime_value: "lifetime_value",
      total_bookings: "total_bookings",
      last_booking_date: "last_booking_date",
      name: "client_name",
      created_at: "created_at",
      total_enquiries: "total_enquiries",
    };
    const sortCol = validSorts[sortColumn] || "lifetime_value";

    const result = await db.execute(sql`
      WITH client_agg AS (
        SELECT 
          ct.id,
          CONCAT(ct."firstName", ' ', ct.surename) as client_name,
          ct.email,
          ct."phoneNumber" as phone,
          ct."createdAt" as created_at,
          COALESCE(SUM(CAST(b.sales_price AS DECIMAL)), 0) as lifetime_value,
          COUNT(DISTINCT b.id) as total_bookings,
          COUNT(DISTINCT e.id) as total_enquiries,
          MAX(b.date_created) as last_booking_date,
          MAX(b.travel_date) as last_travel_date,
          MAX(u.name) as assigned_agent,
          MAX(t.lead_source) as lead_source
        FROM client_table ct
        LEFT JOIN transaction t ON t.client_id = ct.id
        LEFT JOIN booking_table b ON b.transaction_id = t.id AND b.is_active = true
        LEFT JOIN enquiry_table e ON e.transaction_id = t.id
        LEFT JOIN "user" u ON u.id = t.agent_id
        WHERE (${hasSearch} = false OR (
          (ct."firstName" || ' ' || ct.surename) ILIKE ${searchPattern}
          OR ct.email ILIKE ${searchPattern}
          OR ct."phoneNumber" ILIKE ${searchPattern}
        ))
        GROUP BY ct.id, ct."firstName", ct.surename, ct.email, ct."phoneNumber", ct."createdAt"
      )
      SELECT *, COUNT(*) OVER() as total_count
      FROM client_agg
      ORDER BY ${sql.raw(sortCol)} ${sql.raw(sortDir)} NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `);

    const rows: any[] = (result as any).rows || result as any[];
    const total = rows.length > 0 ? Number(rows[0].total_count) : 0;

    const clients: ClientListItem[] = rows.map(r => ({
      id: r.id,
      name: r.client_name || "Unknown",
      email: r.email || null,
      phone: r.phone || "",
      lifetimeValue: Math.round(Number(r.lifetime_value)),
      totalBookings: Number(r.total_bookings),
      totalEnquiries: Number(r.total_enquiries),
      lastBookingDate: r.last_booking_date ? new Date(r.last_booking_date).toISOString() : null,
      lastTravelDate: r.last_travel_date ? String(r.last_travel_date) : null,
      assignedAgent: r.assigned_agent || null,
      leadSource: r.lead_source || null,
      createdAt: r.created_at ? new Date(r.created_at).toISOString() : "",
    }));

    return { clients, total, page, limit };
  },
};
