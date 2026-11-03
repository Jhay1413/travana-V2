import { useMemo } from "react";
import { useAgentStats, useCurrentUser } from "@/hooks/queries";
import { useShopTargets, useAgentTargetsByUserId } from "@/features/reports/api/use-targets-queries";
import { londonYearMonth } from "@/lib/london-day";
import type { ProfitStats } from "../components/profit-stat-boxes";

/** Tile data for the signed-in user: server profit stats plus this month's shop and own targets. */
export function useProfitStats(): ProfitStats {
  const { data: currentUser } = useCurrentUser();
  const { data: shopTargetsData } = useShopTargets();
  const { data: agentTargetsData } = useAgentTargetsByUserId(currentUser?.id || "");
  const { data: agentStats } = useAgentStats({ enabled: !!currentUser?.id });

  const { year: nowYear, month: nowMonthNo } = londonYearMonth(new Date());
  const nowMonth = useMemo(() => ({ year: nowYear, month: nowMonthNo }), [nowYear, nowMonthNo]);

  return useMemo(() => {
    const { year, month } = nowMonth;
    const currentMonthTarget = shopTargetsData?.find((t) => t.year === year && t.month === month);
    const currentAgentTarget = agentTargetsData?.find((t) => t.year === year && t.month === month);
    return {
      todayProfit: agentStats?.todayProfit ?? 0,
      weekProfit: agentStats?.weekProfit ?? 0,
      monthProfit: agentStats?.monthProfit ?? 0,
      salesTarget: currentMonthTarget ? parseFloat(currentMonthTarget.targetAmount) || 0 : 0,
      agentSalesTarget: currentAgentTarget ? parseFloat(currentAgentTarget.targetAmount) || 0 : 0,
      avgBookingValue: agentStats?.avgBookingValue ?? 0,
      totalOpenQuotesValue: agentStats?.totalOpenQuotesValue ?? 0,
      bookingsCount: agentStats?.bookingsCount ?? 0,
      quotesCount: agentStats?.quotesCount ?? 0,
      todayBookingsCount: agentStats?.todayBookingsCount,
      weekBookingsCount: agentStats?.weekBookingsCount,
      monthBookingsCount: agentStats?.monthBookingsCount,
      monthAvgBookingValue: agentStats?.monthAvgBookingValue ?? 0,
      todayUpsellsCount: agentStats?.todayUpsellsCount,
      weekUpsellsCount: agentStats?.weekUpsellsCount,
      monthUpsellsCount: agentStats?.monthUpsellsCount,
      todayUpsellAmount: agentStats?.todayUpsellAmount,
      weekUpsellAmount: agentStats?.weekUpsellAmount,
      monthUpsellAmount: agentStats?.monthUpsellAmount,
    };
  }, [agentStats, shopTargetsData, agentTargetsData, nowMonth]);
}
