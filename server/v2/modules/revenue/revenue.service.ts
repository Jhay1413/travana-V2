import { revenueRepository } from "./revenue.repository";
import type {
  RevenueDashboardData,
  MonthForwards,
  AgentPerformance,
  MonthBookingsData,
  BookingDetail,
} from "./revenue.types";
import type { Scope } from "../../utils/scope";

function effectiveOrgId(scope: Scope): string | null {
  return scope.orgRole === "platform_admin" ? null : (scope.orgId || null);
}

const DEFAULT_MONTHLY_TARGETS: Record<number, number> = {
  1: 10000, 2: 10000, 3: 12000, 4: 12000,
  5: 15000, 6: 15000, 7: 12000, 8: 10000,
  9: 10000, 10: 12000, 11: 15000, 12: 12000,
};

// Human labels for upsell types in the Forwards drill-down (mirrors the client
// UPSELL_TYPE_OPTIONS). Kept here so the server response is self-describing.
const UPSELL_TYPE_LABELS: Record<string, string> = {
  EXTRA_NIGHTS: "Extra Nights",
  TRANSFER: "Transfer",
  LOUNGE: "Lounge Pass",
  PARKING: "Airport Parking",
  FEE: "Fee / Amendment",
  OTHER: "Other",
};

export const revenueService = {
  async getRevenueDashboard(scope: Scope): Promise<RevenueDashboardData> {
    const orgId = effectiveOrgId(scope);
    const now = new Date();
    const year = now.getFullYear();
    const monthlyData: MonthForwards[] = [];

    // Calendar year: January (1) through December (12) of the current year.
    for (let month = 1; month <= 12; month++) {
      const targetDate = new Date(year, month - 1, 1);

      const { totalCommission, dealCount } = await revenueRepository.getForwardsForMonth(year, month, orgId);

      const monthName = targetDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      const shortMonth = targetDate.toLocaleDateString("en-GB", { month: "short" });

      const target = DEFAULT_MONTHLY_TARGETS[month] || 10000;
      const avgDealValue = dealCount > 0 ? totalCommission / dealCount : 0;

      monthlyData.push({
        month: monthName, shortMonth, year, monthNumber: month,
        forwards: totalCommission, target, deals: dealCount, avgDealValue,
      });
    }

    const agentData = await revenueRepository.getAgentPerformance(orgId);
    const agentPerformance: AgentPerformance[] = agentData.map((agent) => ({
      agentId: agent.agentId,
      name: `${agent.agentFirstName} ${agent.agentLastName}`,
      forwards: agent.totalCommission,
      deals: agent.dealCount,
      avgProfit: agent.dealCount > 0 ? agent.totalCommission / agent.dealCount : 0,
    }));

    // KPIs target the upcoming month within the calendar year; fall back to the
    // first month (e.g. when the current month is December).
    const nextMonthData =
      monthlyData.find((m) => m.monthNumber === now.getMonth() + 2) || monthlyData[0];

    const nextMonthForwards = nextMonthData?.forwards || 0;
    const total12MonthForwards = monthlyData.reduce((sum, m) => sum + m.forwards, 0);
    const totalDeals = monthlyData.reduce((sum, m) => sum + m.deals, 0);
    const avgDealProfit = totalDeals > 0 ? total12MonthForwards / totalDeals : 0;

    const nextMonthTarget = nextMonthData?.target || 10000;
    const nextMonthGap = Math.max(0, nextMonthTarget - nextMonthForwards);
    const dealsNeeded = avgDealProfit > 0 ? Math.ceil(nextMonthGap / avgDealProfit) : 0;

    return {
      nextMonthForwards, total12MonthForwards, avgDealProfit,
      nextMonthTarget, dealsNeeded, monthlyData, agentPerformance,
    };
  },

  // Regenerate the persisted forwards_report rows from live bookings for the
  // current calendar year (January–December). Rows are per-org (platform admins
  // write the org_id-null platform-wide rows), so orgs never overwrite each
  // other's reports. Commission is recorded entirely as company commission
  // (agent_commission = 0). Manual `adjustment` / `historical_ids` on existing
  // rows are preserved. Feeds the Admin → Data → Forwards Reports table.
  async regenerateForwardsReport(scope: Scope): Promise<{ monthsWritten: number; inserted: number; updated: number }> {
    const orgId = effectiveOrgId(scope);
    const now = new Date();
    const year = now.getFullYear();
    let inserted = 0;
    let updated = 0;

    // Calendar year: January (1) through December (12) of the current year.
    for (let month = 1; month <= 12; month++) {
      const targetDate = new Date(year, month - 1, 1);
      const monthName = targetDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

      const { totalCommission, dealIds, upsellIds } = await revenueRepository.getForwardsWithIdsForMonth(year, month, orgId);
      const target = DEFAULT_MONTHLY_TARGETS[month] || 10000;

      const result = await revenueRepository.upsertForwardsReportMonth({
        year, month, monthName, target, companyCommission: totalCommission, dealIds, upsellIds, orgId,
      });
      if (result === "inserted") inserted++;
      else updated++;
    }

    return { monthsWritten: 12, inserted, updated };
  },

  async getMonthBookings(year: number, month: number, scope: Scope): Promise<MonthBookingsData> {
    const orgId = effectiveOrgId(scope);
    const [bookingsData, upsellsData] = await Promise.all([
      revenueRepository.getBookingsForMonth(year, month, orgId),
      revenueRepository.getUpsellDetailsForCalendarMonth(year, month, orgId),
    ]);

    const targetDate = new Date(year, month - 1, 1);
    const monthName = targetDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

    const bookings: BookingDetail[] = bookingsData.map((b) => ({
      id: b.bookingId,
      bookingId: b.bookingId,
      clientId: b.clientId,
      clientName: `${b.clientFirstName} ${b.clientSurename}`,
      destination: b.title || "Unknown",
      travelDate: b.travelDate,
      commission: b.commission,
      agentId: b.agentId,
      agentName: `${b.agentFirstName} ${b.agentLastName}`,
      isUpsell: false,
    }));

    // Upsells recognised in this calendar month (by `added_at`) — shown in the
    // same drill-down, tagged so the UI can label them. `travelDate` carries the
    // added date so the existing sort keeps working.
    const upsells: BookingDetail[] = upsellsData.map((u) => {
      const label = UPSELL_TYPE_LABELS[u.upsellType] || "Upsell";
      return {
        id: u.upsellId,
        bookingId: u.bookingId,
        clientId: u.clientId,
        clientName: `${u.clientFirstName} ${u.clientSurename}`,
        destination: u.description || label,
        travelDate: u.addedAt,
        commission: u.commission,
        agentId: u.agentId,
        agentName: `${u.agentFirstName} ${u.agentLastName}`,
        isUpsell: true,
        upsellLabel: label,
      };
    });

    return { month: monthName, bookings: [...bookings, ...upsells] };
  },

  async getMonthForwards(year: number, month: number, scope: Scope): Promise<MonthForwards> {
    const { totalCommission, dealCount } = await revenueRepository.getForwardsForMonth(year, month, effectiveOrgId(scope));

    const targetDate = new Date(year, month - 1, 1);
    const monthName = targetDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const shortMonth = targetDate.toLocaleDateString("en-GB", { month: "short" });

    const target = DEFAULT_MONTHLY_TARGETS[month] || 10000;
    const avgDealValue = dealCount > 0 ? totalCommission / dealCount : 0;

    return {
      month: monthName, shortMonth, year, monthNumber: month,
      forwards: totalCommission, target, deals: dealCount, avgDealValue,
    };
  },
};
