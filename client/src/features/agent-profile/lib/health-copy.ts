// Path import on purpose: the admin-dashboard index pulls in recharts, which node unit tests cannot load.
import { BENCHMARK_COMMISSION_RATE, rateBarPct, viewsSub } from "@/features/admin-dashboard/lib/health-copy";
import type { AgentProfilePerformance } from "../types";
import { plural } from "./money";

export { BENCHMARK_COMMISSION_RATE, rateBarPct };

export interface HealthCopy {
  views: { value: string; sub: string };
  closeRate: { value: string; sub: string };
  commission: { value: string; barPct: number; ariaNow: number; sub: string | null };
}

export function comparatorWord(scope: AgentProfilePerformance["comparator"]["scope"]): string {
  return scope === "organisation" ? "Agency" : "Branch";
}

/** Copy for the three health tiles under the headline band. */
export function buildHealthCopy(perf: AgentProfilePerformance): HealthCopy {
  const { closeRate, quotedDeals, bookings, commissionRate, comparator } = perf;
  const rate = commissionRate;
  const avg = comparator.avgCommissionRate;
  return {
    views: { value: String(perf.quoteViews), sub: viewsSub(perf.quoteViews, perf.quotesSent) },
    closeRate: {
      value: quotedDeals > 0 ? `${Math.round(closeRate)}%` : "—",
      sub: quotedDeals > 0 ? `${plural(bookings, "booking")} from ${plural(quotedDeals, "quoted deal")}` : "No quoted deals in this period",
    },
    commission: {
      value: rate === null ? "—" : `${rate.toFixed(2)}%`,
      barPct: rate === null ? 0 : rateBarPct(rate),
      ariaNow: rate === null ? 0 : Math.min(Number(rate.toFixed(2)), BENCHMARK_COMMISSION_RATE),
      sub: avg === null ? null : `${comparatorWord(comparator.scope)} average ${avg.toFixed(2)}%`,
    },
  };
}
