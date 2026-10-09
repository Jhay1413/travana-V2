import { useState } from "react";
import { Link } from "wouter";
import { CirclePlus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DashboardCard, InitialsAvatar } from "@/features/agent-overview/components/dashboard-ui";
import { useOrganizationAgentsPerformance } from "@/hooks/queries";
import { currency } from "./helpers";

type Filter = "all" | "branches" | "homeworkers";

interface StatRow {
  key: string;
  id: string;
  name: string;
  href: string;
  avatarUrl: string | null;
  isHomeworker: boolean;
  branches: Array<{ id: string; name: string; code: string | null }>;
  today: number;
  week: number;
  month: number;
  rangeBookings: number;
  avgPerBooking: number;
  target: number;
}

const HEAD = "py-2 text-[11px] font-medium text-[#7c98b0] first:rounded-l-md first:pl-3 last:rounded-r-md last:pr-3";

function branchAbbreviation(branch: { name: string; code: string | null }): string {
  const code = branch.code?.trim();
  if (code) return code.toUpperCase();
  const words = branch.name.trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 3).map((w) => w.charAt(0)).join("").toUpperCase();
  return (words[0] ?? "").slice(0, 3).toUpperCase();
}

function targetRun(r: { target: number; month: number }): number {
  return Math.max(0, r.target - r.month);
}

function dealRun(r: { target: number; month: number; avgPerBooking: number }, teamAvg: number): number | null {
  const ppb = r.avgPerBooking > 0 ? r.avgPerBooking : teamAvg;
  return ppb > 0 ? Math.ceil(targetRun(r) / ppb) : null;
}

export function MultiBranchStatsCard({ branchId }: { branchId?: string } = {}) {
  const [filter, setFilter] = useState<Filter>("all");
  const agentsQ = useOrganizationAgentsPerformance({ range: "month", branchId });

  const allRows: StatRow[] = (agentsQ.data?.rows ?? []).map((a) => ({
    key: `agent-${a.id}`,
    id: a.id,
    name: a.name,
    href: `/agents/${a.id}`,
    avatarUrl: a.avatarUrl,
    isHomeworker: a.isHomeworker === true,
    branches: a.branches ?? [],
    today: a.today,
    week: a.week,
    month: a.month,
    rangeBookings: a.rangeBookings,
    avgPerBooking: a.avgPerBooking,
    target: a.target,
  }));

  const rows =
    filter === "branches"
      ? allRows.filter((r) => !r.isHomeworker)
      : filter === "homeworkers"
        ? allRows.filter((r) => r.isHomeworker)
        : allRows;

  const isLoading = agentsQ.isLoading;
  const isError = agentsQ.isError;

  const sum = (fn: (r: StatRow) => number) => rows.reduce((s, r) => s + fn(r), 0);
  const unlistedRaw = agentsQ.data?.unlisted;
  const unlisted = {
    today: unlistedRaw?.today ?? 0,
    week: unlistedRaw?.week ?? 0,
    month: unlistedRaw?.month ?? 0,
    rangeBookings: unlistedRaw?.rangeBookings ?? 0,
  };
  const showUnlisted =
    filter === "all" && (unlisted.today !== 0 || unlisted.week !== 0 || unlisted.month !== 0);
  const extra = showUnlisted ? unlisted : { today: 0, week: 0, month: 0, rangeBookings: 0 };

  const totalMonth = sum((r) => r.month) + extra.month;
  const totalBookings = sum((r) => r.rangeBookings) + extra.rangeBookings;
  const totalAvg = totalBookings > 0 ? totalMonth / totalBookings : 0;
  const totalTargetRun = sum(targetRun);
  const totals = {
    today: sum((r) => r.today) + extra.today,
    week: sum((r) => r.week) + extra.week,
    month: totalMonth,
    avg: totalAvg,
    target: sum((r) => r.target),
    targetRun: totalTargetRun,
    dealRun: totalAvg > 0 ? Math.ceil(totalTargetRun / totalAvg) : "–",
  };

  return (
    <DashboardCard className="min-w-0" testId="card-multi-branch-stats">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Multi Branch Stats</div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger
            className="h-7 w-[88px] rounded-[6px] border-black/10 bg-white px-2 text-xs text-[#7c98b0] shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white/55"
            data-testid="select-multi-branch-filter"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All</SelectItem>
            <SelectItem value="branches" className="text-xs">Branches</SelectItem>
            <SelectItem value="homeworkers" className="text-xs">Homeworkers</SelectItem>
          </SelectContent>
        </Select>
        <Link
          href="/agency/branches"
          className="ml-auto"
          aria-label="Manage branches"
          data-testid="link-multi-branch-add"
        >
          <CirclePlus className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-2" data-testid="multi-branch-loading">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-8 text-center text-sm text-rose-500">Couldn't load agent stats.</div>
      ) : rows.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No agent data available</div>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.03] dark:bg-white/[0.04]">
                <th className={`${HEAD} text-left`}>Agent / Homeworker</th>
                {["Today", "This Week", "This Month", "Avg. PPB", "Target", "Target Run", "Deal Run"].map((h) => (
                  <th key={h} className={`${HEAD} whitespace-nowrap pl-3 text-right`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-t border-black/5 dark:border-white/10" data-testid={`row-multi-branch-${r.key}`}>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-3">
                      {r.avatarUrl ? (
                        <img src={r.avatarUrl} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                      ) : (
                        <InitialsAvatar name={r.name} className="h-9 w-9" />
                      )}
                      <Link href={r.href} className="font-semibold text-[#fe9a00] hover:underline">
                        {r.name}
                      </Link>
                      {r.branches.length > 0 && (
                        <div className="flex items-center gap-1">
                          {r.branches.map((b) => (
                            <Tooltip key={b.id}>
                              <TooltipTrigger asChild>
                                <span
                                  className="inline-flex rounded-[4px] bg-black/[0.05] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7c98b0] dark:bg-white/10 dark:text-white/60"
                                  data-testid={`badge-branch-${r.id}-${b.id}`}
                                >
                                  {branchAbbreviation(b)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>{b.name}</TooltipContent>
                            </Tooltip>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pl-3 text-right">{currency.format(r.today)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(r.week)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(r.month)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(r.avgPerBooking)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(r.target)}</td>
                  <td className="py-2 pl-3 text-right font-semibold text-[#ff0015]">{currency.format(targetRun(r))}</td>
                  <td className="py-2 pl-3 text-right">{dealRun(r, totals.avg) ?? "–"}</td>
                </tr>
              ))}
              {showUnlisted && (
                <tr className="border-t border-black/5 text-muted-foreground dark:border-white/10" data-testid="row-multi-branch-unlisted">
                  <td className="py-2 pr-2 pl-3">Other / unassigned</td>
                  <td className="py-2 pl-3 text-right">{currency.format(unlisted.today)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(unlisted.week)}</td>
                  <td className="py-2 pl-3 text-right">{currency.format(unlisted.month)}</td>
                  <td className="py-2 pl-3 text-right">–</td>
                  <td className="py-2 pl-3 text-right">–</td>
                  <td className="py-2 pl-3 text-right">–</td>
                  <td className="py-2 pl-3 text-right">–</td>
                </tr>
              )}
              <tr className="border-t border-black/10 dark:border-white/10" data-testid="row-multi-branch-totals">
                <td className="py-2 font-semibold text-[#fe9a00]">TOTALS</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.today)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.week)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.month)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.avg)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.target)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{currency.format(totals.targetRun)}</td>
                <td className="py-2 pl-3 text-right font-semibold">{totals.dealRun}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Targets shown here are individual agent targets. The Target card uses the agency target.
          </p>
        </div>
      )}
    </DashboardCard>
  );
}
