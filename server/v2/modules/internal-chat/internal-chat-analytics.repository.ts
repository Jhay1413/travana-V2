import { and, eq, gte, isNotNull, isNull, lt, sql, type SQL } from "drizzle-orm";
import { db } from "../../config/database";
import { booking, enquiry_table, quote, transaction } from "@shared/schema";
import { quoteStatsConds } from "../../utils/quote-conditions";

// Repository for the internal-chat assistant's "analytics tool": real,
// scoped counts of enquiries/quotes/bookings for a date window. Never
// invents numbers — every figure here comes straight from the DB.

// The access level the CALLER has already been granted by
// internal-chat-analytics.service.ts#resolveAnalyticsAccess. This repository
// never decides access — it only applies the already-decided, explicit
// filter for that level.
export type AnalyticsScopeLevel = "own" | "branch" | "org" | "all";

export interface ResolvedAnalyticsScope {
  level: AnalyticsScopeLevel;
  orgId?: string;
  branchId?: string;
  userId?: string;
}

export interface PipelineStatsParams {
  resolvedScope: ResolvedAnalyticsScope;
  from: Date;
  to: Date;
}

export interface PipelineStatsRow {
  enquiries: number;
  quotes: number;
  bookings: number;
}

// Builds EXPLICIT transaction-scoping conditions for an already-resolved
// access level. Deliberately does NOT use buildTransactionScopeConds —
// that helper widens to org-wide whenever branchId/userId is missing
// (fail-OPEN), which would leak past what resolveAnalyticsAccess decided.
// Every level here is closed: 'all' has no filter, 'org'/'branch'/'own' are
// always org-scoped plus (for branch/own) an explicit branch/user filter.
function buildAnalyticsScopeConds(resolvedScope: ResolvedAnalyticsScope): SQL[] {
  const conds: SQL[] = [eq(transaction.is_test, false)];
  if (resolvedScope.level === "all") return conds;

  if (resolvedScope.orgId) conds.push(eq(transaction.org_id, resolvedScope.orgId));

  if (resolvedScope.level === "branch" && resolvedScope.branchId) {
    conds.push(eq(transaction.branch_id, resolvedScope.branchId));
  } else if (resolvedScope.level === "own" && resolvedScope.userId) {
    conds.push(eq(transaction.user_id, resolvedScope.userId));
  }

  return conds;
}

export const internalChatAnalyticsRepository = {
  // Counts enquiry/quote/booking rows created in the half-open window
  // [from, to). Row-level consistency filters mirror the rest of the
  // reporting stack (organization-overview.repository's funnel queries,
  // reports.repository's bookingRangeConds/quoteRangeConds):
  //  - is_active NULL-or-true on all three
  //  - transaction.client_id IS NOT NULL on enquiries + bookings (excludes
  //    anonymous/scratch transactions, matching the dashboard funnel's
  //    clientTable inner-join) — quotes get this via quoteStatsConds()
  //  - quotes additionally: quoteStatsConds() (excludes free quotes too)
  //    + deleted_at IS NULL
  async getPipelineStats({ resolvedScope, from, to }: PipelineStatsParams): Promise<PipelineStatsRow> {
    const scopeConds = buildAnalyticsScopeConds(resolvedScope);

    const [enquiryRow, quoteRow, bookingRow] = await Promise.all([
      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(enquiry_table)
        .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id))
        .where(
          and(
            gte(enquiry_table.date_created, from),
            lt(enquiry_table.date_created, to),
            sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`,
            isNotNull(transaction.client_id),
            ...scopeConds,
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
        .where(
          and(
            gte(quote.date_created, from),
            lt(quote.date_created, to),
            isNull(quote.deleted_at),
            sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
            ...quoteStatsConds(),
            ...scopeConds,
          ),
        ),

      db
        .select({ count: sql<number>`COUNT(*)` })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
        .where(
          and(
            gte(booking.date_created, from),
            lt(booking.date_created, to),
            sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
            isNotNull(transaction.client_id),
            ...scopeConds,
          ),
        ),
    ]);

    return {
      enquiries: Number(enquiryRow[0]?.count ?? 0),
      quotes: Number(quoteRow[0]?.count ?? 0),
      bookings: Number(bookingRow[0]?.count ?? 0),
    };
  },
};
