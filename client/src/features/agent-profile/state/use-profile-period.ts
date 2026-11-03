import { useMemo } from "react";
import { useAgentProfileMonthly, useAgentProfilePerformance } from "../api/use-agent-profile-queries";
import { findPeriod, shadedMonthKeys, yearsInWindow, type PeriodOption } from "../lib/period";
import { periodTarget, type TargetsByYear } from "../lib/period-target";
import type { AgentProfileMonthly, AgentProfilePerformance } from "../types";

export interface ProfilePeriodData {
  period: PeriodOption;
  performance: { data: AgentProfilePerformance | undefined; isLoading: boolean; isError: boolean };
  /** Pro-rata target for the window; 0 when none is set or the targets could not be read. */
  target: number;
  /** True while the months the target depends on are still loading, so "Not set" is not shown early. */
  targetLoading: boolean;
  shaded: string[];
}

/** Monthly data is kept while the next year loads, so only trust it when it is for the year asked. */
function forYear(data: AgentProfileMonthly | undefined, year: number): AgentProfileMonthly | undefined {
  return data?.year === year ? data : undefined;
}

/** The chosen period's figures and its pro-rata target. Windows crossing New Year read both years. */
export function useProfilePeriod(userId: string, periods: PeriodOption[], periodKey: string): ProfilePeriodData {
  const period = findPeriod(periods, periodKey);
  const performance = useAgentProfilePerformance(userId, period.from, period.to);
  const years = yearsInWindow(period.from, period.to);
  const firstYear = years[0];
  const secondYear = years[1] ?? years[0];
  const first = useAgentProfileMonthly(userId, firstYear);
  const second = useAgentProfileMonthly(userId, secondYear);
  const firstData = forYear(first.data, firstYear);
  const secondData = forYear(second.data, secondYear);

  const target = useMemo(() => {
    const byYear: TargetsByYear = {};
    byYear[firstYear] = firstData?.targets;
    if (years[1] !== undefined) byYear[years[1]] = secondData?.targets;
    return periodTarget(period.from, period.to, byYear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.from, period.to, firstData, secondData]);

  const targetLoading = (!firstData && !first.isError) || (years[1] !== undefined && !secondData && !second.isError);

  return {
    period,
    performance: { data: performance.data, isLoading: performance.isLoading, isError: performance.isError },
    target,
    targetLoading,
    shaded: shadedMonthKeys(period.from, period.to),
  };
}
