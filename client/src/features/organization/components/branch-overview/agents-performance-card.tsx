import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  CalendarClock,
  Globe,
  LineChart as LineChartIcon,
  ListChecks,
  Plane,
  Users,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useAgentsPerformance,
  useBranchOverviewStats,
  useCurrentUser,
  useTourOperators,
  useTransactions,
} from "@/hooks/queries";
import { currency } from "./helpers";
import { CommissionTrendCard } from "./commission-trend-card";
import {
  SocialPostsTab,
  type SocialFilter,
} from "@/features/agent-overview/components/social-posts-tab";
import {
  WhatsOnTab,
  type WhatsOnFilter,
} from "@/features/agent-overview/components/whats-on-tab";

type TabKey =
  | "agent-performance"
  | "whats-on"
  | "social-posts"
  | "commission-trend"
  | "revenue-analytics"
  | "tour-operators";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "agent-performance", label: "Agents", icon: Users },
  { key: "whats-on", label: "What's On", icon: ListChecks },
  { key: "social-posts", label: "Social Posts", icon: CalendarClock },
  { key: "commission-trend", label: "Commission vs Target", icon: LineChartIcon },
  { key: "revenue-analytics", label: "Conversion Stats", icon: BarChart3 },
  { key: "tour-operators", label: "Tour Operators", icon: Plane },
];

const AVATAR_GRADIENTS = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-amber-500 to-orange-600",
  "from-cyan-500 to-blue-600",
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

function getProfit(item: any): number {
  return parseFloat(item?.package_commission) || 0;
}

export function AgentsPerformanceCard({
  branchId,
}: {
  branchId?: string;
} = {}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<TabKey>("agent-performance");
  const [agentRange, setAgentRange] = useState<
    "day" | "week" | "month" | "custom"
  >("month");
  const [customFrom, setCustomFrom] = useState<string>("");
  const [customTo, setCustomTo] = useState<string>("");

  const today = new Date().toISOString().slice(0, 10);
  const [socialFilter, setSocialFilter] = useState<SocialFilter>("today");
  const [socialDateFrom, setSocialDateFrom] = useState<string>(today);
  const [socialDateTo, setSocialDateTo] = useState<string>(today);

  const [whatsOnFilter, setWhatsOnFilter] = useState<WhatsOnFilter>("today");
  const [whatsOnDate, setWhatsOnDate] = useState<string>(today);
  const { data: currentUser } = useCurrentUser();
  const [whatsOnAgentId, setWhatsOnAgentId] = useState<string>("");

  useEffect(() => {
    if (!whatsOnAgentId && currentUser?.id) {
      setWhatsOnAgentId(currentUser.id);
    }
  }, [currentUser?.id, whatsOnAgentId]);

  const { data, isLoading, isError } = useAgentsPerformance(
    agentRange === "custom"
      ? { range: "custom", from: customFrom, to: customTo }
      : { range: agentRange },
    branchId,
  );
  const { data: transactionsAll } = useTransactions();
  const { data: tourOperators } = useTourOperators();
  const { data: branchStats } = useBranchOverviewStats(branchId);
  const topResorts = branchStats?.topResorts ?? [];

  const monthName = new Date().toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const agentRows = data?.rows ?? [];

  const transactionsData = useMemo(() => {
    if (!transactionsAll) return [] as any[];
    if (!branchId) return transactionsAll as any[];
    return (transactionsAll as any[]).filter((t) => t.branch_id === branchId);
  }, [transactionsAll, branchId]);

  // ---------------- Tour Operators tab data ----------------
  const tourOperatorAnalytics = useMemo(() => {
    if (!transactionsData.length) return [] as {
      id: string;
      name: string;
      revenue: number;
      bookings: number;
      commission: number;
      quotes: number;
    }[];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        revenue: number;
        bookings: number;
        commission: number;
        quotes: number;
      }
    >();
    const toName = new Map<string, string>();
    if (tourOperators) {
      for (const to of tourOperators as any[]) toName.set(to.id, to.name);
    }

    for (const t of transactionsData) {
      if (t.booking) {
        const toId = t.booking.main_tour_operator_id;
        const bDate = new Date(t.booking.date_created || t.created_at);
        if (toId && bDate >= monthStart) {
          const name = toName.get(toId) || toId;
          if (!map.has(toId))
            map.set(toId, {
              id: toId,
              name,
              revenue: 0,
              bookings: 0,
              commission: 0,
              quotes: 0,
            });
          const e = map.get(toId)!;
          e.revenue += parseFloat(t.booking.sales_price) || 0;
          e.commission += getProfit(t.booking);
          e.bookings += 1;
        }
      }
      for (const q of (t.quotes || []).filter(
        (q: any) => q.is_active !== false,
      )) {
        const toId = q.main_tour_operator_id;
        const qDate = new Date(q.date_created || t.created_at);
        if (toId && qDate >= monthStart) {
          const name = toName.get(toId) || toId;
          if (!map.has(toId))
            map.set(toId, {
              id: toId,
              name,
              revenue: 0,
              bookings: 0,
              commission: 0,
              quotes: 0,
            });
          map.get(toId)!.quotes += 1;
        }
      }
    }

    return Array.from(map.values())
      .sort((a, b) => b.commission - a.commission)
      .slice(0, 10);
  }, [transactionsData, tourOperators]);

  // ---------------- Conversion stats per agent (Revenue tab) ----------------
  const conversionStatsByAgent = useMemo(() => {
    const map = new Map<
      string,
      {
        enquiries: number;
        quotes: number;
        bookings: number;
        lost: number;
        cancelled: number;
        bookingProfit: number;
      }
    >();
    if (!transactionsData.length) return map;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const ensure = (id: string) => {
      if (!map.has(id)) {
        map.set(id, {
          enquiries: 0,
          quotes: 0,
          bookings: 0,
          lost: 0,
          cancelled: 0,
          bookingProfit: 0,
        });
      }
      return map.get(id)!;
    };

    for (const t of transactionsData) {
      const userId = t.user_id;
      if (!userId) continue;
      const txDate = new Date(t.created_at);
      if (txDate >= monthStart && txDate < monthEnd) {
        const e = ensure(userId);
        if (t.enquiry) e.enquiries += 1;
      }

      const quotes = Array.isArray(t.quotes) ? t.quotes : [];
      for (const q of quotes) {
        const qDate = new Date(q.date_created || t.created_at);
        if (qDate < monthStart || qDate >= monthEnd) continue;
        const e = ensure(userId);
        e.quotes += 1;
        if (String(q.quote_status).toUpperCase() === "LOST") e.lost += 1;
      }

      if (t.booking) {
        const bDate = new Date(t.booking.date_created || t.created_at);
        if (bDate >= monthStart && bDate < monthEnd) {
          const e = ensure(userId);
          const bStatus = String(t.booking.booking_status || "").toUpperCase();
          if (bStatus === "LOST" || bStatus === "CANCELLED") {
            e.cancelled += 1;
          } else {
            e.bookings += 1;
            e.bookingProfit += getProfit(t.booking);
          }
        }
      }
    }

    return map;
  }, [transactionsData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div
        className="rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5"
        data-testid="agents-performance-card"
      >
        <div className="flex items-center gap-1 border-b border-gray-100 px-1.5 pt-1.5 dark:border-white/10">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs font-medium transition-all",
                  active
                    ? "border-b-2 border-gray-900 bg-gray-50 text-gray-900 dark:border-white dark:bg-white/5 dark:text-white"
                    : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300",
                )}
                data-testid={`tab-${t.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {tab === "agent-performance" && (
              <motion.div
                key="agent-performance"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
                data-testid="panel-agent-performance"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium text-gray-400">
                    {agentRange === "day"
                      ? "Showing data for today"
                      : agentRange === "week"
                        ? "Showing data for this week"
                        : agentRange === "month"
                          ? `Showing data for ${monthName}`
                          : customFrom && customTo
                            ? `Showing ${customFrom} → ${customTo}`
                            : "Pick a date range"}
                  </p>
                  <div
                    className="inline-flex items-center rounded-full border border-gray-200 bg-white p-0.5 text-xs shadow-sm dark:border-white/10 dark:bg-white/5"
                    data-testid="agent-range-slider"
                  >
                    {(
                      [
                        { key: "day", label: "Day" },
                        { key: "week", label: "Week" },
                        { key: "month", label: "Month" },
                        { key: "custom", label: "Date Range" },
                      ] as const
                    ).map((opt) => {
                      const active = agentRange === opt.key;
                      return (
                        <button
                          key={opt.key}
                          type="button"
                          onClick={() => setAgentRange(opt.key)}
                          className={cn(
                            "rounded-full px-3 py-1 font-medium transition-all",
                            active
                              ? "bg-amber-400 text-gray-900 shadow"
                              : "text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white",
                          )}
                          data-testid={`agent-range-${opt.key}`}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                {agentRange === "custom" && (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      From
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                        data-testid="agent-range-from"
                      />
                    </label>
                    <label className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      To
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-white/10 dark:bg-white/5"
                        data-testid="agent-range-to"
                      />
                    </label>
                  </div>
                )}

                {isError ? (
                  <div className="rounded-2xl border border-dashed border-rose-200 bg-rose-50/50 p-8 text-center dark:border-rose-500/20 dark:bg-rose-500/5">
                    <p className="text-sm text-rose-500">
                      Couldn't load agents performance.
                    </p>
                  </div>
                ) : isLoading ? (
                  <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/10">
                    <div className="space-y-px">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 bg-white px-4 py-3 dark:bg-white/[0.02]"
                          data-testid={`row-agent-skeleton-${i}`}
                        >
                          <Skeleton className="h-8 w-8 rounded-lg" />
                          <Skeleton className="h-4 flex-1" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-12" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                          <Skeleton className="h-4 w-16" />
                        </div>
                      ))}
                    </div>
                  </div>
                ) : agentRows.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
                    data-testid="empty-agent-performance"
                  >
                    <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      No agent data available
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                    <table
                      className="w-full text-sm"
                      data-testid="table-agent-performance"
                    >
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-white/5">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Agent
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Today
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            This Week
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            This Month
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Avg. PPB
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Target
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Close Rate
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Achieved +/-
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentRows.map((agent: any, i: number) => {
                          const today = agent.today || 0;
                          const week = agent.week || 0;
                          const month = agent.month || 0;
                          const bookings = agent.rangeBookings || 0;
                          const quotes = agent.rangeQuotes || 0;
                          const closeRate =
                            quotes > 0
                              ? Math.round((bookings / quotes) * 100)
                              : 0;
                          const avgPpb = agent.avgPerBooking || 0;
                          const target = agent.target || 0;
                          const overUnder = month - target;
                          const initials = initialsFor(agent.name);
                          return (
                            <motion.tr
                              key={agent.id}
                              className="cursor-pointer border-t border-gray-50 transition-colors hover:bg-gray-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05, duration: 0.3 }}
                              onClick={() => navigate(`/agents/${agent.id}`)}
                              data-testid={`row-agent-${agent.id}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
                                      AVATAR_GRADIENTS[
                                        i % AVATAR_GRADIENTS.length
                                      ],
                                    )}
                                  >
                                    {initials}
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {agent.firstName || agent.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {currency.format(today)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {currency.format(week)}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {currency.format(month)}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {currency.format(avgPpb)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-400">
                                {currency.format(target)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    closeRate >= 50
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : closeRate >= 25
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                  )}
                                >
                                  {closeRate}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                <span
                                  className={cn(
                                    overUnder > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : overUnder < 0
                                        ? "text-red-500 dark:text-red-400"
                                        : "text-gray-400",
                                  )}
                                >
                                  {overUnder > 0 ? "+" : ""}
                                  {currency.format(overUnder)}
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {tab === "whats-on" && (
              <motion.div
                key="whats-on"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                data-testid="panel-whats-on"
              >
                <WhatsOnTab
                  userId={whatsOnAgentId === "all" ? "" : whatsOnAgentId}
                  allUsers={whatsOnAgentId === "all"}
                  whatsOnFilter={whatsOnFilter}
                  whatsOnDate={whatsOnDate}
                  setWhatsOnFilter={setWhatsOnFilter}
                  setWhatsOnDate={setWhatsOnDate}
                  extraControls={
                    <Select
                      value={whatsOnAgentId || currentUser?.id || ""}
                      onValueChange={(v) => setWhatsOnAgentId(v)}
                    >
                      <SelectTrigger
                        className="h-auto min-h-0 w-auto gap-1.5 rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 [&>svg]:size-3.5"
                        data-testid="select-whats-on-agent"
                      >
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" data-testid="option-whats-on-agent-all">
                          All Agents
                        </SelectItem>
                        {currentUser?.id && (
                          <SelectItem
                            value={currentUser.id}
                            data-testid={`option-whats-on-agent-${currentUser.id}`}
                          >
                            {currentUser.firstName || currentUser.name || "Me"} (Me)
                          </SelectItem>
                        )}
                        {agentRows
                          .filter((a: any) => a.id && a.id !== currentUser?.id)
                          .map((a: any) => (
                            <SelectItem
                              key={a.id}
                              value={a.id}
                              data-testid={`option-whats-on-agent-${a.id}`}
                            >
                              {a.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  }
                />
              </motion.div>
            )}

            {tab === "social-posts" && (
              <motion.div
                key="social-posts"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                data-testid="panel-social-posts"
              >
                <SocialPostsTab
                  tab="calendar"
                  socialFilter={socialFilter}
                  socialDateFrom={socialDateFrom}
                  socialDateTo={socialDateTo}
                  setSocialFilter={setSocialFilter}
                  setSocialDateFrom={setSocialDateFrom}
                  setSocialDateTo={setSocialDateTo}
                />
              </motion.div>
            )}

            {tab === "commission-trend" && (
              <motion.div
                key="commission-trend"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                data-testid="panel-commission-trend"
              >
                <CommissionTrendCard trend={branchStats?.trend ?? []} />
              </motion.div>
            )}

            {tab === "revenue-analytics" && (
              <motion.div
                key="revenue-analytics"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
                data-testid="panel-revenue-analytics"
              >
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Conversion Stats
                  </h3>
                  <p className="mt-0.5 text-xs font-medium text-gray-400">
                    Showing data for {monthName}
                  </p>
                </div>

                {agentRows.length === 0 ? (
                  <div
                    className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]"
                    data-testid="empty-conversion-stats"
                  >
                    <Users className="mx-auto mb-2 h-8 w-8 text-gray-300" />
                    <p className="text-sm text-gray-400">
                      No agent data available
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                    <table
                      className="w-full text-sm"
                      data-testid="table-conversion-stats"
                    >
                      <thead>
                        <tr className="bg-gray-50/80 dark:bg-white/5">
                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Agent
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Enquiries
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Quotes
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Bookings
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Lost
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Cancelled
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Avg. PPB
                          </th>
                          <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                            Close Rate
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentRows.map((agent: any, i: number) => {
                          const stats = conversionStatsByAgent.get(agent.id) ?? {
                            enquiries: 0,
                            quotes: 0,
                            bookings: 0,
                            lost: 0,
                            cancelled: 0,
                            bookingProfit: 0,
                          };
                          const avgPpb =
                            stats.bookings > 0
                              ? stats.bookingProfit / stats.bookings
                              : agent.avgPerBooking || 0;
                          const closeRate =
                            stats.quotes > 0
                              ? Math.round((stats.bookings / stats.quotes) * 100)
                              : 0;
                          const initials = initialsFor(agent.name);
                          return (
                            <motion.tr
                              key={agent.id}
                              className="border-t border-gray-50 transition-colors hover:bg-gray-50/50 dark:border-white/5 dark:hover:bg-white/[0.02]"
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05, duration: 0.3 }}
                              data-testid={`row-conversion-${agent.id}`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div
                                    className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
                                      AVATAR_GRADIENTS[
                                        i % AVATAR_GRADIENTS.length
                                      ],
                                    )}
                                  >
                                    {initials}
                                  </div>
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {agent.firstName || agent.name}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {stats.enquiries}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {stats.quotes}
                              </td>
                              <td className="px-4 py-3 text-right font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {stats.bookings}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                {stats.lost}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                                {stats.cancelled}
                              </td>
                              <td className="px-4 py-3 text-right font-medium tabular-nums text-gray-700 dark:text-gray-300">
                                {currency.format(avgPpb)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    closeRate >= 50
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : closeRate >= 25
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400",
                                  )}
                                >
                                  {closeRate}%
                                </span>
                              </td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {tab === "tour-operators" && (
              <motion.div
                key="tour-operators"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 gap-5 lg:grid-cols-2"
                data-testid="panel-tour-operators"
              >
                <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 dark:bg-violet-500/10">
                      <Plane className="h-3.5 w-3.5 text-violet-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Top 10 Tour Operators
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        Ranked by profit · {monthName}
                      </p>
                    </div>
                  </div>

                  {tourOperatorAnalytics.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No bookings in this period.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tourOperatorAnalytics.map((to, idx) => (
                          <TableRow
                            key={to.id}
                            data-testid={`row-tour-operator-${idx}`}
                          >
                            <TableCell className="text-muted-foreground tabular-nums">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {to.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {to.bookings.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {currency.format(to.commission)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10">
                      <Globe className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Top 10 Resorts
                      </h3>
                      <p className="text-[11px] text-gray-400">
                        Ranked by commission · year to date
                      </p>
                    </div>
                  </div>

                  {topResorts.length === 0 ? (
                    <div className="py-6 text-center text-xs text-muted-foreground">
                      No bookings in this period.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead className="text-right">Bookings</TableHead>
                          <TableHead className="text-right">Commission</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {topResorts.map((resort: any, idx: number) => (
                          <TableRow
                            key={`${resort.name}-${idx}`}
                            data-testid={`row-top-resort-${idx}`}
                          >
                            <TableCell className="text-muted-foreground tabular-nums">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {resort.name}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {resort.bookings.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {currency.format(resort.commission)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}
