import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  Briefcase,
  CircleDollarSign,
  Globe,
  Minus,
  Percent,
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
  transactionsData: any[] | undefined;
  apiUsers: any[] | undefined;
}

function getProfit(item: any): number {
  const commission = parseFloat(item.package_commission) || 0;
  if (commission > 0) return commission;
  const salesPrice = parseFloat(item.sales_price) || 0;
  if (salesPrice > 0) return salesPrice * 0.1;
  return 0;
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

export default function AdminOverview({ transactionsData, apiUsers }: AdminOverviewProps) {
  const [tab, setTab] = useState("agent-performance");

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
    if (!transactionsData) return { todayProfit: 0, weekProfit: 0, monthProfit: 0, salesTarget: 150000, avgBookingValue: 0, totalOpenQuotesValue: 0, bookingsCount: 0, quotesCount: 0 };

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    let todayProfit = 0;
    let weekProfit = 0;
    let monthProfit = 0;
    let totalBookingValue = 0;
    let bookingsCount = 0;
    let totalOpenQuotesValue = 0;
    let quotesCount = 0;

    for (const t of transactionsData) {
      if (t.booking) {
        const profit = getProfit(t.booking);
        const sp = parseFloat(t.booking.sales_price) || 0;
        const created = new Date(t.booking.date_created || t.created_at);
        totalBookingValue += sp;
        bookingsCount += 1;

        if (created >= todayStart) todayProfit += profit;
        if (created >= weekStart) weekProfit += profit;
        if (created >= monthStart) monthProfit += profit;
      }
      if (t.quotes) {
        for (const q of t.quotes) {
          if (q.is_active === false) continue;
          const sp = parseFloat(q.sales_price) || 0;
          const qStatus = (q.quote_status || "").toUpperCase();
          if (qStatus !== "BOOKED" && qStatus !== "BOOKING_CONFIRMED") {
            totalOpenQuotesValue += sp;
            quotesCount += 1;
          }
        }
      }
    }

    return {
      todayProfit,
      weekProfit,
      monthProfit,
      salesTarget: 150000,
      avgBookingValue: bookingsCount > 0 ? totalBookingValue / bookingsCount : 0,
      totalOpenQuotesValue,
      bookingsCount,
      quotesCount,
    };
  }, [transactionsData]);

  const agentPerformance = useMemo(() => {
    if (!transactionsData || !apiUsers) return [];

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
          agent.quotes += 1;
        }
      }
      if (t.booking) {
        agent.bookings += 1;
        agent.revenue += parseFloat(t.booking.sales_price) || 0;
        agent.commission += getProfit(t.booking);
        agent.totalBookingValue += parseFloat(t.booking.sales_price) || 0;
      }
    }

    return Array.from(agents.values())
      .filter(a => a.quotes > 0 || a.bookings > 0)
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData, apiUsers]);

  const destinationRevenue = useMemo(() => {
    if (!transactionsData) return [];
    const destMap = new Map<string, { name: string; revenue: number; bookings: number; prevRevenue: number }>();

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

    return Array.from(htMap.values())
      .sort((a, b) => b.revenue - a.revenue);
  }, [transactionsData]);

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
            </TabsList>
          </Tabs>
        </div>

        <Separator className="my-4 bg-black/10 dark:bg-white/10" />

        <Tabs value={tab}>
          <TabsContent value="agent-performance" className="mt-0">
            <div className="space-y-5" data-testid="panel-agent-performance">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium text-muted-foreground">Average Booking Profit</p>
                  <p className="mt-1 text-xl font-bold" data-testid="stat-avg-booking-value">
                    {currencyFull.format(stats.avgBookingValue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stats.bookingsCount} bookings total</p>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/[0.03] p-4 dark:border-white/10 dark:bg-white/[0.03]">
                  <p className="text-xs font-medium text-muted-foreground">Total Profit Value of Open Quotes</p>
                  <p className="mt-1 text-xl font-bold" data-testid="stat-open-quotes-value">
                    {currency.format(stats.totalOpenQuotesValue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{stats.quotesCount} open quotes</p>
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
                          <th className="pb-2 pr-4 text-right">Revenue</th>
                          <th className="pb-2 pr-4 text-right">Commission</th>
                          <th className="pb-2 pr-4 text-right">Close Rate</th>
                          <th className="pb-2 text-right">Avg Booking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {agentPerformance.map((agent, i) => {
                          const closeRate = agent.quotes > 0 ? Math.round((agent.bookings / agent.quotes) * 100) : 0;
                          const avgBooking = agent.bookings > 0 ? agent.totalBookingValue / agent.bookings : 0;
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
                              <td className="py-2.5 text-right tabular-nums font-medium">
                                {currency.format(avgBooking)}
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
        </Tabs>
      </Card>
    </section>
  );
}
