import type { OrganizationOverviewTrendPoint } from "@/features/organization/api/organization-overview.api";
import { gbp } from "./money";

export type MonthKind = "none" | "on" | "under";
export type ResultTone = "plain" | "good" | "warn";

export interface ChartMonth {
  month: string;
  name: string;
  commission: number;
  target: number;
  hasBar: boolean;
  hasTarget: boolean;
  upcoming: boolean;
  kind: MonthKind;
  commissionText: string;
  targetText: string;
  result: string;
  tone: ResultTone;
  tooltip: string;
}

const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthName(yyyyDashMm: string): string {
  const m = Number(yyyyDashMm.split("-")[1]);
  return SHORT[m - 1] ?? yyyyDashMm;
}

function isAfter(yyyyDashMm: string, current: { year: number; month: number }): boolean {
  const [y, m] = yyyyDashMm.split("-").map(Number);
  return y > current.year || (y === current.year && m > current.month);
}

export function buildChartMonths(
  trend: OrganizationOverviewTrendPoint[],
  current: { year: number; month: number },
): ChartMonth[] {
  return trend.map((p) => {
    const name = monthName(p.month);
    const hasTarget = p.target > 0;
    const hasBar = p.commission > 0;
    const upcoming = isAfter(p.month, current);
    const kind: MonthKind = !hasTarget ? "none" : p.commission >= p.target ? "on" : "under";
    const diff = p.commission - p.target;

    let result: string;
    let tone: ResultTone = "plain";
    if (upcoming) result = "Upcoming";
    else if (kind === "none") result = "No target set";
    else if (kind === "on") {
      result = diff === 0 ? "On target" : `${gbp(diff)} over`;
      tone = "good";
    } else {
      result = `${gbp(-diff)} under`;
      tone = "warn";
    }

    const tooltip =
      `${name}: ${hasBar ? `${gbp(p.commission)} commission` : "no commission yet"}` +
      (hasTarget ? `, target ${gbp(p.target)}` : ", no target set") +
      (hasBar && hasTarget ? `, ${kind === "on" ? "on or over target" : `under target by ${gbp(-diff)}`}` : "");

    return {
      month: p.month,
      name,
      commission: p.commission,
      target: p.target,
      hasBar,
      hasTarget,
      upcoming,
      kind,
      commissionText: upcoming ? "Not yet" : gbp(p.commission),
      targetText: hasTarget ? gbp(p.target) : "None",
      result,
      tone,
      tooltip,
    };
  });
}

/** Round the top of the axis up to a tidy number so four equal steps read cleanly. */
export function niceAxis(maxValue: number, steps = 4): { max: number; ticks: number[] } {
  const raw = maxValue > 0 ? maxValue / steps : 250;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = ([1, 2, 2.5, 5, 10].map((n) => n * mag).find((s) => s >= raw) ?? 10 * mag);
  return { max: step * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => step * i) };
}
