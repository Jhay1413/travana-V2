import type { ChartMonth, MonthKind } from "@/features/admin-dashboard";
import { gbp } from "./money";
import type { AgentProfileMonthly } from "../types";
import { MONTH_NAMES, MONTH_SHORT } from "./dates";

export interface ProfileMonthRow {
  month: string;
  name: string;
  profitText: string;
  shareText: string;
  shaded: boolean;
}

export interface ProfileChartModel {
  year: number;
  months: ChartMonth[];
  rows: ProfileMonthRow[];
  /** False when every month is zero, so the card can say so instead of drawing nothing. */
  hasProfit: boolean;
  /** "agency" or "branch": what the share column is measured against. */
  noun: "agency" | "branch";
}

/** Whole-number share of the comparator's profit, or null when the comparator made nothing. */
export function sharePct(profit: number, comparatorProfit: number): number | null {
  return comparatorProfit > 0 ? Math.round((profit / comparatorProfit) * 100) : null;
}

/**
 * Months for the Earnings chart and table. Future months are empty, months in the selected period
 * are flagged for shading, and the share is against the agency (admins) or the branch (managers).
 */
export function buildProfileChart(monthly: AgentProfileMonthly, shaded: readonly string[]): ProfileChartModel {
  const noun = monthly.comparator.scope === "organisation" ? "agency" : "branch";
  const compare = new Map(monthly.comparator.months.map((m) => [m.month, m.profit]));
  const months: ChartMonth[] = [];
  const rows: ProfileMonthRow[] = [];

  monthly.months.forEach((p, i) => {
    const monthNo = i + 1;
    const upcoming = monthNo > monthly.currentMonth;
    const current = monthNo === monthly.currentMonth;
    const target = monthly.targets[i] ?? 0;
    const hasTarget = target > 0;
    const hasBar = !upcoming && p.profit > 0;
    const kind: MonthKind = !hasTarget ? "none" : p.profit >= target ? "on" : "under";
    const share = upcoming ? null : sharePct(p.profit, compare.get(p.month) ?? 0);
    const isShaded = shaded.includes(p.month);

    const tooltip =
      `${MONTH_NAMES[i]}${current ? " so far" : ""} ${monthly.year}: ` +
      (upcoming ? "not yet" : `${gbp(p.profit)} profit`) +
      (share !== null ? `, ${share}% of the ${monthly.comparator.scope === "organisation" ? "agency" : "branch"}` : "") +
      (hasTarget ? `, target ${gbp(target)}` : "") +
      (isShaded ? ". In the selected period." : "");

    months.push({
      month: p.month,
      name: MONTH_SHORT[i],
      commission: upcoming ? 0 : p.profit,
      target,
      hasBar,
      hasTarget,
      upcoming,
      kind,
      commissionText: upcoming ? "Not yet" : gbp(p.profit),
      targetText: hasTarget ? gbp(target) : "None",
      result: "",
      tone: "plain",
      tooltip,
    });
    rows.push({
      month: p.month,
      name: MONTH_NAMES[i],
      profitText: upcoming ? "—" : gbp(p.profit),
      shareText: share === null ? "—" : `${share}%`,
      shaded: isShaded,
    });
  });

  return { year: monthly.year, months, rows, hasProfit: monthly.months.some((m) => m.profit !== 0), noun };
}
