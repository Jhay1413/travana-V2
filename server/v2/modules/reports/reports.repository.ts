import { db } from "../../config/database";
import {
  booking,
  quote,
  transaction,
  enquiry_table,
  clientTable,
  user as userTable,
  branchMembers,
} from "@shared/schema";
import { sql, eq, and, gte, lte, isNull, inArray, desc, type SQL } from "drizzle-orm";
import {
  buildScopeConditions,
  needsClientJoin,
  type ScopeFilter,
} from "../../utils/scope-conditions";
import { totalBookingCommissionExpr } from "../../utils/commission-sql";
import { quoteStatsConds } from "../../utils/quote-conditions";
import { userOrgRolesRepository } from "../user-org-roles/user-org-roles.repository";
import {
  getShopTargetsByDateRange,
  getAgentTargetsByDateRange,
  getAllAgents,
} from "../targets/targets.repository";
import type {
  SalesReport,
  SalesTotals,
  SalesMonthBucket,
  SalesByLeadSource,
  AgentPerformanceReport,
  AgentPerformanceRow,
  LeadSourceReport,
  LeadSourceRow,
  TargetsVsActualsReport,
  TargetMonthRow,
  TargetAgentRow,
  LeadSource,
} from "./reports.types";

interface ReportScope extends ScopeFilter {
  from: Date;
  to: Date;
  agentId?: string;
  leadSource?: string;
}

const LEAD_SOURCE_VALUES: ReadonlyArray<Exclude<LeadSource, "UNKNOWN">> = [
  "SHOP",
  "FACEBOOK",
  "WHATSAPP",
  "INSTAGRAM",
  "PHONE_ENQUIRY",
];

function bookingRangeConds(scope: ReportScope): SQL[] {
  const conds: SQL[] = [
    gte(booking.date_created, scope.from),
    lte(booking.date_created, scope.to),
    sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
    ...buildScopeConditions(scope),
  ];
  if (scope.agentId) conds.push(eq(transaction.user_id, scope.agentId));
  if (scope.leadSource) conds.push(sql`${transaction.lead_source}::text = ${scope.leadSource}`);
  return conds;
}

function quoteRangeConds(scope: ReportScope): SQL[] {
  const conds: SQL[] = [
    gte(quote.date_created, scope.from),
    lte(quote.date_created, scope.to),
    isNull(quote.deleted_at),
    sql`(${quote.is_active} IS NULL OR ${quote.is_active} = true)`,
    ...quoteStatsConds(),
    ...buildScopeConditions(scope),
  ];
  if (scope.agentId) conds.push(eq(transaction.user_id, scope.agentId));
  if (scope.leadSource) conds.push(sql`${transaction.lead_source}::text = ${scope.leadSource}`);
  return conds;
}

/**
 * Inserts zero-value entries for every month in [from, to] that has no aggregated row,
 * so the resulting series is contiguous and the chart renders one bar per calendar month.
 */
function fillMonthBuckets(
  rows: SalesMonthBucket[],
  from: Date,
  to: Date,
): SalesMonthBucket[] {
  const byMonth = new Map(rows.map((r) => [r.month, r] as const));
  const result: SalesMonthBucket[] = [];
  const start = new Date(from.getFullYear(), from.getMonth(), 1);
  const end = new Date(to.getFullYear(), to.getMonth(), 1);
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
    result.push(byMonth.get(key) ?? { month: key, commission: 0, bookings: 0 });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

function priorRange(from: Date, to: Date): { from: Date; to: Date } {
  const lengthMs = to.getTime() - from.getTime();
  const priorTo = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorTo.getTime() - lengthMs);
  return { from: priorFrom, to: priorTo };
}

async function getSalesTotals(scope: ReportScope): Promise<SalesTotals> {
  const joinClient = needsClientJoin(scope);
  const base = db
    .select({
      commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
      bookings: sql<number>`COUNT(*)`,
      distinctClients: sql<number>`COUNT(DISTINCT ${transaction.client_id})`,
    })
    .from(booking)
    .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
  const withClient = joinClient
    ? base.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
    : base;
  const [row] = await withClient.where(and(...bookingRangeConds(scope)));
  const commission = Number(row?.commission ?? 0);
  const bookings = Number(row?.bookings ?? 0);
  return {
    commission,
    bookings,
    avgCommission: bookings > 0 ? commission / bookings : 0,
    distinctClients: Number(row?.distinctClients ?? 0),
  };
}

export const reportsRepository = {
  async getSales(scope: ReportScope): Promise<SalesReport> {
    const joinClient = needsClientJoin(scope);
    const conds = bookingRangeConds(scope);

    const monthQuery = (() => {
      const q = db
        .select({
          month: sql<string>`TO_CHAR(DATE_TRUNC('month', ${booking.date_created}), 'YYYY-MM')`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          bookings: sql<number>`COUNT(*)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(and(...conds))
        .groupBy(sql`DATE_TRUNC('month', ${booking.date_created})`)
        .orderBy(sql`DATE_TRUNC('month', ${booking.date_created}) ASC`);
    })();

    const leadSourceQuery = (() => {
      const q = db
        .select({
          source: sql<string>`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          bookings: sql<number>`COUNT(*)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(and(...conds))
        .groupBy(sql`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`)
        .orderBy(desc(sql`SUM(${totalBookingCommissionExpr(booking.id)})`));
    })();

    const priorScope = { ...scope, ...priorRange(scope.from, scope.to) };

    const [totals, prior, monthRows, leadSourceRows] = await Promise.all([
      getSalesTotals(scope),
      getSalesTotals(priorScope),
      monthQuery,
      leadSourceQuery,
    ]);

    const byMonth: SalesMonthBucket[] = fillMonthBuckets(
      monthRows.map((r) => ({
        month: String(r.month),
        commission: Number(r.commission),
        bookings: Number(r.bookings),
      })),
      scope.from,
      scope.to,
    );

    const byLeadSource: SalesByLeadSource[] = leadSourceRows.map((r) => ({
      source: (r.source ?? "UNKNOWN") as LeadSource,
      commission: Number(r.commission),
      bookings: Number(r.bookings),
    }));

    return {
      range: { from: scope.from.toISOString().slice(0, 10), to: scope.to.toISOString().slice(0, 10) },
      totals,
      prior,
      byMonth,
      byLeadSource,
    };
  },

  async getAgentPerformance(scope: ReportScope): Promise<AgentPerformanceReport> {
    const joinClient = needsClientJoin(scope);

    const bookingAgg = (() => {
      const q = db
        .select({
          agentId: transaction.user_id,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          bookings: sql<number>`COUNT(*)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient.where(and(...bookingRangeConds(scope))).groupBy(transaction.user_id);
    })();

    const quoteAgg = (() => {
      const q = db
        .select({
          agentId: transaction.user_id,
          quotes: sql<number>`COUNT(*)`,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient.where(and(...quoteRangeConds(scope))).groupBy(transaction.user_id);
    })();

    const [bookingRows, quoteRows] = await Promise.all([bookingAgg, quoteAgg]);

    const userIds = new Set<string>();
    for (const r of bookingRows) if (r.agentId) userIds.add(r.agentId);
    for (const r of quoteRows) if (r.agentId) userIds.add(r.agentId);

    const seedUsers = scope.branchId
      ? await db
          .select({
            id: userTable.id,
            name: userTable.name,
            firstName: userTable.firstName,
            email: userTable.email,
          })
          .from(userTable)
          .innerJoin(branchMembers, eq(branchMembers.userId, userTable.id))
          .where(and(eq(branchMembers.branchId, scope.branchId), eq(branchMembers.isActive, true)))
      : scope.orgId
        ? await db
            .select({
              id: userTable.id,
              name: userTable.name,
              firstName: userTable.firstName,
              email: userTable.email,
            })
            .from(userTable)
            .where(eq(userTable.orgId, scope.orgId))
        : userIds.size > 0
          ? await db
              .select({
                id: userTable.id,
                name: userTable.name,
                firstName: userTable.firstName,
                email: userTable.email,
              })
              .from(userTable)
              .where(inArray(userTable.id, Array.from(userIds)))
          : [];

    // Pure social media managers aren't sales agents — keep them out of the report.
    // Suspended users are excluded from every report too.
    const [socialOnlyIds, suspendedIds] = await Promise.all([
      userOrgRolesRepository.findSocialOnlyUserIds({ orgId: scope.orgId, branchId: scope.branchId }),
      userOrgRolesRepository.findSuspendedUserIds({ orgId: scope.orgId }),
    ]);
    const socialOnly = new Set(socialOnlyIds);

    const map = new Map<string, AgentPerformanceRow>();
    for (const u of seedUsers) {
      if (socialOnly.has(u.id)) continue;
      if (suspendedIds.has(u.id)) continue;
      map.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        commission: 0,
        bookings: 0,
        quotes: 0,
        conversionPct: 0,
        avgCommission: 0,
      });
    }
    for (const r of bookingRows) {
      if (!r.agentId || !map.has(r.agentId)) continue;
      const row = map.get(r.agentId)!;
      row.commission = Number(r.commission);
      row.bookings = Number(r.bookings);
    }
    for (const r of quoteRows) {
      if (!r.agentId || !map.has(r.agentId)) continue;
      map.get(r.agentId)!.quotes = Number(r.quotes);
    }

    const allRows = Array.from(map.values());
    for (const row of allRows) {
      row.avgCommission = row.bookings > 0 ? row.commission / row.bookings : 0;
      row.conversionPct = row.quotes > 0 ? Math.round((row.bookings / row.quotes) * 100) : 0;
    }

    const rows = allRows.sort(
      (a, b) => b.commission - a.commission || a.name.localeCompare(b.name),
    );

    const totals = rows.reduce(
      (acc, r) => ({
        commission: acc.commission + r.commission,
        bookings: acc.bookings + r.bookings,
        quotes: acc.quotes + r.quotes,
      }),
      { commission: 0, bookings: 0, quotes: 0 },
    );

    return {
      range: { from: scope.from.toISOString().slice(0, 10), to: scope.to.toISOString().slice(0, 10) },
      totals,
      rows,
    };
  },

  async getLeadSource(scope: ReportScope): Promise<LeadSourceReport> {
    const joinClient = needsClientJoin(scope);

    const enquiryAgg = (() => {
      const q = db
        .select({
          source: sql<string>`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`,
          count: sql<number>`COUNT(*)`,
        })
        .from(enquiry_table)
        .innerJoin(transaction, eq(enquiry_table.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(
          and(
            gte(enquiry_table.date_created, scope.from),
            lte(enquiry_table.date_created, scope.to),
            sql`(${enquiry_table.is_active} IS NULL OR ${enquiry_table.is_active} = true)`,
            ...buildScopeConditions(scope),
          ),
        )
        .groupBy(sql`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`);
    })();

    const quoteAgg = (() => {
      const q = db
        .select({
          source: sql<string>`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`,
          count: sql<number>`COUNT(*)`,
        })
        .from(quote)
        .innerJoin(transaction, eq(quote.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(and(...quoteRangeConds(scope)))
        .groupBy(sql`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`);
    })();

    const bookingAgg = (() => {
      const q = db
        .select({
          source: sql<string>`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`,
          count: sql<number>`COUNT(*)`,
          commission: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
        })
        .from(booking)
        .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
      const withClient = joinClient
        ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
        : q;
      return withClient
        .where(and(...bookingRangeConds(scope)))
        .groupBy(sql`COALESCE(${transaction.lead_source}::text, 'UNKNOWN')`);
    })();

    const [enquiryRows, quoteRows, bookingRows] = await Promise.all([enquiryAgg, quoteAgg, bookingAgg]);

    const map = new Map<LeadSource, LeadSourceRow>();
    const seed = (s: LeadSource) => {
      if (!map.has(s)) {
        map.set(s, {
          source: s,
          enquiries: 0,
          quotes: 0,
          bookings: 0,
          commission: 0,
          quoteRatePct: 0,
          bookRatePct: 0,
        });
      }
    };
    for (const s of LEAD_SOURCE_VALUES) seed(s);

    for (const r of enquiryRows) {
      const s = (r.source ?? "UNKNOWN") as LeadSource;
      seed(s);
      map.get(s)!.enquiries = Number(r.count);
    }
    for (const r of quoteRows) {
      const s = (r.source ?? "UNKNOWN") as LeadSource;
      seed(s);
      map.get(s)!.quotes = Number(r.count);
    }
    for (const r of bookingRows) {
      const s = (r.source ?? "UNKNOWN") as LeadSource;
      seed(s);
      const row = map.get(s)!;
      row.bookings = Number(r.count);
      row.commission = Number(r.commission);
    }

    for (const row of Array.from(map.values())) {
      row.quoteRatePct = row.enquiries > 0 ? Math.round((row.quotes / row.enquiries) * 100) : 0;
      row.bookRatePct = row.quotes > 0 ? Math.round((row.bookings / row.quotes) * 100) : 0;
    }

    const order: LeadSource[] = [...LEAD_SOURCE_VALUES, "UNKNOWN"];
    const rows = order
      .filter((s) => map.has(s))
      .map((s) => map.get(s)!)
      .filter(
        (r) => r.enquiries > 0 || r.quotes > 0 || r.bookings > 0 || LEAD_SOURCE_VALUES.includes(r.source as any),
      );

    return {
      range: { from: scope.from.toISOString().slice(0, 10), to: scope.to.toISOString().slice(0, 10) },
      rows,
    };
  },

  async getTargetsVsActuals(year: number, scope: ScopeFilter): Promise<TargetsVsActualsReport> {
    if (!scope.branchId) {
      return { year, shop: [], agents: [] };
    }

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const joinClient = needsClientJoin(scope);

    const [shopTargets, agentTargets, allAgents, monthActuals, agentActuals] = await Promise.all([
      getShopTargetsByDateRange(scope.branchId, year, 1, year, 12),
      getAgentTargetsByDateRange(scope.branchId, year, 1, year, 12),
      getAllAgents(scope.branchId),
      (() => {
        const q = db
          .select({
            month: sql<number>`EXTRACT(MONTH FROM ${booking.date_created})::int`,
            actual: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(
            and(
              gte(booking.date_created, yearStart),
              lte(booking.date_created, yearEnd),
              sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
              eq(transaction.is_test, false),
              eq(transaction.branch_id, scope.branchId),
            ),
          )
          .groupBy(sql`EXTRACT(MONTH FROM ${booking.date_created})`);
      })(),
      (() => {
        const q = db
          .select({
            agentId: transaction.user_id,
            actual: sql<number>`COALESCE(SUM(${totalBookingCommissionExpr(booking.id)}), 0)`,
          })
          .from(booking)
          .innerJoin(transaction, eq(booking.transaction_id, transaction.id));
        const withClient = joinClient
          ? q.innerJoin(clientTable, eq(transaction.client_id, clientTable.id))
          : q;
        return withClient
          .where(
            and(
              gte(booking.date_created, yearStart),
              lte(booking.date_created, yearEnd),
              sql`(${booking.is_active} IS NULL OR ${booking.is_active} = true)`,
              eq(transaction.is_test, false),
              eq(transaction.branch_id, scope.branchId),
            ),
          )
          .groupBy(transaction.user_id);
      })(),
    ]);

    const monthActualMap = new Map<number, number>();
    for (const r of monthActuals) monthActualMap.set(Number(r.month), Number(r.actual));

    const shopTargetMap = new Map<number, number>();
    for (const t of shopTargets) shopTargetMap.set(t.month, Number(t.targetAmount));

    const shop: TargetMonthRow[] = [];
    for (let m = 1; m <= 12; m += 1) {
      const target = shopTargetMap.get(m) ?? 0;
      const actual = monthActualMap.get(m) ?? 0;
      shop.push({
        year,
        month: m,
        target,
        actual,
        attainmentPct: target > 0 ? Math.round((actual / target) * 100) : 0,
      });
    }

    const agentTargetMap = new Map<string, number>();
    for (const t of agentTargets) {
      agentTargetMap.set(t.userId, (agentTargetMap.get(t.userId) ?? 0) + Number(t.targetAmount));
    }

    const agentActualMap = new Map<string, number>();
    for (const r of agentActuals) {
      if (r.agentId) agentActualMap.set(r.agentId, Number(r.actual));
    }

    const agents: TargetAgentRow[] = allAgents
      .map((a): TargetAgentRow => {
        const target = agentTargetMap.get(a.id) ?? 0;
        const actual = agentActualMap.get(a.id) ?? 0;
        return {
          id: a.id,
          name: a.name || a.email || "Agent",
          target,
          actual,
          attainmentPct: target > 0 ? Math.round((actual / target) * 100) : 0,
        };
      })
      .sort((a, b) => b.actual - a.actual || a.name.localeCompare(b.name));

    return { year, shop, agents };
  },
};
