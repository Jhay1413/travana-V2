import { Router, Request, Response } from "express";
import { db } from "../config/database";
import { enquiry_table, quote, booking, transaction, clientTable, user } from "@shared/schema";
import { eq, and, sql, ilike, or, gte, lte, count } from "drizzle-orm";
import { asyncHandler } from "../utils/async-handler";
import { successResponse } from "../utils/response";
import { alias } from "drizzle-orm/pg-core";

const router = Router();

const agentUser = alias(user, "agent_user");

function getDateRange(range: string): { start?: Date; end?: Date } {
  const now = new Date();
  let start: Date | undefined;
  let end: Date | undefined;

  switch (range) {
    case "today": {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
      break;
    }
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
    default:
      break;
  }
  return { start, end };
}

router.get(
  "/enquiries",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const dateRange = req.query.dateRange as string;
    const agentId = req.query.agentId as string;
    const sortBy = (req.query.sortBy as string) || "newest";

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") {
      conditions.push(eq(enquiry_table.status, status));
    }
    if (agentId && agentId !== "all") {
      conditions.push(sql`("transaction"."agent_id" = ${agentId} OR ${transaction.user_id} = ${agentId})`);
    }
    if (dateRange && dateRange !== "all-time") {
      const { start, end } = getDateRange(dateRange);
      if (start) conditions.push(gte(enquiry_table.date_created, start.toISOString()));
      if (end) conditions.push(lte(enquiry_table.date_created, end.toISOString()));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(enquiry_table.title, q),
          ilike(clientTable.firstName, q),
          ilike(clientTable.surename, q)
        )
      );
    }

    let orderBy;
    switch (sortBy) {
      case "oldest": orderBy = sql`${enquiry_table.date_created} ASC NULLS LAST`; break;
      case "price-high": orderBy = sql`CAST(${enquiry_table.budget} AS NUMERIC) DESC NULLS LAST`; break;
      case "price-low": orderBy = sql`CAST(${enquiry_table.budget} AS NUMERIC) ASC NULLS LAST`; break;
      default: orderBy = sql`${enquiry_table.date_created} DESC NULLS LAST`; break;
    }

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
        userId: transaction.user_id,
        agentFirstName: agentUser.firstName,
        agentName: agentUser.name,
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
      .leftJoin(agentUser, sql`(${agentUser.id} = "transaction"."agent_id" OR ${agentUser.id} = ${transaction.user_id})`)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      transactionId: r.transactionId,
      clientId: r.clientId,
      clientName: [r.clientTitle !== "NULL" ? r.clientTitle : "", r.clientFirstName, r.clientSurname].filter(Boolean).join(" ") || "Unknown",
      clientPhone: r.clientPhone || "",
      agentName: r.agentFirstName || r.agentName || "",
      title: r.title || "Untitled",
      status: r.status || "NEW_LEAD",
      travelDate: r.travelDate,
      dateCreated: r.dateCreated,
      adults: r.adults || 0,
      children: r.children || 0,
      budget: parseFloat(r.budget as string) || 0,
      nights: r.nights || 0,
    }));

    const total = totalResult?.total || 0;
    return successResponse(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Enquiries retrieved");
  })
);

router.get(
  "/quotes",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const dateRange = req.query.dateRange as string;
    const agentId = req.query.agentId as string;
    const sortBy = (req.query.sortBy as string) || "newest";

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") {
      conditions.push(eq(quote.quote_status, status));
    }
    if (agentId && agentId !== "all") {
      conditions.push(sql`(${transaction}.agent_id = ${agentId} OR ${transaction.user_id} = ${agentId})`);
    }
    if (dateRange && dateRange !== "all-time") {
      const { start, end } = getDateRange(dateRange);
      if (start) conditions.push(gte(quote.date_created, start.toISOString()));
      if (end) conditions.push(lte(quote.date_created, end.toISOString()));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(quote.title, q),
          ilike(clientTable.firstName, q),
          ilike(clientTable.surename, q)
        )
      );
    }

    let orderBy;
    switch (sortBy) {
      case "oldest": orderBy = sql`${quote.date_created} ASC NULLS LAST`; break;
      case "price-high": orderBy = sql`CAST(${quote.sales_price} AS NUMERIC) DESC NULLS LAST`; break;
      case "price-low": orderBy = sql`CAST(${quote.sales_price} AS NUMERIC) ASC NULLS LAST`; break;
      default: orderBy = sql`${quote.date_created} DESC NULLS LAST`; break;
    }

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
        userId: transaction.user_id,
        agentFirstName: agentUser.firstName,
        agentName: agentUser.name,
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
      .leftJoin(agentUser, sql`(${agentUser.id} = ${transaction}.agent_id OR ${agentUser.id} = ${transaction.user_id})`)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      transactionId: r.transactionId,
      clientId: r.clientId,
      clientName: [r.clientTitle !== "NULL" ? r.clientTitle : "", r.clientFirstName, r.clientSurname].filter(Boolean).join(" ") || "Unknown",
      clientPhone: r.clientPhone || "",
      agentName: r.agentFirstName || r.agentName || "",
      title: r.title || "Untitled",
      status: r.status || "DRAFT",
      travelDate: r.travelDate,
      dateCreated: r.dateCreated,
      salesPrice: parseFloat(r.salesPrice as string) || 0,
      commission: parseFloat(r.commission as string) || 0,
      nights: r.nights || 0,
      adults: r.adults || 0,
      children: r.children || 0,
    }));

    const total = totalResult?.total || 0;
    return successResponse(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Quotes retrieved");
  })
);

router.get(
  "/bookings",
  asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;
    const search = req.query.search as string;
    const dateRange = req.query.dateRange as string;
    const agentId = req.query.agentId as string;
    const sortBy = (req.query.sortBy as string) || "newest";

    const conditions: any[] = [eq(transaction.is_active, true)];

    if (status && status !== "all") {
      conditions.push(eq(booking.booking_status, status));
    }
    if (agentId && agentId !== "all") {
      conditions.push(sql`(${transaction}.agent_id = ${agentId} OR ${transaction.user_id} = ${agentId})`);
    }
    if (dateRange && dateRange !== "all-time") {
      const { start, end } = getDateRange(dateRange);
      if (start) conditions.push(gte(booking.date_created, start.toISOString()));
      if (end) conditions.push(lte(booking.date_created, end.toISOString()));
    }
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(
        or(
          ilike(booking.title, q),
          ilike(clientTable.firstName, q),
          ilike(clientTable.surename, q),
          ilike(booking.hays_ref, q)
        )
      );
    }

    let orderBy;
    switch (sortBy) {
      case "oldest": orderBy = sql`${booking.date_created} ASC NULLS LAST`; break;
      case "price-high": orderBy = sql`CAST(${booking.sales_price} AS NUMERIC) DESC NULLS LAST`; break;
      case "price-low": orderBy = sql`CAST(${booking.sales_price} AS NUMERIC) ASC NULLS LAST`; break;
      default: orderBy = sql`${booking.date_created} DESC NULLS LAST`; break;
    }

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
        userId: transaction.user_id,
        agentFirstName: agentUser.firstName,
        agentName: agentUser.name,
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
      .leftJoin(agentUser, sql`(${agentUser.id} = ${transaction}.agent_id OR ${agentUser.id} = ${transaction.user_id})`)
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      transactionId: r.transactionId,
      clientId: r.clientId,
      clientName: [r.clientTitle !== "NULL" ? r.clientTitle : "", r.clientFirstName, r.clientSurname].filter(Boolean).join(" ") || "Unknown",
      clientPhone: r.clientPhone || "",
      agentName: r.agentFirstName || r.agentName || "",
      title: r.title || "Untitled",
      status: r.status || "BOOKED",
      travelDate: r.travelDate,
      dateCreated: r.dateCreated,
      salesPrice: parseFloat(r.salesPrice as string) || 0,
      commission: parseFloat(r.commission as string) || 0,
      nights: r.nights || 0,
      adults: r.adults || 0,
      children: r.children || 0,
      haysRef: r.haysRef || "",
      supplierRef: r.supplierRef || "",
    }));

    const total = totalResult?.total || 0;
    return successResponse(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Bookings retrieved");
  })
);

router.get(
  "/agents",
  asyncHandler(async (_req: Request, res: Response) => {
    const agents = await db
      .select({ id: user.id, name: user.name, firstName: user.firstName })
      .from(user)
      .orderBy(user.firstName);
    return successResponse(res, agents, "Agents retrieved");
  })
);

export default router;
