import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../../config/database";
import {
  booking,
  branchMembers,
  branches,
  clientTable,
  hrRecordsTable,
  organization,
  quote,
  quoteViewsTable,
  transaction,
  user,
} from "@shared/schema";
import { totalBookingCommissionExpr } from "../../utils/commission-sql";
import {
  bookingTouchedSinceCond,
  windowBookingsExpr,
  windowProfitExpr,
  windowQuotedDealsExpr,
} from "../organization-overview/organization-overview.sql";
import {
  bookingActiveCond,
  bookingNotLostCond,
  countableQuoteConds,
  dealScopeConds,
  lifetimeProfitExpr,
  quoteCreatedInWindow,
  windowSalesExpr,
} from "./agent-profile.sql";
import type {
  DealFilter,
  DealRow,
  DepartureRow,
  MembershipRow,
  QuoteWindowCounts,
  SubjectUserRow,
  TimeWindow,
  WindowTotals,
} from "./agent-profile.types";

/**
 * Reads for the agent profile. Deal queries start from dealScopeConds (organisation first);
 * user/HR/membership queries carry an explicit organisation predicate. Secrets (password,
 * tokens, salary, tax id) are never selected.
 */
export const agentProfileRepository = {
  /** The user, if they have a membership in the organisation, plus HR start date and organisation name. */
  async findSubjectUser(userId: string, orgId: string): Promise<SubjectUserRow | null> {
    const [row] = await db
      .select({
        id: user.id,
        name: user.name,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        phone: user.phoneNumber,
        image: user.image,
        createdAt: user.createdAt,
        hrStartDate: hrRecordsTable.startDate,
        organisationName: organization.name,
      })
      .from(user)
      .innerJoin(branchMembers, and(eq(branchMembers.userId, user.id), eq(branchMembers.orgId, orgId)))
      .leftJoin(hrRecordsTable, and(eq(hrRecordsTable.userId, user.id), eq(hrRecordsTable.orgId, orgId)))
      .leftJoin(organization, eq(organization.id, orgId))
      .where(and(eq(branchMembers.orgId, orgId), eq(user.id, userId)))
      .limit(1);
    return row ?? null;
  },

  async findOrganisationName(orgId: string): Promise<string | null> {
    const [row] = await db.select({ name: organization.name }).from(organization).where(eq(organization.id, orgId)).limit(1);
    return row?.name ?? null;
  },

  /** Every branch membership the user has in the organisation (active or not), oldest first. */
  async listMemberships(userId: string, orgId: string): Promise<MembershipRow[]> {
    return db
      .select({
        branchId: branches.id,
        branchName: branches.name,
        branchType: branches.branchType,
        openingPattern: branches.openingPattern,
        orgRole: branchMembers.orgRole,
        isActive: branchMembers.isActive,
        joinedAt: branchMembers.joinedAt,
      })
      .from(branchMembers)
      .innerJoin(branches, and(eq(branches.id, branchMembers.branchId), eq(branches.organizationId, orgId)))
      .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)))
      .orderBy(asc(branchMembers.joinedAt));
  },

  /** All-time profit incl. upsells, over every booking the filter reaches. */
  async getLifetimeProfit(f: DealFilter): Promise<number> {
    const [row] = await db
      .select({ profit: lifetimeProfitExpr() })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(...dealScopeConds(f), bookingActiveCond));
    return Number(row?.profit ?? 0);
  },

  /** Top bookings by commission (package + line items, no upsells), then newest. LOST bookings are excluded. */
  async listBiggestDeals(f: DealFilter, limit: number): Promise<DealRow[]> {
    const commission = totalBookingCommissionExpr(booking.id);
    const rows = await db
      .select({
        bookingId: booking.id,
        transactionId: transaction.id,
        clientId: clientTable.id,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        title: sql<string | null>`COALESCE(${booking.title}, ${quote.title})`,
        bookedAt: booking.date_created,
        travelDate: booking.travel_date,
        salesPrice: sql<string>`COALESCE(CAST(${booking.sales_price} AS DECIMAL), 0)`,
        commission: sql<string>`${commission}`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(quote, eq(quote.id, booking.quote_id))
      .where(and(...dealScopeConds(f), bookingActiveCond, bookingNotLostCond()))
      .orderBy(desc(commission), desc(booking.date_created))
      .limit(limit);
    return rows.map((r) => ({
      ...r,
      salesPrice: Number(r.salesPrice),
      commission: Number(r.commission),
    }));
  },

  /** Profit, bookings and sales in a half-open window. */
  async getWindowTotals(f: DealFilter, w: TimeWindow): Promise<WindowTotals> {
    const [row] = await db
      .select({
        profit: windowProfitExpr(w),
        bookings: windowBookingsExpr(w),
        sales: windowSalesExpr(w),
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(...dealScopeConds(f), bookingActiveCond, bookingTouchedSinceCond(w.from)));
    return {
      profit: Number(row?.profit ?? 0),
      bookings: Number(row?.bookings ?? 0),
      sales: Number(row?.sales ?? 0),
    };
  },

  /** Countable quotes created in the window, and the distinct deals they sit on. */
  async getQuoteWindowCounts(f: DealFilter, w: TimeWindow): Promise<QuoteWindowCounts> {
    const [row] = await db
      .select({
        quotesSent: sql<number>`COUNT(${quote.id})`,
        quotedDeals: windowQuotedDealsExpr(w),
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(and(...dealScopeConds(f), ...countableQuoteConds(), quoteCreatedInWindow(w)));
    return { quotesSent: Number(row?.quotesSent ?? 0), quotedDeals: Number(row?.quotedDeals ?? 0) };
  },

  /** Views, inside the window, of the countable quotes created in that same window. */
  async countQuoteViews(f: DealFilter, w: TimeWindow): Promise<number> {
    const [row] = await db
      .select({ views: sql<number>`COUNT(${quoteViewsTable.id})` })
      .from(quoteViewsTable)
      .innerJoin(quote, eq(quote.id, quoteViewsTable.quoteId))
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .where(
        and(
          ...dealScopeConds(f),
          ...countableQuoteConds(),
          quoteCreatedInWindow(w),
          gte(quoteViewsTable.viewedAt, w.from),
          lt(quoteViewsTable.viewedAt, w.to),
        ),
      );
    return Number(row?.views ?? 0);
  },

  /** Live (not lost) bookings travelling in [startYmd, endExclYmd). */
  async listDepartures(f: DealFilter, startYmd: string, endExclYmd: string): Promise<DepartureRow[]> {
    return db
      .select({
        bookingId: booking.id,
        transactionId: transaction.id,
        clientId: clientTable.id,
        clientFirstName: clientTable.firstName,
        clientSurname: clientTable.surename,
        travelDate: booking.travel_date,
        title: sql<string | null>`COALESCE(${booking.title}, ${quote.title})`,
      })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(quote, eq(quote.id, booking.quote_id))
      .where(
        and(
          ...dealScopeConds(f),
          bookingActiveCond,
          bookingNotLostCond(),
          gte(booking.travel_date, startYmd),
          lt(booking.travel_date, endExclYmd),
        ),
      )
      .orderBy(asc(booking.travel_date), asc(booking.id));
  },
};
