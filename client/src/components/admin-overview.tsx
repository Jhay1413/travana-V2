import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  Building2,
  Calendar,
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
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTourOperators, useTransactions } from "@/hooks/queries";
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


function StatBox({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass ringed grain rounded-2xl p-4" data-testid={`stat-box-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight" data-testid={`stat-value-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>{value}</p>
            {subtext && (
              <p className="text-[10px] text-muted-foreground">{subtext}</p>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
      <motion.div
        className={cn("absolute inset-y-0 left-0 rounded-full", color)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

type TOTimePeriod = "all" | "week" | "month" | "custom";
type TOSortMode = "profit" | "bookings" | "most-profitable";

export default function AdminOverview({ apiUsers }: AdminOverviewProps) {
  const [tab, setTab] = useState("agent-performance");
  const { data: tourOperators } = useTourOperators();
  const { data: transactionsData } = useTransactions();
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
    if (!transactionsData) return { todayProfit: 0, weekProfit: 0, monthProfit: 0, salesTarget, avgBookingValue: 0, totalOpenQuotesValue: 0, bookingsCount: 0, quotesCount: 0, monthAvgBookingProfit: 0, monthBookingsCount: 0, monthOpenQuotesValue: 0, monthQuotesCount: 0 };
    
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    let todayProfit = 0;
    let weekProfit = 0;
    let monthProfit = 0;
    let totalBookingValue = 0;
    let bookingsCount = 0;
    let totalOpenQuotesValue = 0;
    let quotesCount = 0;
    let monthTotalBookingProfit = 0;
    let monthBookingsCount = 0;
    let monthOpenQuotesValue = 0;
    let monthQuotesCount = 0;

    for (const t of transactionsData) {
      if (t.booking) {
        const profit = getProfit(t.booking);
        const created = new Date(t.booking.date_created || t.created_at);
        
        if (created >= todayStart) todayProfit += profit;
        if (created >= weekStart) weekProfit += profit;
        if (created >= monthStart) monthProfit += profit;

        if (created >= monthStart && created < monthEnd) {
          totalBookingValue += profit;
          bookingsCount += 1;
          monthTotalBookingProfit += profit;
          monthBookingsCount += 1;
        }
      }
      if (t.quotes) {
        for (const q of t.quotes) {
          if (q.is_active === false) continue;
          const qStatus = (q.quote_status || "").toUpperCase();
          if (qStatus !== "BOOKED" && qStatus !== "BOOKING_CONFIRMED") {
            const qDate = new Date(q.date_created || t.created_at);
            if (qDate >= monthStart && qDate < monthEnd) {
              totalOpenQuotesValue += getProfit(q);
              quotesCount += 1;
              monthOpenQuotesValue += getProfit(q);
              monthQuotesCount += 1;
            }
          }
        }
      }
    }

    return {
      todayProfit,
      weekProfit,
      monthProfit,
      salesTarget,
      avgBookingValue: bookingsCount > 0 ? totalBookingValue / bookingsCount : 0,
      totalOpenQuotesValue,
      bookingsCount,
      quotesCount,
      monthAvgBookingProfit: monthBookingsCount > 0 ? monthTotalBookingProfit / monthBookingsCount : 0,
      monthBookingsCount,
      monthOpenQuotesValue,
      monthQuotesCount,
    };
  }, [transactionsData, shopTargetsData]);

  const agentPerformance = useMemo(() => {
    if (!transactionsData || !apiUsers) return [];

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const agents = new Map<string, { id: string; name: string; revenue: number; commission: number; bookings: number; quotes: number; totalBookingValue: number }>();

    for (const u of apiUsers as any[]) {
      agents.set(u.id, {
        id: u.id,
        name: u.firstName || u.name || u.email || "Agent",
        revenue: 0,
        commission: 0,
        bookings: 0,
        quotes: 0,
        totalBookingValue: 0,
      });
    }

    for (const t of transactionsData) {
      const agentId = t.agent_id || t.user_id;
      if (!agentId || !agents.has(agentId)) continue;
      const agent = agents.get(agentId)!;

      if (t.quotes) {
        for (const q of t.quotes) {
          if (q.is_active === false) continue;
          const qDate = new Date(q.date_created || t.created_at);
          if (qDate >= monthStart && qDate < monthEnd) {
            agent.quotes += 1;
          }
        }
      }
      if (t.booking) {
        const bDate = new Date(t.booking.date_created || t.created_at);
        if (bDate >= monthStart && bDate < monthEnd) {
          agent.bookings += 1;
          agent.revenue += parseFloat(t.booking.sales_price) || 0;
          agent.commission += getProfit(t.booking);
          agent.totalBookingValue += parseFloat(t.booking.sales_price) || 0;
        }
      }
    }

    return Array.from(agents.values())
      .sort((a, b) => b.commission - a.commission || a.name.localeCompare(b.name));
  }, [transactionsData, apiUsers]);

  const destinationRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const destMap = new Map<string, { name: string; revenue: number; bookings: number; prevRevenue: number }>();

    // Data is already filtered to current month by backend
    for (const t of transactionsData) {
      let destName: string | null = null;

      if (t.booking) {
        if (t.booking.accommodations?.[0]?.destination_name) {
          destName = t.booking.accommodations[0].destination_name;
        } else if (t.booking.title) {
          destName = t.booking.title;
        }
      }
      if (!destName && t.quotes?.[0]) {
        if (t.quotes[0].accommodations?.[0]?.destination_name) {
          destName = t.quotes[0].accommodations[0].destination_name;
        } else if (t.quotes[0].destination_name) {
          destName = t.quotes[0].destination_name;
        } else if (t.enquiry?.destinations?.[0]?.name) {
          destName = t.enquiry.destinations[0].name;
        }
      }
      if (!destName && t.enquiry?.destinations?.[0]?.name) {
        destName = t.enquiry.destinations[0].name;
      }

      if (!destName) destName = "Unspecified";

      if (!destMap.has(destName)) {
        destMap.set(destName, { name: destName, revenue: 0, bookings: 0, prevRevenue: 0 });
      }
      const entry = destMap.get(destName)!;

      if (t.booking) {
        entry.revenue += parseFloat(t.booking.sales_price) || 0;
        entry.bookings += 1;
      }
    }

    return Array.from(destMap.values())
      .filter(d => d.name !== "Unspecified")
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData]);

  const boardBasisRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const bbMap = new Map<string, { name: string; revenue: number; count: number }>();

    // Data is already filtered to current month by backend
    for (const t of transactionsData) {
      let boardBasis: string | null = null;

      if (t.booking?.accommodations?.[0]?.board_basis_name) {
        boardBasis = t.booking.accommodations[0].board_basis_name;
      } else if (t.quotes?.[0]?.accommodations?.[0]?.board_basis_name) {
        boardBasis = t.quotes[0].accommodations[0].board_basis_name;
      }

      if (!boardBasis) boardBasis = "Not Specified";

      if (!bbMap.has(boardBasis)) {
        bbMap.set(boardBasis, { name: boardBasis, revenue: 0, count: 0 });
      }
      const entry = bbMap.get(boardBasis)!;

      if (t.booking) {
        entry.revenue += parseFloat(t.booking.sales_price) || 0;
        entry.count += 1;
      }
    }

    return Array.from(bbMap.values())
      .filter(b => b.name !== "Not Specified")
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData]);

  const holidayTypeRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const htMap = new Map<string, { name: string; revenue: number; bookings: number; commission: number }>();

    // Data is already filtered to current month by backend
    for (const t of transactionsData) {
      let htName = t.holiday_type_name || "Other";

      if (!htMap.has(htName)) {
        htMap.set(htName, { name: htName, revenue: 0, bookings: 0, commission: 0 });
      }
      const entry = htMap.get(htName)!;

      if (t.booking) {
        entry.revenue += parseFloat(t.booking.sales_price) || 0;
        entry.commission += getProfit(t.booking);
        entry.bookings += 1;
      }
    }

    const order = ["Package Holiday", "Cruise Packages", "Hot Tub Breaks"];
    return Array.from(htMap.values())
      .sort((a, b) => {
        const ai = order.indexOf(a.name);
        const bi = order.indexOf(b.name);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return b.revenue - a.revenue;
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
  const maxHTRevenue = holidayTypeRevenue.length > 0 ? holidayTypeRevenue[0].revenue : 1;

  const targetPct = stats.salesTarget > 0 ? Math.round((stats.monthProfit / stats.salesTarget) * 100) : 0;

  return (
    <section className="space-y-4" data-testid="page-admin-overview">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          label="Today's Total Profit"
          value={currency.format(stats.todayProfit)}
          icon={CircleDollarSign}
          color="bg-emerald-500"
          subtext="Profit from today's bookings"
        />
        <StatBox
          label="This Week's Total"
          value={currency.format(stats.weekProfit)}
          icon={TrendingUp}
          color="bg-blue-500"
          subtext="Mon – Sun rolling total"
        />
        <StatBox
          label="This Month's Total"
          value={currency.format(stats.monthProfit)}
          icon={BarChart3}
          color="bg-purple-500"
          subtext={`${targetPct}% of sales target`}
        />
        <StatBox
          label="Agency Sales Target"
          value={currency.format(stats.salesTarget)}
          icon={Target}
          color="bg-amber-500"
          subtext={`${currency.format(stats.monthProfit)} achieved`}
        />
      </div>
      <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="card-admin-module">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Admin Overview</div>
            <div className="text-xs text-muted-foreground">
              Agency performance and revenue analytics
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-admin-overview">
              <TabsTrigger value="agent-performance" className="rounded-xl" data-testid="tab-agent-performance">
                Agent Performance
              </TabsTrigger>
              <TabsTrigger value="revenue-analytics" className="rounded-xl" data-testid="tab-revenue-analytics">
                Revenue Analytics
              </TabsTrigger>
              <TabsTrigger value="holiday-types" className="rounded-xl" data-testid="tab-holiday-types">
                Holiday Types
              </TabsTrigger>
              <TabsTrigger value="tour-operators" className="rounded-xl" data-testid="tab-tour-operators">
                Tour Operator Analytics
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Separator className="my-4 bg-black/10 dark:bg-white/10" />

        <Tabs value={tab}>
          <TabsContent value="agent-performance" className="mt-0">
            <div className="space-y-5" data-testid="panel-agent-performance">
              <p className="text-xs font-medium text-muted-foreground">
                Showing data for {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium text-muted-foreground">Average Booking Profit</p>
                  <p className="mt-1 text-xl font-bold" data-testid="stat-avg-booking-value">
                    {currencyFull.format(stats.monthAvgBookingProfit)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stats.monthBookingsCount} bookings this month</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium text-muted-foreground">Total Profit Value of Open Quotes</p>
                  <p className="mt-1 text-xl font-bold" data-testid="stat-open-quotes-value">
                    {currencyFull.format(stats.monthOpenQuotesValue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stats.monthQuotesCount} open quotes this month</p>
                </div>
              </div>

              <div>
                <h3 className="mb-3 text-sm font-semibold">Per-Agent Breakdown</h3>
                {agentPerformance.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
                    No agent data available
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" data-testid="table-agent-performance">
                      <thead>
                        <tr className="border-b border-black/10 text-left text-xs font-medium text-muted-foreground dark:border-white/10">
                          <th className="pb-2 pr-4">Agent</th>
                          <th className="pb-2 pr-4 text-right">Total Sales</th>
                          <th className="pb-2 pr-4 text-right">Commission</th>
                          <th className="pb-2 pr-4 text-right">Close Rate</th>
                          <th className="pb-2 pr-4 text-right">Avg Booking</th>
                          <th className="pb-2 pr-4 text-right">Target</th>
                          <th className="pb-2 text-right">Over/Under</th>
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
                          return (
                            <motion.tr
                              key={agent.id}
                              className="border-b border-black/5 dark:border-white/5"
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.04 }}
                              data-testid={`row-agent-${agent.id}`}
                            >
                              <td className="py-2.5 pr-4">
                                <div className="flex items-center gap-2">
                                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-500 text-[10px] font-bold text-white">
                                    {agent.name.charAt(0).toUpperCase()}
                                  </div>
                                  <span className="font-medium">{agent.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                                {currency.format(agent.revenue)}
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                                {currency.format(agent.commission)}
                              </td>
                              <td className="py-2.5 pr-4 text-right">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-semibold",
                                    closeRate >= 50
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                                      : closeRate >= 25
                                        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-400"
                                  )}
                                >
                                  {closeRate}%
                                </Badge>
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums font-medium">
                                {currency.format(avgBooking)}
                              </td>
                              <td className="py-2.5 pr-4 text-right tabular-nums text-muted-foreground" data-testid={`text-agent-target-${agent.id}`}>
                                {currency.format(agentTarget)}
                              </td>
                              <td className="py-2.5 text-right tabular-nums font-medium" data-testid={`text-agent-overunder-${agent.id}`}>
                                <span className={cn(
                                  overUnder > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : overUnder < 0
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-muted-foreground"
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="revenue-analytics" className="mt-0">
            <div className="space-y-6" data-testid="panel-revenue-analytics">
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Revenue by Destination
                  </h3>
                  {topDestinations.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-muted-foreground dark:border-white/10">
                      No destination data
                    </div>
                  ) : (
                    <div className="space-y-3" data-testid="list-destination-revenue">
                      {topDestinations.map((dest, i) => (
                        <motion.div
                          key={dest.name}
                          className="space-y-1.5"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{dest.name}</span>
                            <span className="tabular-nums text-muted-foreground">{currency.format(dest.revenue)}</span>
                          </div>
                          <ProgressBar value={dest.revenue} max={maxDestRevenue} color="bg-gradient-to-r from-blue-500 to-cyan-400" />
                          <p className="text-[10px] text-muted-foreground">{dest.bookings} booking{dest.bookings !== 1 ? "s" : ""}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <UtensilsCrossed className="h-4 w-4 text-amber-500" />
                    Revenue by Board Basis
                  </h3>
                  {boardBasisRevenue.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-muted-foreground dark:border-white/10">
                      No board basis data
                    </div>
                  ) : (
                    <div className="space-y-3" data-testid="list-board-basis-revenue">
                      {boardBasisRevenue.map((bb, i) => (
                        <motion.div
                          key={bb.name}
                          className="space-y-1.5"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.06 }}
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium">{bb.name}</span>
                            <span className="tabular-nums text-muted-foreground">{currency.format(bb.revenue)}</span>
                          </div>
                          <ProgressBar value={bb.revenue} max={maxBBRevenue} color="bg-gradient-to-r from-amber-500 to-orange-400" />
                          <p className="text-[10px] text-muted-foreground">{bb.count} booking{bb.count !== 1 ? "s" : ""}</p>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Separator className="bg-black/10 dark:bg-white/10" />

              <div className="grid gap-4 sm:grid-cols-2">
                {topDestination && (
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4" data-testid="card-top-destination">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Top Destination</p>
                    </div>
                    <p className="mt-2 text-lg font-bold">{topDestination.name}</p>
                    <p className="text-xs text-muted-foreground">{currency.format(topDestination.revenue)} revenue · {topDestination.bookings} bookings</p>
                  </div>
                )}
                {lowestDestination && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4" data-testid="card-lowest-destination">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="h-4 w-4 text-red-600" />
                      <p className="text-xs font-semibold text-red-700 dark:text-red-400">Lowest Performing Destination</p>
                    </div>
                    <p className="mt-2 text-lg font-bold">{lowestDestination.name}</p>
                    <p className="text-xs text-muted-foreground">{currency.format(lowestDestination.revenue)} revenue · {lowestDestination.bookings} bookings</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="holiday-types" className="mt-0">
            <div className="space-y-5" data-testid="panel-holiday-types">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Ship className="h-4 w-4 text-purple-500" />
                Revenue by Holiday Type
              </h3>
              <p className="text-xs text-muted-foreground -mt-3">
                Cruise, Package, City Break and more
              </p>

              {holidayTypeRevenue.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-muted-foreground dark:border-white/10">
                  No holiday type data available
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {holidayTypeRevenue.map((ht, i) => {
                    const colors = [
                      "from-blue-500 to-cyan-400",
                      "from-purple-500 to-pink-400",
                      "from-amber-500 to-orange-400",
                      "from-emerald-500 to-teal-400",
                      "from-red-500 to-rose-400",
                      "from-indigo-500 to-violet-400",
                    ];
                    const bgColors = [
                      "border-blue-500/20 bg-blue-500/5",
                      "border-purple-500/20 bg-purple-500/5",
                      "border-amber-500/20 bg-amber-500/5",
                      "border-emerald-500/20 bg-emerald-500/5",
                      "border-red-500/20 bg-red-500/5",
                      "border-indigo-500/20 bg-indigo-500/5",
                    ];
                    const colorIdx = i % colors.length;

                    return (
                      <motion.div
                        key={ht.name}
                        className={cn("rounded-2xl border p-4", bgColors[colorIdx])}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        data-testid={`card-holiday-type-${ht.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                      >
                        <p className="text-sm font-semibold">{ht.name}</p>
                        <p className="mt-1 text-xl font-bold tabular-nums">{currency.format(ht.revenue)}</p>
                        <div className="mt-2">
                          <ProgressBar
                            value={ht.revenue}
                            max={maxHTRevenue}
                            color={cn("bg-gradient-to-r", colors[colorIdx])}
                          />
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{ht.bookings} booking{ht.bookings !== 1 ? "s" : ""}</span>
                          <span>Commission: {currency.format(ht.commission)}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tour-operators" className="mt-0">
            <div className="space-y-5" data-testid="panel-tour-operators">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <Plane className="h-4 w-4 text-blue-500" />
                    Top 10 Tour Operators
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ranked by {toSortMode === "profit" ? "profit" : toSortMode === "bookings" ? "booking count" : "profit per booking"}
                    {" · "}
                    {toTimePeriod === "all" ? "All Time" : toTimePeriod === "week" ? "This Week" : toTimePeriod === "month" ? "This Month" : "Custom Range"}
                  </p>
                </div>

                <Button
                  variant="outline"
                  size="icon"
                  className={cn(
                    "h-8 w-8 shrink-0 rounded-xl border-black/10 transition-colors dark:border-white/10",
                    toFiltersOpen && "bg-black/5 dark:bg-white/10"
                  )}
                  onClick={() => setToFiltersOpen(prev => !prev)}
                  data-testid="btn-to-settings"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>

              <div
                style={{ display: toFiltersOpen ? "block" : "none" }}
                className="space-y-3 rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]"
                data-testid="panel-to-filters"
              >
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
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
                          "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
                          toTimePeriod === p.value
                            ? "bg-white shadow-sm ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/10 text-foreground"
                            : "bg-black/5 text-muted-foreground hover:text-foreground dark:bg-white/5"
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
                      <label className="text-[10px] text-muted-foreground font-medium">From</label>
                      <DatePicker
                        value={toDateFrom}
                        onChange={setToDateFrom}
                        placeholder="Start date"
                        className="h-8 w-40 text-xs"
                        data-testid="input-to-date-from"
                      />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <label className="text-[10px] text-muted-foreground font-medium">To</label>
                      <DatePicker
                        value={toDateTo}
                        onChange={setToDateTo}
                        placeholder="End date"
                        className="h-8 w-40 text-xs"
                        data-testid="input-to-date-to"
                      />
                    </div>
                  </div>
                )}

                <Separator className="bg-black/10 dark:bg-white/10" />

                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
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
                          "rounded-lg px-3 py-1.5 text-[11px] font-medium transition-colors",
                          toSortMode === s.value
                            ? "bg-white shadow-sm ring-1 ring-black/10 dark:bg-white/10 dark:ring-white/10 text-foreground"
                            : "bg-black/5 text-muted-foreground hover:text-foreground dark:bg-white/5"
                        )}
                        data-testid={`btn-to-sort-${s.value}`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {tourOperatorAnalytics.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-muted-foreground dark:border-white/10">
                  No tour operator data for this period
                </div>
              ) : (
                <div className="space-y-3" data-testid="list-tour-operator-analytics">
                  {tourOperatorAnalytics.map((to, i) => {
                    const medalColors = ["text-amber-500", "text-slate-400", "text-amber-700"];
                    const profitPerBooking = to.bookings > 0 ? to.commission / to.bookings : 0;
                    const barValue = toBarMetric === "bookings" ? to.bookings : to.commission;
                    return (
                      <motion.div
                        key={to.id}
                        className="rounded-2xl border border-black/10 bg-black/[0.02] p-4 dark:border-white/10 dark:bg-white/[0.02]"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        data-testid={`card-tour-operator-${i}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                            i < 3
                              ? "bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-950/20"
                              : "bg-black/5 dark:bg-white/5"
                          )}>
                            <span className={i < 3 ? medalColors[i] : "text-muted-foreground"}>
                              {i + 1}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-semibold">{to.name}</span>
                              <span className="shrink-0 text-sm font-bold tabular-nums">
                                {toSortMode === "bookings" ? `${to.bookings} booking${to.bookings !== 1 ? "s" : ""}` : currency.format(to.commission)}
                              </span>
                            </div>
                            <div className="mt-1.5">
                              <ProgressBar value={barValue} max={maxTOBar} color={
                                i === 0 ? "bg-gradient-to-r from-amber-500 to-yellow-400" :
                                i === 1 ? "bg-gradient-to-r from-slate-400 to-slate-300" :
                                i === 2 ? "bg-gradient-to-r from-amber-700 to-amber-500" :
                                "bg-gradient-to-r from-blue-500 to-cyan-400"
                              } />
                            </div>
                            <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                              <span>{to.bookings} booking{to.bookings !== 1 ? "s" : ""}</span>
                              <span>{to.quotes} quote{to.quotes !== 1 ? "s" : ""}</span>
                              <span className="text-emerald-600 dark:text-emerald-400">Profit: {currency.format(to.commission)}</span>
                              {toSortMode === "most-profitable" && to.bookings > 0 && (
                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-blue-300 text-blue-600 dark:border-blue-700 dark:text-blue-400">
                                  {currency.format(profitPerBooking)}/booking
                                </Badge>
                              )}
                              <span className="text-muted-foreground/60">Rev: {currency.format(to.revenue)}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </Card>
    </section>
  );
}
