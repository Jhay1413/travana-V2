import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
  ChevronRight,
  CircleDollarSign,
  Globe,
  Minus,
  Percent,
  Plane,
  Settings2,
  Ship,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTourOperators, useTransactions, useAdminOverviewStats } from "@/hooks/queries";
import { useShopTargets, useAgentTargets } from "@/hooks/queries/use-targets-queries";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const currencyFull = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 2,
});

interface AdminOverviewProps {
  apiUsers: any[] | undefined;
}

function getProfit(item: any): number {
  return parseFloat(item.package_commission) || 0;
}

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] },
};

function StatCard({
  label,
  value,
  icon: Icon,
  gradient,
  iconBg,
  subtext,
  delay = 0,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  gradient: string;
  iconBg: string;
  subtext?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border border-white/60 p-5 shadow-sm backdrop-blur-sm",
          "bg-white/80 dark:bg-white/5 dark:border-white/10"
        )}
        data-testid={`stat-box-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      >
        <div className={cn("absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-[0.08]", gradient)} />
        <div className="relative flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
            <p className="text-[28px] font-bold tracking-tight text-gray-900 dark:text-white" data-testid={`stat-value-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
              {value}
            </p>
            {subtext && (
              <p className="text-[11px] text-gray-400 font-medium">{subtext}</p>
            )}
          </div>
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl shadow-sm", iconBg)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ProgressBar({ value, max, color, height = "h-2" }: { value: number; max: number; color: string; height?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className={cn("relative w-full overflow-hidden rounded-full bg-gray-100 dark:bg-white/10", height)}>
      <motion.div
        className={cn("absolute inset-y-0 left-0 rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
      />
    </div>
  );
}

function CircularProgress({ value, max, size = 80, strokeWidth = 6 }: { value: number; max: number; size?: number; strokeWidth?: number }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={strokeWidth} className="text-gray-100 dark:text-white/10" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#targetGrad)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
        <defs>
          <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-gray-900 dark:text-white">{Math.round(pct)}%</span>
      </div>
    </div>
  );
}

type TOTimePeriod = "all" | "week" | "month" | "custom";
type TOSortMode = "profit" | "bookings" | "most-profitable";
type TabKey = "agent-performance" | "revenue-analytics" | "holiday-types" | "tour-operators";

const TABS: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "agent-performance", label: "Agents", icon: Users },
  { key: "revenue-analytics", label: "Revenue", icon: BarChart3 },
  { key: "holiday-types", label: "Holiday Types", icon: Ship },
  { key: "tour-operators", label: "Tour Operators", icon: Plane },
];

export default function AdminOverview({ apiUsers }: AdminOverviewProps) {
  const [tab, setTab] = useState<TabKey>("agent-performance");
  const { data: tourOperators } = useTourOperators();
  const { data: transactionsData } = useTransactions();
  const { data: adminStats } = useAdminOverviewStats();
  const { data: shopTargetsData } = useShopTargets();
  const { data: agentTargetsData } = useAgentTargets();
  const [toTimePeriod, setToTimePeriod] = useState<TOTimePeriod>("month");
  const [toSortMode, setToSortMode] = useState<TOSortMode>("profit");
  const [toDateFrom, setToDateFrom] = useState("");
  const [toDateTo, setToDateTo] = useState("");
  const [toFiltersOpen, setToFiltersOpen] = useState(false);

  const agentMap = useMemo(() => {
    const map = new Map<string, string>();
    if (apiUsers) {
      for (const u of apiUsers as any[]) {
        map.set(u.id, u.firstName || u.name || u.email || "Agent");
      }
    }
    return map;
  }, [apiUsers]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonthTarget = shopTargetsData?.find((t: any) => t.year === now.getFullYear() && t.month === (now.getMonth() + 1));
    const salesTarget = currentMonthTarget ? parseFloat(currentMonthTarget.targetAmount) || 0 : 0;

    return {
      todayProfit: adminStats?.todayProfit ?? 0,
      weekProfit: adminStats?.weekProfit ?? 0,
      monthProfit: adminStats?.monthProfit ?? 0,
      salesTarget,
      avgBookingValue: adminStats?.monthAvgBookingProfit ?? 0,
      totalOpenQuotesValue: adminStats?.monthOpenQuotesValue ?? 0,
      bookingsCount: adminStats?.monthBookingsCount ?? 0,
      quotesCount: adminStats?.monthQuotesCount ?? 0,
      monthAvgBookingProfit: adminStats?.monthAvgBookingProfit ?? 0,
      monthBookingsCount: adminStats?.monthBookingsCount ?? 0,
      monthOpenQuotesValue: adminStats?.monthOpenQuotesValue ?? 0,
      monthQuotesCount: adminStats?.monthQuotesCount ?? 0,
    };
  }, [adminStats, shopTargetsData]);

  const agentPerformance = useMemo(() => {
    if (!adminStats?.agentPerformance) return [];
    return adminStats.agentPerformance.map((a) => ({
      ...a,
      totalBookingValue: a.revenue,
    }));
  }, [adminStats]);

  const destinationRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const destMap = new Map<string, { name: string; revenue: number; bookings: number; prevRevenue: number }>();

    for (const t of transactionsData) {
      if (!t.booking) continue;
      const bDate = new Date(t.booking.date_created || t.created_at);
      if (bDate < monthStart || bDate >= monthEnd) continue;

      let destName: string | null = null;
      if (t.booking.accommodations?.[0]?.destination_name) {
        destName = t.booking.accommodations[0].destination_name;
      } else if (t.booking.title) {
        destName = t.booking.title;
      }
      if (!destName && t.enquiry?.destinations?.[0]?.name) {
        destName = t.enquiry.destinations[0].name;
      }
      if (!destName) destName = "Unspecified";

      if (!destMap.has(destName)) {
        destMap.set(destName, { name: destName, revenue: 0, bookings: 0, prevRevenue: 0 });
      }
      const entry = destMap.get(destName)!;
      entry.revenue += getProfit(t.booking);
      entry.bookings += 1;
    }

    return Array.from(destMap.values())
      .filter(d => d.name !== "Unspecified")
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData]);

  const boardBasisRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const bbMap = new Map<string, { name: string; revenue: number; count: number }>();

    for (const t of transactionsData) {
      if (!t.booking) continue;
      const bDate = new Date(t.booking.date_created || t.created_at);
      if (bDate < monthStart || bDate >= monthEnd) continue;

      let boardBasis: string | null = null;
      if (t.booking.accommodations?.[0]?.board_basis_name) {
        boardBasis = t.booking.accommodations[0].board_basis_name;
      } else if (t.quotes?.[0]?.accommodations?.[0]?.board_basis_name) {
        boardBasis = t.quotes[0].accommodations[0].board_basis_name;
      }
      if (!boardBasis) boardBasis = "Not Specified";

      if (!bbMap.has(boardBasis)) {
        bbMap.set(boardBasis, { name: boardBasis, revenue: 0, count: 0 });
      }
      const entry = bbMap.get(boardBasis)!;
      entry.revenue += getProfit(t.booking);
      entry.count += 1;
    }

    return Array.from(bbMap.values())
      .filter(b => b.name !== "Not Specified")
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData]);

  const holidayTypeRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const htMap = new Map<string, { name: string; revenue: number; bookings: number; commission: number }>();

    for (const t of transactionsData) {
      if (!t.booking) continue;
      const bDate = new Date(t.booking.date_created || t.created_at);
      if (bDate < monthStart || bDate >= monthEnd) continue;

      let htName = t.holiday_type_name || "Other";

      if (!htMap.has(htName)) {
        htMap.set(htName, { name: htName, revenue: 0, bookings: 0, commission: 0 });
      }
      const entry = htMap.get(htName)!;
      entry.revenue += parseFloat(t.booking.sales_price) || 0;
      entry.commission += getProfit(t.booking);
      entry.bookings += 1;
    }

    const order = ["Package Holiday", "Cruise Packages", "Hot Tub Breaks"];
    return Array.from(htMap.values())
      .sort((a, b) => {
        const ai = order.indexOf(a.name);
        const bi = order.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return b.commission - a.commission;
      });
  }, [transactionsData]);

  const toDateRange = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (toTimePeriod === "week") {
      const dayOfWeek = now.getDay() || 7;
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
      return { from: weekStart, to: null };
    }
    if (toTimePeriod === "month") {
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null };
    }
    if (toTimePeriod === "custom") {
      return {
        from: toDateFrom ? new Date(toDateFrom) : null,
        to: toDateTo ? new Date(new Date(toDateTo).getTime() + 86400000 - 1) : null,
      };
    }
    return { from: null, to: null };
  }, [toTimePeriod, toDateFrom, toDateTo]);

  const tourOperatorAnalytics = useMemo(() => {
    if (!transactionsData) return [];
    const toMap = new Map<string, { id: string; name: string; revenue: number; bookings: number; commission: number; quotes: number }>();

    const toNameMap = new Map<string, string>();
    if (tourOperators) {
      for (const to of tourOperators as any[]) {
        toNameMap.set(to.id, to.name);
      }
    }

    const inRange = (dateStr: string | null | undefined) => {
      if (!dateStr) return toTimePeriod === "all";
      const d = new Date(dateStr);
      if (toDateRange.from && d < toDateRange.from) return false;
      if (toDateRange.to && d > toDateRange.to) return false;
      return true;
    };

    for (const t of transactionsData) {
      if (t.booking) {
        const toId = t.booking.main_tour_operator_id;
        if (toId && inRange(t.booking.date_created || t.created_at)) {
          const name = toNameMap.get(toId) || toId;
          if (!toMap.has(toId)) toMap.set(toId, { id: toId, name, revenue: 0, bookings: 0, commission: 0, quotes: 0 });
          const entry = toMap.get(toId)!;
          entry.revenue += parseFloat(t.booking.sales_price) || 0;
          entry.commission += getProfit(t.booking);
          entry.bookings += 1;
        }
      }

      for (const q of (t.quotes || []).filter((q: any) => q.is_active !== false)) {
        const toId = q.main_tour_operator_id;
        if (toId && inRange(q.date_created || t.created_at)) {
          const name = toNameMap.get(toId) || toId;
          if (!toMap.has(toId)) toMap.set(toId, { id: toId, name, revenue: 0, bookings: 0, commission: 0, quotes: 0 });
          toMap.get(toId)!.quotes += 1;
        }
      }
    }

    const all = Array.from(toMap.values());

    if (toSortMode === "profit") {
      all.sort((a, b) => b.commission - a.commission);
    } else if (toSortMode === "bookings") {
      all.sort((a, b) => b.bookings - a.bookings || b.commission - a.commission);
    } else {
      all.sort((a, b) => {
        const ratioA = a.bookings > 0 ? a.commission / a.bookings : 0;
        const ratioB = b.bookings > 0 ? b.commission / b.bookings : 0;
        return ratioB - ratioA;
      });
    }

    return all.slice(0, 10);
  }, [transactionsData, tourOperators, toSortMode, toDateRange, toTimePeriod]);

  const toBarMetric = toSortMode === "bookings" ? "bookings" : "commission";
  const maxTOBar = tourOperatorAnalytics.length > 0
    ? Math.max(...tourOperatorAnalytics.map(t => toBarMetric === "bookings" ? t.bookings : t.commission), 1)
    : 1;

  const topDestinations = destinationRevenue.slice(0, 5);
  const topDestination = topDestinations[0];
  const lowestDestination = destinationRevenue.length > 1 ? destinationRevenue[destinationRevenue.length - 1] : null;
  const maxDestRevenue = topDestinations.length > 0 ? topDestinations[0].revenue : 1;
  const maxBBRevenue = boardBasisRevenue.length > 0 ? boardBasisRevenue[0].revenue : 1;
  const maxHTRevenue = holidayTypeRevenue.length > 0 ? Math.max(...holidayTypeRevenue.map(h => h.commission), 1) : 1;

  const targetPct = stats.salesTarget > 0 ? Math.round((stats.monthProfit / stats.salesTarget) * 100) : 0;
  const monthName = new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    <section className="space-y-6" data-testid="page-admin-overview">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Today's Profit"
          value={currency.format(stats.todayProfit)}
          icon={CircleDollarSign}
          gradient="bg-emerald-500"
          iconBg="bg-gradient-to-br from-emerald-500 to-emerald-600"
          subtext="From today's bookings"
          delay={0}
        />
        <StatCard
          label="This Week"
          value={currency.format(stats.weekProfit)}
          icon={TrendingUp}
          gradient="bg-blue-500"
          iconBg="bg-gradient-to-br from-blue-500 to-blue-600"
          subtext="Mon – Sun rolling total"
          delay={0.08}
        />
        <StatCard
          label="This Month"
          value={currency.format(stats.monthProfit)}
          icon={BarChart3}
          gradient="bg-violet-500"
          iconBg="bg-gradient-to-br from-violet-500 to-purple-600"
          subtext={`${targetPct}% of sales target`}
          delay={0.16}
        />
        <StatCard
          label="Sales Target"
          value={currency.format(stats.salesTarget)}
          icon={Target}
          gradient="bg-amber-500"
          iconBg="bg-gradient-to-br from-amber-500 to-orange-500"
          subtext={`${currency.format(stats.monthProfit)} achieved`}
          delay={0.24}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="rounded-2xl border border-gray-200/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <CircularProgress value={stats.monthProfit} max={stats.salesTarget || 1} size={64} strokeWidth={5} />
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Monthly Target Progress</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {currency.format(stats.monthProfit)} of {currency.format(stats.salesTarget)} · {monthName}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white" data-testid="stat-avg-booking-value">{currencyFull.format(stats.monthAvgBookingProfit)}</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Avg Booking Profit</p>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
              <div className="text-center">
                <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.monthBookingsCount}</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Bookings</p>
              </div>
              <div className="h-8 w-px bg-gray-200 dark:bg-white/10" />
              <div className="text-center">
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400" data-testid="stat-open-quotes-value">{currencyFull.format(stats.monthOpenQuotesValue)}</p>
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Open Quotes Value</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <div className="rounded-2xl border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm dark:border-white/10 dark:bg-white/5" data-testid="card-admin-module">
          <div className="flex items-center gap-1 border-b border-gray-100 px-1.5 pt-1.5 dark:border-white/10">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-t-xl px-4 py-2.5 text-xs font-medium transition-all",
                    active
                      ? "bg-gray-50 text-gray-900 dark:bg-white/5 dark:text-white border-b-2 border-gray-900 dark:border-white"
                      : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
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
                  <p className="text-xs font-medium text-gray-400">
                    Showing data for {monthName}
                  </p>

                  {agentPerformance.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10 dark:bg-white/[0.02]">
                      <Users className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">No agent data available</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-white/10">
                      <table className="w-full text-sm" data-testid="table-agent-performance">
                        <thead>
                          <tr className="bg-gray-50/80 dark:bg-white/5">
                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-400">Agent</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Sales</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Commission</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Close Rate</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Avg Booking</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Target</th>
                            <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">+/-</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agentPerformance.map((agent, i) => {
                            const closeRate = agent.quotes > 0 ? Math.round((agent.bookings / agent.quotes) * 100) : 0;
                            const avgBooking = agent.bookings > 0 ? agent.totalBookingValue / agent.bookings : 0;
                            const nowDate = new Date();
                            const agentTargetRecord = agentTargetsData?.find((t: any) => t.userId === agent.id && t.year === nowDate.getFullYear() && t.month === (nowDate.getMonth() + 1));
                            const agentTarget = agentTargetRecord ? parseFloat(agentTargetRecord.targetAmount) || 0 : 0;
                            const overUnder = agent.commission - agentTarget;
                            const initials = agent.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
                            const avatarColors = [
                              "from-blue-500 to-indigo-600",
                              "from-violet-500 to-purple-600",
                              "from-emerald-500 to-teal-600",
                              "from-rose-500 to-pink-600",
                              "from-amber-500 to-orange-600",
                              "from-cyan-500 to-blue-600",
                            ];
                            return (
                              <motion.tr
                                key={agent.id}
                                className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors dark:border-white/5 dark:hover:bg-white/[0.02]"
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05, duration: 0.3 }}
                                data-testid={`row-agent-${agent.id}`}
                              >
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className={cn(
                                      "flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-[10px] font-bold text-white shadow-sm",
                                      avatarColors[i % avatarColors.length]
                                    )}>
                                      {initials}
                                    </div>
                                    <span className="font-medium text-gray-900 dark:text-white">{agent.name}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                  {currency.format(agent.revenue)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                                  {currency.format(agent.commission)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={cn(
                                    "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                    closeRate >= 50
                                      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : closeRate >= 25
                                        ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                        : "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                                  )}>
                                    {closeRate}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-700 dark:text-gray-300">
                                  {currency.format(avgBooking)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-gray-400" data-testid={`text-agent-target-${agent.id}`}>
                                  {currency.format(agentTarget)}
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-semibold" data-testid={`text-agent-overunder-${agent.id}`}>
                                  <span className={cn(
                                    overUnder > 0
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : overUnder < 0
                                        ? "text-red-500 dark:text-red-400"
                                        : "text-gray-400"
                                  )}>
                                    {overUnder > 0 ? "+" : ""}{currency.format(overUnder)}
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

              {tab === "revenue-analytics" && (
                <motion.div
                  key="revenue-analytics"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                  data-testid="panel-revenue-analytics"
                >
                  <p className="text-xs font-medium text-gray-400">
                    Showing data for {monthName}
                  </p>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10">
                          <Globe className="h-3.5 w-3.5 text-blue-500" />
                        </div>
                        Profit by Destination
                      </h3>
                      {topDestinations.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center dark:border-white/10">
                          <p className="text-xs text-gray-400">No destination data</p>
                        </div>
                      ) : (
                        <div className="space-y-4" data-testid="list-destination-revenue">
                          {topDestinations.map((dest, i) => (
                            <motion.div
                              key={dest.name}
                              className="space-y-2"
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08, duration: 0.4 }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{dest.name}</span>
                                <span className="text-sm tabular-nums font-semibold text-gray-900 dark:text-white">{currency.format(dest.revenue)}</span>
                              </div>
                              <ProgressBar value={dest.revenue} max={maxDestRevenue} color="bg-gradient-to-r from-blue-500 to-cyan-400" />
                              <p className="text-[10px] text-gray-400">{dest.bookings} booking{dest.bookings !== 1 ? "s" : ""}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-100 bg-gray-50/30 p-5 dark:border-white/10 dark:bg-white/[0.02]">
                      <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
                          <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500" />
                        </div>
                        Profit by Board Basis
                      </h3>
                      {boardBasisRevenue.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center dark:border-white/10">
                          <p className="text-xs text-gray-400">No board basis data</p>
                        </div>
                      ) : (
                        <div className="space-y-4" data-testid="list-board-basis-revenue">
                          {boardBasisRevenue.map((bb, i) => (
                            <motion.div
                              key={bb.name}
                              className="space-y-2"
                              initial={{ opacity: 0, x: -12 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.08, duration: 0.4 }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{bb.name}</span>
                                <span className="text-sm tabular-nums font-semibold text-gray-900 dark:text-white">{currency.format(bb.revenue)}</span>
                              </div>
                              <ProgressBar value={bb.revenue} max={maxBBRevenue} color="bg-gradient-to-r from-amber-500 to-orange-400" />
                              <p className="text-[10px] text-gray-400">{bb.count} booking{bb.count !== 1 ? "s" : ""}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {topDestination && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3, duration: 0.4 }}
                        className="flex items-center gap-4 rounded-xl border border-emerald-200/60 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-4 dark:border-emerald-500/20 dark:from-emerald-500/5 dark:to-teal-500/5"
                        data-testid="card-top-destination"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-500/10">
                          <TrendingUp className="h-5 w-5 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Top Destination</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{topDestination.name}</p>
                          <p className="text-xs text-gray-500">{currency.format(topDestination.revenue)} profit · {topDestination.bookings} bookings</p>
                        </div>
                      </motion.div>
                    )}
                    {lowestDestination && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.35, duration: 0.4 }}
                        className="flex items-center gap-4 rounded-xl border border-red-200/60 bg-gradient-to-r from-red-50 to-rose-50/50 p-4 dark:border-red-500/20 dark:from-red-500/5 dark:to-rose-500/5"
                        data-testid="card-lowest-destination"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-500/10">
                          <TrendingDown className="h-5 w-5 text-red-600" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">Lowest Performing</p>
                          <p className="text-lg font-bold text-gray-900 dark:text-white">{lowestDestination.name}</p>
                          <p className="text-xs text-gray-500">{currency.format(lowestDestination.revenue)} profit · {lowestDestination.bookings} bookings</p>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {tab === "holiday-types" && (
                <motion.div
                  key="holiday-types"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-5"
                  data-testid="panel-holiday-types"
                >
                  <p className="text-xs font-medium text-gray-400">
                    Showing data for {monthName}
                  </p>

                  {holidayTypeRevenue.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10">
                      <Ship className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">No holiday type data available</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {holidayTypeRevenue.map((ht, i) => {
                        const gradients = [
                          "from-blue-500 to-cyan-400",
                          "from-violet-500 to-purple-400",
                          "from-amber-500 to-orange-400",
                          "from-emerald-500 to-teal-400",
                          "from-rose-500 to-pink-400",
                          "from-indigo-500 to-blue-400",
                        ];
                        const bgStyles = [
                          "border-blue-100 bg-gradient-to-br from-blue-50/80 to-cyan-50/40 dark:border-blue-500/20 dark:from-blue-500/5 dark:to-cyan-500/5",
                          "border-violet-100 bg-gradient-to-br from-violet-50/80 to-purple-50/40 dark:border-violet-500/20 dark:from-violet-500/5 dark:to-purple-500/5",
                          "border-amber-100 bg-gradient-to-br from-amber-50/80 to-orange-50/40 dark:border-amber-500/20 dark:from-amber-500/5 dark:to-orange-500/5",
                          "border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-teal-50/40 dark:border-emerald-500/20 dark:from-emerald-500/5 dark:to-teal-500/5",
                          "border-rose-100 bg-gradient-to-br from-rose-50/80 to-pink-50/40 dark:border-rose-500/20 dark:from-rose-500/5 dark:to-pink-500/5",
                          "border-indigo-100 bg-gradient-to-br from-indigo-50/80 to-blue-50/40 dark:border-indigo-500/20 dark:from-indigo-500/5 dark:to-blue-500/5",
                        ];
                        const colorIdx = i % gradients.length;

                        return (
                          <motion.div
                            key={ht.name}
                            className={cn("rounded-xl border p-5", bgStyles[colorIdx])}
                            initial={{ opacity: 0, scale: 0.92 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.08, duration: 0.4 }}
                            data-testid={`card-holiday-type-${ht.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                          >
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{ht.name}</p>
                            <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">{currency.format(ht.commission)}</p>
                            <div className="mt-3">
                              <ProgressBar
                                value={ht.commission}
                                max={maxHTRevenue}
                                color={cn("bg-gradient-to-r", gradients[colorIdx])}
                              />
                            </div>
                            <div className="mt-2.5 flex items-center justify-between text-[11px] text-gray-500">
                              <span>{ht.bookings} booking{ht.bookings !== 1 ? "s" : ""}</span>
                              <span className="tabular-nums">{currency.format(ht.revenue)} rev</span>
                            </div>
                          </motion.div>
                        );
                      })}
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
                  className="space-y-5"
                  data-testid="panel-tour-operators"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                        Top 10 Tour Operators
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Ranked by {toSortMode === "profit" ? "profit" : toSortMode === "bookings" ? "booking count" : "profit per booking"}
                        {" · "}
                        {toTimePeriod === "all" ? "All Time" : toTimePeriod === "week" ? "This Week" : toTimePeriod === "month" ? "This Month" : "Custom Range"}
                      </p>
                    </div>

                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-8 w-8 shrink-0 rounded-xl border-gray-200 transition-all dark:border-white/10",
                        toFiltersOpen && "bg-gray-100 dark:bg-white/10 rotate-45"
                      )}
                      onClick={() => setToFiltersOpen(prev => !prev)}
                      data-testid="btn-to-settings"
                    >
                      <Settings2 className="h-4 w-4 transition-transform" />
                    </Button>
                  </div>

                  <AnimatePresence>
                    {toFiltersOpen && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <div className="space-y-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 dark:border-white/10 dark:bg-white/[0.02]" data-testid="panel-to-filters">
                          <div>
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                              <Calendar className="h-3 w-3" /> Period
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {([
                                { value: "all" as TOTimePeriod, label: "All Time" },
                                { value: "week" as TOTimePeriod, label: "This Week" },
                                { value: "month" as TOTimePeriod, label: "This Month" },
                                { value: "custom" as TOTimePeriod, label: "Custom Range" },
                              ]).map(p => (
                                <button
                                  key={p.value}
                                  onClick={() => setToTimePeriod(p.value)}
                                  className={cn(
                                    "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                                    toTimePeriod === p.value
                                      ? "bg-white shadow-sm ring-1 ring-gray-200 text-gray-900 dark:bg-white/10 dark:ring-white/10 dark:text-white"
                                      : "text-gray-400 hover:text-gray-600 hover:bg-white/50 dark:hover:text-gray-300"
                                  )}
                                  data-testid={`btn-to-period-${p.value}`}
                                >
                                  {p.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          {toTimePeriod === "custom" && (
                            <div className="flex items-center gap-3 pt-1">
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-gray-400 font-medium">From</label>
                                <DatePicker value={toDateFrom} onChange={setToDateFrom} placeholder="Start date" className="h-8 w-40 text-xs" data-testid="input-to-date-from" />
                              </div>
                              <div className="flex items-center gap-1.5">
                                <label className="text-[10px] text-gray-400 font-medium">To</label>
                                <DatePicker value={toDateTo} onChange={setToDateTo} placeholder="End date" className="h-8 w-40 text-xs" data-testid="input-to-date-to" />
                              </div>
                            </div>
                          )}

                          <Separator className="bg-gray-100 dark:bg-white/10" />

                          <div>
                            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                              <BarChart3 className="h-3 w-3" /> Rank By
                            </p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {([
                                { value: "profit" as TOSortMode, label: "By Profit" },
                                { value: "bookings" as TOSortMode, label: "By Bookings" },
                                { value: "most-profitable" as TOSortMode, label: "Most Profitable" },
                              ]).map(s => (
                                <button
                                  key={s.value}
                                  onClick={() => setToSortMode(s.value)}
                                  className={cn(
                                    "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all",
                                    toSortMode === s.value
                                      ? "bg-white shadow-sm ring-1 ring-gray-200 text-gray-900 dark:bg-white/10 dark:ring-white/10 dark:text-white"
                                      : "text-gray-400 hover:text-gray-600 hover:bg-white/50 dark:hover:text-gray-300"
                                  )}
                                  data-testid={`btn-to-sort-${s.value}`}
                                >
                                  {s.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {tourOperatorAnalytics.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 p-8 text-center dark:border-white/10">
                      <Plane className="mx-auto h-8 w-8 text-gray-300 mb-2" />
                      <p className="text-sm text-gray-400">No tour operator data for this period</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5" data-testid="list-tour-operator-analytics">
                      {tourOperatorAnalytics.map((to, i) => {
                        const profitPerBooking = to.bookings > 0 ? to.commission / to.bookings : 0;
                        const barValue = toBarMetric === "bookings" ? to.bookings : to.commission;
                        const medalEmoji = i === 0 ? "1st" : i === 1 ? "2nd" : i === 2 ? "3rd" : `${i + 1}th`;
                        const rankColors = [
                          "bg-gradient-to-r from-amber-50 to-yellow-50 border-amber-200/60 dark:from-amber-500/5 dark:to-yellow-500/5 dark:border-amber-500/20",
                          "bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200/60 dark:from-gray-500/5 dark:to-slate-500/5 dark:border-gray-500/20",
                          "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200/60 dark:from-orange-500/5 dark:to-amber-500/5 dark:border-orange-500/20",
                        ];
                        const barColors = [
                          "bg-gradient-to-r from-amber-500 to-yellow-400",
                          "bg-gradient-to-r from-slate-400 to-gray-300",
                          "bg-gradient-to-r from-orange-500 to-amber-400",
                        ];
                        return (
                          <motion.div
                            key={to.id}
                            className={cn(
                              "rounded-xl border p-4 transition-all hover:shadow-sm",
                              i < 3 ? rankColors[i] : "border-gray-100 bg-white/50 dark:border-white/10 dark:bg-white/[0.02]"
                            )}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06, duration: 0.4 }}
                            data-testid={`card-tour-operator-${i}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={cn(
                                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                                i < 3
                                  ? "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 dark:from-amber-900/30 dark:to-amber-950/20 dark:text-amber-400"
                                  : "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
                              )}>
                                {i + 1}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{to.name}</span>
                                  <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900 dark:text-white">
                                    {toSortMode === "bookings" ? `${to.bookings} booking${to.bookings !== 1 ? "s" : ""}` : currency.format(to.commission)}
                                  </span>
                                </div>
                                <div className="mt-2">
                                  <ProgressBar value={barValue} max={maxTOBar} color={i < 3 ? barColors[i] : "bg-gradient-to-r from-blue-500 to-cyan-400"} />
                                </div>
                                <div className="mt-2 flex items-center gap-3 text-[10px] text-gray-400">
                                  <span>{to.bookings} booking{to.bookings !== 1 ? "s" : ""}</span>
                                  <span className="text-gray-200 dark:text-white/10">|</span>
                                  <span>{to.quotes} quote{to.quotes !== 1 ? "s" : ""}</span>
                                  <span className="text-gray-200 dark:text-white/10">|</span>
                                  <span className="text-emerald-500 font-medium">{currency.format(to.commission)} profit</span>
                                  {toSortMode === "most-profitable" && to.bookings > 0 && (
                                    <>
                                      <span className="text-gray-200 dark:text-white/10">|</span>
                                      <span className="text-blue-500 font-medium">{currency.format(profitPerBooking)}/booking</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
