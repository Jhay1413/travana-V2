import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClipboardList,
  FileText,
  PlayCircle,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAgentsPerformance,
  useCurrentUser,
  useTransactions,
} from "@/hooks/queries";
import { currency } from "./helpers";

const fmtCurrency = (n: number) => currency.format(n);

type RangeKey = "today" | "week" | "month" | "ytd" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "ytd", label: "YTD" },
  { key: "all", label: "All" },
];

function getRange(key: RangeKey): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  switch (key) {
    case "today":
      return { start: today, end: tomorrow };
    case "week": {
      const dow = today.getDay();
      const start = new Date(today);
      start.setDate(today.getDate() - ((dow + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      return { start, end };
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return { start, end };
    }
    case "ytd": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear() + 1, 0, 1);
      return { start, end };
    }
    case "all":
      return { start: new Date(0), end: new Date(2999, 0, 1) };
  }
}

const STAGES = [
  {
    key: "enquiries" as const,
    label: "Enquiries",
    icon: ClipboardList,
    color: "text-sky-600 dark:text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    key: "quotes" as const,
    label: "Quotes",
    icon: FileText,
    color: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-500/10",
  },
  {
    key: "inPlay" as const,
    label: "In Play",
    icon: PlayCircle,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    key: "booked" as const,
    label: "Booked",
    icon: CheckCircle2,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    key: "lost" as const,
    label: "Lost",
    icon: XCircle,
    color: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-500/10",
  },
];

type StageKey = (typeof STAGES)[number]["key"];

type StageStat = { count: number; value: number; commission: number };

function emptyStat(): StageStat {
  return { count: 0, value: 0, commission: 0 };
}

export function ConversionFunnelCard({ branchId }: { branchId?: string } = {}) {
  const [range, setRange] = useState<RangeKey>("month");
  const [agentId, setAgentId] = useState<string>("all");
  const { data: transactionsAll, isLoading } = useTransactions();
  const { data: currentUser } = useCurrentUser();
  const { data: agentsPerf } = useAgentsPerformance(
    { range: "month" },
    branchId,
  );
  const agentRows = agentsPerf?.rows ?? [];

  const transactionsData = useMemo(() => {
    if (!transactionsAll) return [] as any[];
    let rows = transactionsAll as any[];
    if (branchId) rows = rows.filter((t) => t.branch_id === branchId);
    if (agentId !== "all") rows = rows.filter((t) => t.user_id === agentId);
    return rows;
  }, [transactionsAll, branchId, agentId]);

  const stats = useMemo(() => {
    const { start, end } = getRange(range);
    const within = (d: Date) => d >= start && d < end;
    const map: Record<StageKey, StageStat> = {
      enquiries: emptyStat(),
      quotes: emptyStat(),
      inPlay: emptyStat(),
      booked: emptyStat(),
      lost: emptyStat(),
    };

    for (const t of transactionsData) {
      const txDate = new Date(t.created_at);
      if (t.enquiry && within(txDate)) {
        map.enquiries.count += 1;
      }

      const quotes = Array.isArray(t.quotes) ? t.quotes : [];
      const hasBooked = Boolean(
        t.booking &&
          String(t.booking.booking_status || "").toUpperCase() === "BOOKED",
      );

      for (const q of quotes) {
        const qDate = new Date(q.date_created || t.created_at);
        if (!within(qDate)) continue;
        if (q.isQuoteCopy) continue;
        const status = String(q.quote_status || "").toUpperCase();
        const price = parseFloat(q.sales_price) || 0;
        const comm = parseFloat(q.package_commission) || 0;

        map.quotes.count += 1;
        map.quotes.value += price;
        map.quotes.commission += comm;

        if (status === "LOST") {
          map.lost.count += 1;
          map.lost.value += price;
        } else if (!hasBooked) {
          map.inPlay.count += 1;
          map.inPlay.value += price;
          map.inPlay.commission += comm;
        }
      }

      if (t.booking) {
        const bDate = new Date(t.booking.date_created || t.created_at);
        if (within(bDate)) {
          const bStatus = String(t.booking.booking_status || "").toUpperCase();
          const price = parseFloat(t.booking.sales_price) || 0;
          const comm = parseFloat(t.booking.package_commission) || 0;
          if (bStatus === "BOOKED") {
            map.booked.count += 1;
            map.booked.value += price;
            map.booked.commission += comm;
          } else if (bStatus === "LOST" || bStatus === "CANCELLED") {
            map.lost.count += 1;
            map.lost.value += price;
          }
        }
      }
    }

    return map;
  }, [transactionsData, range]);

  // ---------- Predictions ----------
  // Quote→Booking conversion rate from historical data within range
  const quoteToBookRate = useMemo(() => {
    const totalClosed = stats.booked.count + stats.lost.count;
    if (totalClosed === 0) return 0;
    return stats.booked.count / totalClosed;
  }, [stats]);

  // Enquiry→Quote conversion rate
  const enquiryToQuoteRate = useMemo(() => {
    if (stats.enquiries.count === 0) return 0;
    return Math.min(1, stats.quotes.count / stats.enquiries.count);
  }, [stats]);

  const avgBookedCommission =
    stats.booked.count > 0 ? stats.booked.commission / stats.booked.count : 0;

  // Projection: enquiries × enq→quote × quote→book × avg commission
  const projectedFromEnquiries =
    stats.enquiries.count *
    enquiryToQuoteRate *
    quoteToBookRate *
    avgBookedCommission;

  // Projection: sum of quote commissions × quote→book rate
  const projectedFromQuotes = stats.quotes.commission * quoteToBookRate;

  // Projection: in-play quote commissions × quote→book rate
  const projectedFromInPlay = stats.inPlay.commission * quoteToBookRate;

  const totalProjectedCommission = stats.booked.commission + projectedFromInPlay;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card
        className="glass ringed grain rounded-2xl p-4 md:p-5"
        data-testid="conversion-funnel-card"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Pipeline synopsis</div>
            <div className="text-xs text-muted-foreground">
              Conversion funnel and projected commission
            </div>
          </div>
          <div
            className="flex flex-wrap items-center gap-2"
            data-testid="pipeline-range-filters"
          >
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  range === r.key
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                }`}
                data-testid={`button-pipeline-range-${r.key}`}
              >
                {r.label}
              </button>
            ))}
            <Select value={agentId} onValueChange={(v) => setAgentId(v)}>
              <SelectTrigger
                className="h-auto min-h-0 w-auto gap-1.5 rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10 [&>svg]:size-3.5"
                data-testid="select-pipeline-agent"
              >
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" data-testid="option-pipeline-agent-all">
                  All Agents
                </SelectItem>
                {currentUser?.id && (
                  <SelectItem
                    value={currentUser.id}
                    data-testid={`option-pipeline-agent-${currentUser.id}`}
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
                      data-testid={`option-pipeline-agent-${a.id}`}
                    >
                      {a.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Left 2/3 — Pipeline table */}
          <div className="lg:col-span-2">
            <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10">
              <Table>
                <TableHeader>
                  <TableRow className="bg-black/[0.03] dark:bg-white/[0.03]">
                    <TableHead className="text-xs">Stage</TableHead>
                    <TableHead className="text-right text-xs">Count</TableHead>
                    <TableHead className="text-right text-xs">Value</TableHead>
                    <TableHead className="text-right text-xs">
                      Commission
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell colSpan={4}>
                            <Skeleton className="h-6 w-full" />
                          </TableCell>
                        </TableRow>
                      ))
                    : STAGES.map((s) => {
                        const Icon = s.icon;
                        const stat = stats[s.key];
                        const showValue = s.key !== "enquiries";
                        const showCommission =
                          s.key === "quotes" ||
                          s.key === "inPlay" ||
                          s.key === "booked";
                        return (
                          <TableRow
                            key={s.key}
                            data-testid={`row-pipeline-${s.key}`}
                          >
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div
                                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.bg}`}
                                >
                                  <Icon className={`h-3.5 w-3.5 ${s.color}`} />
                                </div>
                                <span className="text-sm font-medium">
                                  {s.label}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell
                              className="text-right text-sm font-semibold tabular-nums"
                              data-testid={`text-pipeline-${s.key}-count`}
                            >
                              {stat.count.toLocaleString()}
                            </TableCell>
                            <TableCell
                              className="text-right text-sm tabular-nums text-muted-foreground"
                              data-testid={`text-pipeline-${s.key}-value`}
                            >
                              {showValue && stat.value > 0
                                ? fmtCurrency(stat.value)
                                : "—"}
                            </TableCell>
                            <TableCell
                              className="text-right text-sm tabular-nums text-muted-foreground"
                              data-testid={`text-pipeline-${s.key}-commission`}
                            >
                              {showCommission && stat.commission > 0
                                ? fmtCurrency(stat.commission)
                                : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Right 1/3 — Predictions */}
          <div
            className="grid gap-3 lg:col-span-1"
            data-testid="pipeline-predictions"
          >
            <PredictionBox
              icon={ClipboardList}
              label="Enquiries Projections"
              value={fmtCurrency(projectedFromEnquiries)}
              hint={`${stats.enquiries.count} enquiries × ${Math.round(
                enquiryToQuoteRate * 100,
              )}% × ${Math.round(quoteToBookRate * 100)}%`}
              color="text-sky-600 dark:text-sky-400"
              bg="bg-sky-500/10"
              testId="prediction-enquiries"
            />
            <PredictionBox
              icon={FileText}
              label="Projected from Quotes"
              value={fmtCurrency(projectedFromQuotes)}
              hint={`${stats.quotes.count} quotes × ${Math.round(quoteToBookRate * 100)}% book rate`}
              color="text-indigo-600 dark:text-indigo-400"
              bg="bg-indigo-500/10"
              testId="prediction-quotes"
            />
            <PredictionBox
              icon={PlayCircle}
              label="Projected from In Play"
              value={fmtCurrency(projectedFromInPlay)}
              hint={`${stats.inPlay.count} in-play × ${Math.round(quoteToBookRate * 100)}%`}
              color="text-amber-600 dark:text-amber-400"
              bg="bg-amber-500/10"
              testId="prediction-in-play"
            />
            <PredictionBox
              icon={Sparkles}
              label="Total projected commission"
              value={fmtCurrency(totalProjectedCommission)}
              hint="Booked + in-play forecast"
              color="text-white"
              bg="bg-gradient-to-br from-emerald-500 to-emerald-700"
              highlighted
              testId="prediction-total"
            />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function PredictionBox({
  icon: Icon,
  label,
  value,
  hint,
  color,
  bg,
  highlighted = false,
  testId,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  color: string;
  bg: string;
  highlighted?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        highlighted
          ? "border-emerald-600/30 bg-gradient-to-br from-emerald-500 to-emerald-700 text-white shadow-md"
          : "border-black/10 bg-black/[0.02] dark:border-white/10 dark:bg-white/[0.02]"
      }`}
      data-testid={testId}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            highlighted ? "bg-white/20" : bg
          }`}
        >
          <Icon
            className={`h-4 w-4 ${highlighted ? "text-white" : color}`}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`text-[10px] uppercase tracking-wide ${
              highlighted ? "text-white/80" : "text-muted-foreground"
            }`}
          >
            {label}
          </div>
          <div
            className={`text-base font-bold tabular-nums ${
              highlighted ? "text-white" : ""
            }`}
          >
            {value}
          </div>
        </div>
      </div>
      {hint ? (
        <div
          className={`mt-1.5 text-[11px] ${
            highlighted ? "text-white/80" : "text-muted-foreground"
          }`}
        >
          {hint}
        </div>
      ) : null}
    </div>
  );
}
