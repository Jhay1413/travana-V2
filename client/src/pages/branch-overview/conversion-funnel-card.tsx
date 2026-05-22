import { useEffect, useMemo, useState } from "react";
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
  useAgents,
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
  const { data: currentUser } = useCurrentUser();
  const { data: branchAgents } = useAgents(branchId);

  // Date range → server-side filter. Each tab click changes the query key and
  // triggers a fresh API call instead of refiltering a stale in-memory list.
  // "all" intentionally omits the date params.
  const dateParams = useMemo(() => {
    if (range === "all") return undefined;
    const { start, end } = getRange(range);
    return { dateFrom: start.toISOString(), dateTo: end.toISOString() };
  }, [range]);

  // One undated query for dropdown options (stays populated when you switch
  // dates), one filtered query for the table data.
  const { data: optionsPool = [] } = useTransactions(
    branchId ? { branchId } : undefined,
  );
  const { data: transactionsData = [], isLoading } = useTransactions({
    ...(branchId ? { branchId } : {}),
    ...(dateParams ?? {}),
    ...(agentId !== "all" ? { agentId } : {}),
  });

  // Agent options: union of branch members + any user IDs that actually own a
  // transaction in this branch (covers admins/managers who own transactions
  // without being formal "agent" branch members). Names from useAgents.
  const agentOptions = useMemo(() => {
    const ids = new Set<string>();
    for (const a of branchAgents ?? []) {
      if (a.id) ids.add(a.id);
    }
    for (const t of optionsPool) {
      if (t.user_id) ids.add(t.user_id);
    }
    const nameById = new Map<string, string>();
    for (const a of branchAgents ?? []) {
      if (a.id) nameById.set(a.id, a.name);
    }
    return Array.from(ids)
      .map((id) => ({
        id,
        name:
          nameById.get(id) ??
          (id === currentUser?.id
            ? `${currentUser?.firstName || currentUser?.name || "Me"} (Me)`
            : "Agent"),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [optionsPool, branchAgents, currentUser]);

  // Drop the agent selection if it's no longer in the option list (e.g. branch
  // switched). Otherwise the dropdown shows nothing and the table is empty.
  useEffect(() => {
    if (agentId === "all") return;
    if (!agentOptions.some((a) => a.id === agentId)) setAgentId("all");
  }, [agentOptions, agentId]);

  // Diagnostic — surface in DevTools what the funnel sees. Remove once the
  // dropdown / data issue is settled.
  useEffect(() => {
    const sample = (transactionsData as any[])[0];
    // eslint-disable-next-line no-console
    console.log("[PipelineSynopsis]", {
      branchId,
      range,
      dateParams,
      agentId,
      transactionsCount: (transactionsData as any[]).length,
      optionsPoolCount: (optionsPool as any[]).length,
      branchAgentsCount: branchAgents?.length ?? 0,
      sampleBranchId: sample?.branch_id ?? null,
      sampleUserId: sample?.user_id ?? null,
      sampleCreatedAt: sample?.created_at ?? null,
    });
  }, [transactionsData, optionsPool, branchAgents, branchId, range, dateParams, agentId]);

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
      // Every transaction begins as an enquiry, so count any transaction
      // created in the window as one enquiry — even if it has since
      // progressed to a quote or booking. Without this, the count only
      // reflects transactions still sitting in the on_enquiry stage and
      // is largely insensitive to the date range filter.
      const txDate = new Date(t.created_at);
      if (within(txDate)) {
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
        const price = parseFloat(String(q.sales_price ?? "")) || 0;
        // Total commission = package_commission + sum of line-item commissions.
        // Server attaches service_commission (all 7 line-item tables).
        const pkgComm = parseFloat(String(q.package_commission ?? "")) || 0;
        const svcComm = Number((q as any).service_commission) || 0;
        const comm = pkgComm + svcComm;

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
          const price = parseFloat(String(t.booking.sales_price ?? "")) || 0;
          const pkgComm = parseFloat(String(t.booking.package_commission ?? "")) || 0;
          const svcComm = Number((t.booking as any).service_commission) || 0;
          const comm = pkgComm + svcComm;
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
  // Fixed book rates per pipeline stage
  const enquiryBookRate = 0.12;
  const quoteBookRate = 0.20;
  const inPlayBookRate = 0.26;

  const avgBookedCommission =
    stats.booked.count > 0 ? stats.booked.commission / stats.booked.count : 0;

  // Projection: enquiries × 12% book rate × avg commission
  const projectedFromEnquiries =
    stats.enquiries.count * enquiryBookRate * avgBookedCommission;

  // Projection: sum of quote commissions × 20% book rate
  const projectedFromQuotes = stats.quotes.commission * quoteBookRate;

  // Projection: in-play quote commissions × 26% book rate
  const projectedFromInPlay = stats.inPlay.commission * inPlayBookRate;

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
                {agentOptions.map((a) => (
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
              hint={`${stats.enquiries.count} enquiries × ${Math.round(enquiryBookRate * 100)}% book rate`}
              color="text-sky-600 dark:text-sky-400"
              bg="bg-sky-500/10"
              testId="prediction-enquiries"
            />
            <PredictionBox
              icon={FileText}
              label="Projected from Quotes"
              value={fmtCurrency(projectedFromQuotes)}
              hint={`${stats.quotes.count} quotes × ${Math.round(quoteBookRate * 100)}% book rate`}
              color="text-indigo-600 dark:text-indigo-400"
              bg="bg-indigo-500/10"
              testId="prediction-quotes"
            />
            <PredictionBox
              icon={PlayCircle}
              label="Projected from In Play"
              value={fmtCurrency(projectedFromInPlay)}
              hint={`${stats.inPlay.count} in-play × ${Math.round(inPlayBookRate * 100)}% book rate`}
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
