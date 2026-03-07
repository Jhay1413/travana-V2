import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  Cell,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  TrendingUp,
  CalendarClock,
  Target,
  Banknote,
  BarChart3,
  TableIcon,
  ChevronRight,
  ArrowUpDown,
  Users,
} from "lucide-react";

const MONTHS_DATA = (() => {
  const now = new Date();
  const months: {
    month: string;
    shortMonth: string;
    forwards: number;
    target: number;
    deals: number;
  }[] = [];
  const targets = [10000, 10000, 12000, 12000, 15000, 15000, 12000, 10000, 10000, 12000, 15000, 12000];
  const forwardsValues = [8450, 11200, 9800, 14500, 13200, 16800, 11400, 7200, 10800, 13500, 14200, 11300];
  const dealCounts = [16, 22, 19, 28, 25, 32, 21, 14, 20, 26, 27, 22];

  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const monthName = d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const shortName = d.toLocaleDateString("en-GB", { month: "short" });
    months.push({
      month: monthName,
      shortMonth: shortName,
      forwards: forwardsValues[i],
      target: targets[i],
      deals: dealCounts[i],
    });
  }
  return months;
})();

const AGENTS_DATA = [
  { name: "Sarah Mitchell", forwards: 32500, deals: 61, avgProfit: 533 },
  { name: "Dan Roberts", forwards: 21400, deals: 38, avgProfit: 563 },
  { name: "Emma Clarke", forwards: 18200, deals: 34, avgProfit: 535 },
  { name: "James Wilson", forwards: 15600, deals: 29, avgProfit: 538 },
  { name: "Tia Morgan", forwards: 12800, deals: 24, avgProfit: 533 },
  { name: "Casey Ashman", forwards: 9200, deals: 17, avgProfit: 541 },
];

const BOOKINGS_BY_MONTH: Record<
  string,
  { client: string; destination: string; travelDate: string; commission: number; agent: string }[]
> = {};

MONTHS_DATA.forEach((m) => {
  const agents = ["Sarah Mitchell", "Dan Roberts", "Emma Clarke", "James Wilson", "Tia Morgan", "Casey Ashman"];
  const destinations = ["Tenerife", "Crete", "Majorca", "Turkey", "Egypt", "Maldives", "Barbados", "Dubai", "Lanzarote", "Rhodes"];
  const clients = [
    "John Smith", "Claire Brown", "Michael Davis", "Sophie Wilson", "David Taylor",
    "Emma White", "James Harris", "Lucy Martin", "Robert Jones", "Hannah Clark",
    "Tom Walker", "Olivia King", "George Wright", "Amy Green", "Chris Hall",
    "Megan Adams", "Paul Baker", "Katie Young", "Ryan Allen", "Sarah Scott",
  ];
  const count = m.deals;
  const bookings = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(m.month.includes("2026") ? 2026 : 2027, new Date(Date.parse(m.month.split(" ")[0] + " 1, 2000")).getMonth(), Math.floor(Math.random() * 28) + 1);
    bookings.push({
      client: clients[i % clients.length],
      destination: destinations[i % destinations.length],
      travelDate: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      commission: Math.round(m.forwards / count + (Math.random() - 0.5) * 200),
      agent: agents[i % agents.length],
    });
  }
  BOOKINGS_BY_MONTH[m.month] = bookings;
});

function fmt(v: number) {
  return "£" + v.toLocaleString("en-GB");
}

function statusColor(forwards: number, target: number) {
  const ratio = forwards / target;
  if (ratio >= 1) return "green";
  if (ratio >= 0.85) return "amber";
  return "red";
}

function statusBadge(forwards: number, target: number) {
  const color = statusColor(forwards, target);
  const diff = forwards - target;
  if (color === "green")
    return (
      <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
        +{fmt(diff)}
      </Badge>
    );
  if (color === "amber")
    return (
      <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
        {fmt(diff)}
      </Badge>
    );
  return (
    <Badge className="border-red-500/25 bg-red-500/10 text-red-700 hover:bg-red-500/10">
      {fmt(diff)}
    </Badge>
  );
}

function barColor(forwards: number, target: number) {
  const color = statusColor(forwards, target);
  if (color === "green") return "#22c55e";
  if (color === "amber") return "#f59e0b";
  return "#ef4444";
}

type SortKey = "travelDate" | "commission" | "agent";

export default function AdminFinancials() {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("commission");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const totalForwards = MONTHS_DATA.reduce((s, m) => s + m.forwards, 0);
  const total12Target = MONTHS_DATA.reduce((s, m) => s + m.target, 0);
  const nextMonthForwards = MONTHS_DATA[0]?.forwards ?? 0;
  const totalDeals = MONTHS_DATA.reduce((s, m) => s + m.deals, 0);
  const avgDealProfit = totalDeals > 0 ? Math.round(totalForwards / totalDeals) : 0;
  const nextMonthTarget = MONTHS_DATA[0]?.target ?? 10000;
  const nextMonthGap = Math.max(0, nextMonthTarget - nextMonthForwards);
  const dealsNeeded = avgDealProfit > 0 ? Math.ceil(nextMonthGap / avgDealProfit) : 0;

  const maxAgentForwards = Math.max(...AGENTS_DATA.map((a) => a.forwards));

  const sortedBookings = useMemo(() => {
    if (!selectedMonth || !BOOKINGS_BY_MONTH[selectedMonth]) return [];
    const bookings = [...BOOKINGS_BY_MONTH[selectedMonth]];
    bookings.sort((a, b) => {
      if (sortKey === "commission") return sortDir === "asc" ? a.commission - b.commission : b.commission - a.commission;
      if (sortKey === "agent") return sortDir === "asc" ? a.agent.localeCompare(b.agent) : b.agent.localeCompare(a.agent);
      return sortDir === "asc"
        ? new Date(a.travelDate).getTime() - new Date(b.travelDate).getTime()
        : new Date(b.travelDate).getTime() - new Date(a.travelDate).getTime();
    });
    return bookings;
  }, [selectedMonth, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const data = MONTHS_DATA.find((m) => m.shortMonth === label);
    if (!data) return null;
    const diff = data.forwards - data.target;
    const needed = diff < 0 && avgDealProfit > 0 ? Math.ceil(Math.abs(diff) / avgDealProfit) : 0;
    return (
      <div className="rounded-xl border border-black/10 bg-white p-3 shadow-lg" data-testid="chart-tooltip">
        <p className="text-sm font-semibold">{data.month}</p>
        <div className="mt-1.5 grid gap-1 text-xs">
          <div className="flex justify-between gap-6">
            <span className="text-black/50">Forwards</span>
            <span className="font-medium">{fmt(data.forwards)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-black/50">Target</span>
            <span className="font-medium">{fmt(data.target)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-black/50">Difference</span>
            <span className={`font-medium ${diff >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {diff >= 0 ? "+" : ""}
              {fmt(diff)}
            </span>
          </div>
          {needed > 0 && (
            <div className="flex justify-between gap-6">
              <span className="text-black/50">Deals needed</span>
              <span className="font-medium text-amber-600">{needed}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <section className="space-y-6" data-testid="section-admin-financials">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight" data-testid="heading-financials">
            Admin Revenue Dashboard
          </h2>
          <p className="mt-0.5 text-sm text-black/50 dark:text-white/50">
            Monitor future commission income ("Forwards") and track performance against monthly targets.
          </p>
        </div>
        <div className="flex gap-1.5 rounded-2xl bg-black/5 p-1 dark:bg-white/5" data-testid="toggle-view">
          <button
            onClick={() => setView("chart")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              view === "chart" ? "bg-white text-black shadow-sm dark:bg-white/10 dark:text-white" : "text-black/50 hover:text-black/70 dark:text-white/50"
            }`}
            data-testid="button-chart-view"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Chart View
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
              view === "table" ? "bg-white text-black shadow-sm dark:bg-white/10 dark:text-white" : "text-black/50 hover:text-black/70 dark:text-white/50"
            }`}
            data-testid="button-table-view"
          >
            <TableIcon className="h-3.5 w-3.5" />
            Table View
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="kpi-cards">
        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="kpi-next-month">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">Next Month Forwards</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{fmt(nextMonthForwards)}</p>
              <p className="mt-0.5 text-[11px] text-black/40 dark:text-white/40">{MONTHS_DATA[0]?.month}</p>
            </div>
            <div className="rounded-xl bg-blue-500/10 p-2">
              <CalendarClock className="h-4 w-4 text-blue-600" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="kpi-12-month">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">12 Month Forwards Total</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-bold tracking-tight">{fmt(totalForwards)}</p>
                <span className={`text-sm font-semibold ${totalForwards - total12Target >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {totalForwards - total12Target >= 0 ? "+" : ""}{fmt(totalForwards - total12Target)}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-black/40 dark:text-white/40">{totalDeals} deals · target {fmt(total12Target)}</p>
            </div>
            <div className={`rounded-xl p-2 ${totalForwards - total12Target >= 0 ? "bg-emerald-500/10" : "bg-red-500/10"}`}>
              <Banknote className={`h-4 w-4 ${totalForwards - total12Target >= 0 ? "text-emerald-600" : "text-red-600"}`} />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="kpi-avg-deal">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">Average Deal Profit</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">{fmt(avgDealProfit)}</p>
              <p className="mt-0.5 text-[11px] text-black/40 dark:text-white/40">Across {totalDeals} deals</p>
            </div>
            <div className="rounded-xl bg-violet-500/10 p-2">
              <TrendingUp className="h-4 w-4 text-violet-600" />
            </div>
          </div>
        </Card>

        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="kpi-deals-needed">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-black/50 dark:text-white/50">Deals Needed To Hit Target</p>
              <p className="mt-1 text-2xl font-bold tracking-tight">
                {dealsNeeded > 0 ? `${dealsNeeded} deals` : "On target"}
              </p>
              <p className="mt-0.5 text-[11px] text-black/40 dark:text-white/40">
                {dealsNeeded > 0 ? `${fmt(nextMonthGap)} shortfall` : "Next month covered"}
              </p>
            </div>
            <div className="rounded-xl bg-amber-500/10 p-2">
              <Target className="h-4 w-4 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {view === "chart" && (
        <Card className="rounded-2xl border-black/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="chart-forwards">
          <h3 className="mb-4 text-sm font-semibold">12 Month Forwards</h3>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={MONTHS_DATA} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="shortMonth" tick={{ fontSize: 11, fill: "rgba(0,0,0,0.45)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "rgba(0,0,0,0.45)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Bar dataKey="forwards" radius={[6, 6, 0, 0]} maxBarSize={40}>
                  {MONTHS_DATA.map((entry, i) => (
                    <Cell key={i} fill={barColor(entry.forwards, entry.target)} />
                  ))}
                </Bar>
                <Line type="monotone" dataKey="target" stroke="#6366f1" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-black/40 dark:text-white/40">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Above target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-500" /> Close to target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" /> Below target
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-6 border-t-2 border-dashed border-indigo-500" /> Monthly target
            </span>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden rounded-2xl border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="table-forwards">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold">Monthly Forwards Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-black/5 dark:border-white/5">
                <TableHead className="text-xs">Month</TableHead>
                <TableHead className="text-right text-xs">Forwards Total</TableHead>
                <TableHead className="text-right text-xs">Target</TableHead>
                <TableHead className="text-right text-xs">Over / Under</TableHead>
                <TableHead className="text-right text-xs">Deals Needed</TableHead>
                <TableHead className="text-right text-xs">Deals Count</TableHead>
                <TableHead className="text-right text-xs">Avg Deal Value</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS_DATA.map((m) => {
                const diff = m.forwards - m.target;
                const needed = diff < 0 && avgDealProfit > 0 ? Math.ceil(Math.abs(diff) / avgDealProfit) : 0;
                const avg = m.deals > 0 ? Math.round(m.forwards / m.deals) : 0;
                return (
                  <TableRow
                    key={m.month}
                    className="cursor-pointer border-black/5 transition hover:bg-black/[0.02] dark:border-white/5 dark:hover:bg-white/[0.02]"
                    onClick={() => setSelectedMonth(m.month)}
                    data-testid={`row-forwards-${m.shortMonth}`}
                  >
                    <TableCell className="text-sm font-medium">{m.month}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(m.forwards)}</TableCell>
                    <TableCell className="text-right text-sm text-black/50">{fmt(m.target)}</TableCell>
                    <TableCell className="text-right">{statusBadge(m.forwards, m.target)}</TableCell>
                    <TableCell className="text-right text-sm">
                      {needed > 0 ? (
                        <span className="text-red-600">{needed} deals</span>
                      ) : (
                        <span className="text-emerald-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">{m.deals} deals</TableCell>
                    <TableCell className="text-right text-sm text-black/50">{fmt(avg)} avg</TableCell>
                    <TableCell>
                      <ChevronRight className="h-3.5 w-3.5 text-black/25" />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="rounded-2xl border-black/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="section-agent-performance">
        <div className="mb-4 flex items-center gap-2">
          <Users className="h-4 w-4 text-black/40" />
          <h3 className="text-sm font-semibold">Agent Performance — Forwards Contribution</h3>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-black/5 dark:border-white/5">
                <TableHead className="text-xs">Agent</TableHead>
                <TableHead className="text-right text-xs">Forwards Total</TableHead>
                <TableHead className="text-right text-xs">Deals</TableHead>
                <TableHead className="text-right text-xs">Avg Profit</TableHead>
                <TableHead className="min-w-[160px] text-xs">Contribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {AGENTS_DATA.map((agent) => {
                const pct = maxAgentForwards > 0 ? (agent.forwards / maxAgentForwards) * 100 : 0;
                return (
                  <TableRow key={agent.name} className="border-black/5 dark:border-white/5" data-testid={`row-agent-${agent.name.split(" ")[0].toLowerCase()}`}>
                    <TableCell className="text-sm font-medium">{agent.name}</TableCell>
                    <TableCell className="text-right text-sm font-semibold">{fmt(agent.forwards)}</TableCell>
                    <TableCell className="text-right text-sm">{agent.deals} deals</TableCell>
                    <TableCell className="text-right text-sm">{fmt(agent.avgProfit)}</TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">{Math.round(pct)}% of top performer</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={!!selectedMonth} onOpenChange={(open) => !open && setSelectedMonth(null)}>
        <SheetContent className="w-full overflow-y-auto border-black/10 bg-white/95 backdrop-blur-xl sm:max-w-lg" data-testid="drawer-month-detail">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">{selectedMonth} — Booking Details</SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            <div className="mb-3 flex gap-2">
              {(["travelDate", "commission", "agent"] as SortKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => toggleSort(key)}
                  className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-[11px] font-medium transition ${
                    sortKey === key
                      ? "bg-blue-500/10 text-blue-700"
                      : "bg-black/5 text-black/50 hover:bg-black/10"
                  }`}
                  data-testid={`sort-${key}`}
                >
                  <ArrowUpDown className="h-3 w-3" />
                  {key === "travelDate" ? "Travel Date" : key === "commission" ? "Profit" : "Agent"}
                </button>
              ))}
            </div>
            <div className="space-y-2">
              {sortedBookings.map((b, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/5 bg-white p-3 dark:border-white/5 dark:bg-white/5"
                  data-testid={`booking-detail-${i}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{b.client}</p>
                    <div className="mt-0.5 flex items-center gap-2 text-[11px] text-black/45">
                      <span>{b.destination}</span>
                      <span>·</span>
                      <span>{b.travelDate}</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold text-emerald-600">{fmt(b.commission)}</p>
                    <p className="text-[11px] text-black/40">{b.agent}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
