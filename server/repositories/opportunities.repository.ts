import { db } from "../config/database";
import { enquiry_table, quote, booking, transaction, clientTable, user } from "@shared/schema";
import { eq, and, sql, ilike, or, gte, lte, count } from "drizzle-orm";

export interface OpportunityFilters {
  page: number;
  limit: number;
  status?: string;
  search?: string;
  dateRange?: string;
  agentId?: string;
  sortBy?: string;
}

function buildDateConditions(table: any, field: any, dateRange: string) {
  const conditions: any[] = [];
  const now = new Date();

  let start: Date | undefined;
  let end: Date | undefined;

  switch (dateRange) {
    case "today":
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    case "this-week": {
      const day = now.getDay();
      start = new Date(now);
      start.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
      start.setHours(0, 0, 0, 0);
      break;
    }
    case "this-month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case "last-month":
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      break;
    case "last-7":
      start = new Date(now);
      start.setDate(now.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "last-30":
      start = new Date(now);
      start.setDate(now.getDate() - 30);
      start.setHours(0, 0, 0, 0);
      break;
    case "last-90":
      start = new Date(now);
      start.setDate(now.getDate() - 90);
      start.setHours(0, 0, 0, 0);
      break;
    case "this-year":
      start = new Date(now.getFullYear(), 0, 1);
      break;
  }

  if (start) conditions.push(gte(field, start));
  if (end) conditions.push(lte(field, end));
  return conditions;
}

export const opportunitiesRepository = {
  async findEnquiries(filters: OpportunityFilters) {
    const { page, limit, status, search, dateRange, agentId, sortBy = "newest" } = filters;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") conditions.push(eq(enquiry_table.status, status));
    if (agentId && agentId !== "all") conditions.push(eq(transaction.user_id, agentId));
    if (dateRange && dateRange !== "all-time") {
      conditions.push(...buildDateConditions(enquiry_table, enquiry_table.date_created, dateRange));
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(enquiry_table.title, q), ilike(clientTable.firstName, q), ilike(clientTable.surename, q)));
    }

    const orderBy =
      sortBy === "oldest" ? sql`${enquiry_table.date_created} ASC NULLS LAST`
      : sortBy === "price-high" ? sql`CAST(${enquiry_table.budget} AS NUMERIC) DESC NULLS LAST`
      : sortBy === "price-low" ? sql`CAST(${enquiry_table.budget} AS NUMERIC) ASC NULLS LAST`
      : sql`${enquiry_table.date_created} DESC NULLS LAST`;

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [totalResult] = await db
      .select({ total: count() })
      .from(enquiry_table)
      .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: enquiry_table.id,
        transactionId: transaction.id,
        clientId: transaction.client_id,
        clientTitle: clientTable.title,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientPhone: clientTable.phoneNumber,
        agentFirstName: user.firstName,
        agentName: user.name,
        title: enquiry_table.title,
        status: enquiry_table.status,
        travelDate: enquiry_table.travel_date,
        dateCreated: enquiry_table.date_created,
        adults: enquiry_table.adults,
        children: enquiry_table.children,
        budget: enquiry_table.budget,
        nights: enquiry_table.no_of_nights,
      })
      .from(enquiry_table)
      .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(user, eq(user.id, transaction.user_id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return { rows, total: totalResult?.total || 0 };
  },

  async findQuotes(filters: OpportunityFilters) {
    const { page, limit, status, search, dateRange, agentId, sortBy = "newest" } = filters;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") conditions.push(eq(quote.quote_status, status));
    if (agentId && agentId !== "all") conditions.push(eq(transaction.user_id, agentId));
    if (dateRange && dateRange !== "all-time") {
      conditions.push(...buildDateConditions(quote, quote.date_created, dateRange));
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(quote.title, q), ilike(clientTable.firstName, q), ilike(clientTable.surename, q)));
    }

    const orderBy =
      sortBy === "oldest" ? sql`${quote.date_created} ASC NULLS LAST`
      : sortBy === "price-high" ? sql`CAST(${quote.sales_price} AS NUMERIC) DESC NULLS LAST`
      : sortBy === "price-low" ? sql`CAST(${quote.sales_price} AS NUMERIC) ASC NULLS LAST`
      : sql`${quote.date_created} DESC NULLS LAST`;

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [totalResult] = await db
      .select({ total: count() })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: quote.id,
        transactionId: transaction.id,
        clientId: transaction.client_id,
        clientTitle: clientTable.title,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientPhone: clientTable.phoneNumber,
        agentFirstName: user.firstName,
        agentName: user.name,
        title: quote.title,
        status: quote.quote_status,
        travelDate: quote.travel_date,
        dateCreated: quote.date_created,
        salesPrice: quote.sales_price,
        commission: quote.package_commission,
        nights: quote.num_of_nights,
        adults: quote.adult,
        children: quote.child,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(user, eq(user.id, transaction.user_id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return { rows, total: totalResult?.total || 0 };
  },

  async findBookings(filters: OpportunityFilters) {
    const { page, limit, status, search, dateRange, agentId, sortBy = "newest" } = filters;
    const offset = (page - 1) * limit;

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") conditions.push(eq(booking.booking_status, status));
    if (agentId && agentId !== "all") conditions.push(eq(transaction.user_id, agentId));
    if (dateRange && dateRange !== "all-time") {
      conditions.push(...buildDateConditions(booking, booking.date_created, dateRange));
    }
    if (search?.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(ilike(booking.title, q), ilike(clientTable.firstName, q), ilike(clientTable.surename, q), ilike(booking.hays_ref, q)));
    }

    const orderBy =
      sortBy === "oldest" ? sql`${booking.date_created} ASC NULLS LAST`
      : sortBy === "price-high" ? sql`CAST(${booking.sales_price} AS NUMERIC) DESC NULLS LAST`
      : sortBy === "price-low" ? sql`CAST(${booking.sales_price} AS NUMERIC) ASC NULLS LAST`
      : sql`${booking.date_created} DESC NULLS LAST`;

    const whereClause = conditions.length > 1 ? and(...conditions) : conditions[0];

    const [totalResult] = await db
      .select({ total: count() })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(whereClause);

    const rows = await db
      .select({
        id: booking.id,
        transactionId: transaction.id,
        clientId: transaction.client_id,
        clientTitle: clientTable.title,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        clientPhone: clientTable.phoneNumber,
        agentFirstName: user.firstName,
        agentName: user.name,
        title: booking.title,
        status: booking.booking_status,
        travelDate: booking.travel_date,
        dateCreated: booking.date_created,
        salesPrice: booking.sales_price,
        commission: booking.package_commission,
        nights: booking.num_of_nights,
        adults: booking.adult,
        children: booking.child,
        haysRef: booking.hays_ref,
        supplierRef: booking.supplier_ref,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(user, eq(user.id, transaction.user_id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return { rows, total: totalResult?.total || 0 };
  },

  async findAgents() {
    return db
      .select({ id: user.id, name: user.name, firstName: user.firstName })
      .from(user)
      .orderBy(user.firstName);
  },
};
