import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Building2, Crown, Medal, Trophy, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import {
  useOrganizationAgentsPerformance,
  useOrganizationBranchesPerformance,
} from "@/hooks/queries";
import type {
  AgentPerformanceRange,
  AgentPerformanceRow,
  BranchPerformanceRow,
} from "@/api/endpoints/organization-overview.api";
import { currency } from "../organization-overview/helpers";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";

type ScopeKey = "agents" | "branches";

const SCOPES: { key: ScopeKey; label: string; icon: React.ElementType }[] = [
  { key: "agents", label: "Agents", icon: Users },
  { key: "branches", label: "Branches", icon: Building2 },
];

const RANGE_OPTIONS: { key: AgentPerformanceRange; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
  { key: "custom", label: "Date Range" },
];

const AVATAR_GRADIENTS = [
  "from-amber-400 to-orange-500",
  "from-slate-300 to-slate-400",
  "from-orange-600 to-amber-700",
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-cyan-500 to-blue-600",
];

const PODIUM_META = [
  {
    icon: Crown,
    label: "1st",
    ring: "ring-amber-400/60",
    chip: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    glow: "shadow-amber-400/30",
  },
  {
    icon: Medal,
    label: "2nd",
    ring: "ring-slate-300/60",
    chip: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200",
    glow: "shadow-slate-300/20",
  },
  {
    icon: Award,
    label: "3rd",
    ring: "ring-orange-500/50",
    chip: "bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300",
    glow: "shadow-orange-500/30",
  },
];

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return (
    parts
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 2) || "?"
  );
}

type Row = {
  id: string;
  name: string;
  subtitle: string | null;
  commission: number;
  bookings: number;
  sales: number;
  quotes: number;
  avgPerBooking: number;
  target: number;
  achievedPercent: number;
};

function toAgentRow(a: AgentPerformanceRow): Row {
  return {
    id: a.id,
    name: a.name,
    subtitle: null,
    commission: a.rangeCommission,
    bookings: a.rangeBookings,
    sales: a.rangeSales,
    quotes: a.rangeQuotes,
    avgPerBooking: a.avgPerBooking,
    target: a.target,
    achievedPercent: a.achievedPercent,
  };
}

function toBranchRow(b: BranchPerformanceRow): Row {
  return {
    id: b.id,
    name: b.name,
    subtitle: b.code,
    commission: b.rangeCommission,
    bookings: b.rangeBookings,
    sales: b.rangeSales,
    quotes: b.rangeQuotes,
    avgPerBooking: b.avgPerBooking,
    target: b.target,
    achievedPercent: b.achievedPercent,
  };
}

function rangeLabel(
  range: AgentPerformanceRange,
  customFrom: string,
  customTo: string,
): string {
  if (range === "day") return "Today";
  if (range === "week") return "This week";
  if (range === "month")
    return new Date().toLocaleDateString("en-GB", {
      month: "long",
      year: "numeric",
    });
  if (customFrom && customTo) return `${customFrom} → ${customTo}`;
  return "Pick a date range";
}

export default function AgencyLeaderboardPage() {
  const { can } = useRole();
  const [scope, setScope] = useState<ScopeKey>("agents");
  const [range, setRange] = useState<AgentPerformanceRange>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const params =
    range === "custom"
      ? { range: "custom" as const, from: customFrom, to: customTo }
      : { range };

  const agentsQuery = useOrganizationAgentsPerformance(params);
  const branchesQuery = useOrganizationBranchesPerformance(params);

  const isAgents = scope === "agents";
  const isLoading = isAgents ? agentsQuery.isLoading : branchesQuery.isLoading;
  const isError = isAgents ? agentsQuery.isError : branchesQuery.isError;

  const rows: Row[] = useMemo(() => {
    if (isAgents) return (agentsQuery.data?.rows ?? []).map(toAgentRow);
    return (branchesQuery.data?.rows ?? []).map(toBranchRow);
  }, [isAgents, agentsQuery.data, branchesQuery.data]);

  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const topCommission = rows[0]?.commission ?? 0;

  if (!can("admin", "audit")) return <OwnerOnlyGate />;

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5">
        <div className="flex items-start gap-3">
          <Trophy className="mt-1 h-5 w-5 text-amber-500" />
          <div>
            <h2 className="text-lg font-semibold">Leaderboard</h2>
            <p className="mt-1 text-sm text-black/60 dark:text-white/60">
              Rank{" "}
              {isAgents ? "agents" : "branches"}{" "}
              by commission for {rangeLabel(range, customFrom, customTo).toLowerCase()}.
            </p>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
        data-testid="leaderboard-card"
      >
        <div className="flex items-center gap-1 border-b border-gray-100 px-1.5 pt-1.5 dark:border-white/10">
          {SCOPES.map((s) => {
            const Icon = s.icon;
            const active = scope === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setScope(s.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs font-medium transition-all",
                  active
                    ? "border-b-2 border-gray-900 bg-gray-50 text-gray-900 dark:border-white dark:bg-white/5 dark:text-white"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
                )}
                data-testid={`tab-leaderboard-${s.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-medium text-gray-400">
              Showing data for {rangeLabel(range, customFrom, customTo)}
            </p>
            <div
              className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 text-xs shadow-sm dark:border-white/10 dark:bg-white/5"
              data-testid="leaderboard-range-slider"
            >
              {RANGE_OPTIONS.map((opt) => {
                const active = range === opt.key;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRange(opt.key)}
                    className={cn(
                      "rounded-full px-3 py-1 font-medium transition-all",
                      active
                        ? "bg-amber-400 text-gray-900 shadow"
                        : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
                    )}
                    data-testid={`leaderboard-range-${opt.key}`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {range === "custom" && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                From
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                  data-testid="leaderboard-range-from"
                />
              </label>
              <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                To
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                  data-testid="leaderboard-range-to"
                />
              </label>
            </div>
          )}

          {isError ? (
            <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-8 text-center dark:border-rose-500/20 dark:bg-rose-500/5">
              <p className="text-sm text-rose-500">
                Couldn't load leaderboard data.
              </p>
            </div>
          ) : isLoading ? (
            <LeaderboardSkeleton />
          ) : rows.length === 0 ? (
            <div
              className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
              data-testid="empty-leaderboard"
            >
              <Trophy className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-400">
                No {isAgents ? "agent" : "branch"} performance to rank for this
                period.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={scope + range + customFrom + customTo}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {podium.length > 0 && (
                  <Podium rows={podium} topCommission={topCommission} />
                )}

                {rest.length > 0 && (
                  <LeaderboardTable
                    rows={rest}
                    startRank={4}
                    isAgents={isAgents}
                    topCommission={topCommission}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

function Podium({
  rows,
  topCommission,
}: {
  rows: Row[];
  topCommission: number;
}) {
  const order = rows.length === 3 ? [1, 0, 2] : rows.map((_, i) => i);

  return (
    <div
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      data-testid="leaderboard-podium"
    >
      {order.map((idx) => {
        const row = rows[idx];
        if (!row) return null;
        const meta = PODIUM_META[idx];
        const Icon = meta.icon;
        const heightClass =
          idx === 0 ? "sm:pt-2" : idx === 1 ? "sm:pt-6" : "sm:pt-8";
        const share =
          topCommission > 0 ? Math.round((row.commission / topCommission) * 100) : 0;
        return (
          <motion.div
            key={row.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08, duration: 0.35 }}
            className={cn("flex flex-col", heightClass)}
            data-testid={`podium-${idx + 1}`}
          >
            <div
              className={cn(
                "relative flex flex-col items-center gap-3 rounded-2xl border bg-white p-5 text-center shadow-sm dark:bg-white/5",
                idx === 0
                  ? "border-amber-300/60 dark:border-amber-400/30"
                  : "border-gray-200 dark:border-white/10",
                "shadow-lg",
                meta.glow,
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  meta.chip,
                )}
              >
                <Icon className="h-3 w-3" />
                {meta.label}
              </span>
              <div
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-sm font-bold text-white shadow ring-2",
                  AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length],
                  meta.ring,
                )}
              >
                {initialsFor(row.name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {row.name}
                </div>
                {row.subtitle && (
                  <div className="truncate text-[11px] text-gray-400">
                    {row.subtitle}
                  </div>
                )}
              </div>
              <div className="tabular-nums text-base font-bold text-emerald-600 dark:text-emerald-400">
                {currency.format(row.commission)}
              </div>
              <div className="flex w-full items-center justify-between text-[11px] text-gray-500 dark:text-gray-400">
                <span>{row.bookings.toLocaleString()} bookings</span>
                <span>{share}% of #1</span>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

function LeaderboardTable({
  rows,
  startRank,
  isAgents,
  topCommission,
}: {
  rows: Row[];
  startRank: number;
  isAgents: boolean;
  topCommission: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
      <table className="w-full text-sm" data-testid="table-leaderboard">
        <thead>
          <tr className="bg-gray-50/80 dark:bg-white/5">
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              #
            </th>
            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              {isAgents ? "Agent" : "Branch"}
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Bookings
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Sales
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Avg. PPB
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Target
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Commission
            </th>
            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
              Achieved
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rank = startRank + i;
            const initials = initialsFor(row.name);
            const achieved = Math.round(row.achievedPercent ?? 0);
            const share =
              topCommission > 0
                ? Math.round((row.commission / topCommission) * 100)
                : 0;
            return (
              <motion.tr
                key={row.id}
                className="border-t border-gray-50 transition-colors hover:bg-gray-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04, duration: 0.25 }}
                data-testid={`row-leaderboard-${row.id}`}
              >
                <td className="px-4 py-3 text-left text-xs font-semibold tabular-nums text-gray-400">
                  {rank}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
                        AVATAR_GRADIENTS[(rank - 1) % AVATAR_GRADIENTS.length],
                      )}
                    >
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-medium text-gray-900 dark:text-white">
                        {row.name}
                      </div>
                      {row.subtitle && (
                        <div className="truncate text-[11px] text-gray-400">
                          {row.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  {row.bookings.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  {currency.format(row.sales)}
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                  {currency.format(row.avgPerBooking)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                  {currency.format(row.target)}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                      {currency.format(row.commission)}
                    </span>
                    <div className="h-1 w-24 overflow-hidden rounded-full bg-gray-100 dark:bg-white/10">
                      <motion.div
                        className="h-full rounded-full bg-emerald-400"
                        initial={{ width: 0 }}
                        animate={{ width: `${share}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      achieved >= 100
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                        : achieved >= 50
                          ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                          : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                    )}
                  >
                    {achieved}%
                  </span>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LeaderboardSkeleton() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 w-full rounded-2xl" />
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
        <div className="space-y-px">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-white px-4 py-3 dark:bg-white/[0.02]"
            >
              <Skeleton className="h-4 w-6" />
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
