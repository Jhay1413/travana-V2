import { useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { BarChart3, ChevronLeft, FileText, Percent, Receipt, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/use-role";
import { useUsers } from "@/hooks/queries";
import { useAgentTargetsByUserId } from "@/hooks/queries/use-targets-queries";
import { branchOverviewApi, organizationOverviewApi } from "@/api";
import { branchOverviewKeys } from "@/hooks/queries/use-branch-overview-queries";
import { organizationOverviewKeys } from "@/hooks/queries/use-organization-overview-queries";
import type { AgentPerformanceRange } from "@/api/endpoints/branch-overview.api";
import { ProfitStatBoxes, type ProfitStats } from "@/pages/agent-overview/profit-stat-boxes";
import { WhatsOnTab, type WhatsOnFilter } from "@/pages/agent-overview/whats-on-tab";
import { PipelineTab } from "@/pages/agent-overview/pipeline-tab";
import { ExpiringQuotesSection } from "@/pages/agent-overview/expiring-quotes-section";
import { currency } from "@/pages/agent-overview/helpers";

const RANGE_OPTIONS: { value: AgentPerformanceRange; label: string }[] = [
  { value: "day", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
];

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("") || "?";
}

function MiniStat({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="glass ringed grain rounded-2xl p-4" data-testid={`agent-stat-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tracking-tight">{value}</p>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", color)}>
          <Icon className="h-4.5 w-4.5 text-white" />
        </div>
      </div>
    </Card>
  );
}

export default function AgentStatsPage() {
  const [, params] = useRoute("/agents/:agentId");
  const [, navigate] = useLocation();
  const agentId = params?.agentId || "";
  const { orgRole } = useRole();
  const isAdmin = orgRole === "org_admin" || orgRole === "platform_admin";

  const [range, setRange] = useState<AgentPerformanceRange>("month");
  const [tab, setTab] = useState<"whats-on" | "pipeline">("whats-on");
  const [whatsOnFilter, setWhatsOnFilter] = useState<WhatsOnFilter>("today");
  const [whatsOnDate, setWhatsOnDate] = useState<string>(new Date().toISOString().slice(0, 10));

  const perfParams = useMemo(() => ({ range }), [range]);

  // Reuse the same query keys as the overview pages so navigating in from an
  // overview hits the cache. Only the hook matching the viewer's role fetches.
  const branchPerf = useQuery({
    queryKey: branchOverviewKeys.agentsPerformance(perfParams),
    queryFn: () => branchOverviewApi.getAgentsPerformance(perfParams),
    enabled: !!agentId && !isAdmin,
  });
  const orgPerf = useQuery({
    queryKey: organizationOverviewKeys.agentsPerformance(perfParams),
    queryFn: () => organizationOverviewApi.getAgentsPerformance(perfParams),
    enabled: !!agentId && isAdmin,
  });
  const perf = isAdmin ? orgPerf : branchPerf;
  const row = useMemo(
    () => (perf.data?.rows ?? []).find((r: any) => r.id === agentId) ?? null,
    [perf.data, agentId],
  );

  const { data: users } = useUsers();
  const user = useMemo(() => (users ?? []).find((u: any) => u.id === agentId), [users, agentId]);
  const { data: agentTargetsData } = useAgentTargetsByUserId(agentId);

  const name =
    (row as any)?.name ||
    (user ? [(user as any).firstName, (user as any).surename ?? (user as any).lastName].filter(Boolean).join(" ") : "") ||
    (user as any)?.name ||
    "Agent";
  const subtitle = [(user as any)?.role, (user as any)?.branchName].filter(Boolean).join(" · ");

  const agentTarget = useMemo(() => {
    const now = new Date();
    const current = (agentTargetsData ?? []).find(
      (t: any) => t.year === now.getFullYear() && t.month === now.getMonth() + 1,
    );
    return current ? parseFloat(current.targetAmount) || 0 : 0;
  }, [agentTargetsData]);

  const profitStats: ProfitStats = useMemo(() => {
    const target = agentTarget || (row as any)?.target || 0;
    return {
      todayProfit: (row as any)?.today ?? 0,
      weekProfit: (row as any)?.week ?? 0,
      monthProfit: (row as any)?.month ?? 0,
      salesTarget: target,
      agentSalesTarget: target,
      avgBookingValue: (row as any)?.avgPerBooking ?? 0,
      totalOpenQuotesValue: 0,
      bookingsCount: (row as any)?.rangeBookings ?? 0,
      quotesCount: (row as any)?.rangeQuotes ?? 0,
    };
  }, [row, agentTarget]);

  const bookings = (row as any)?.rangeBookings ?? 0;
  const quotes = (row as any)?.rangeQuotes ?? 0;
  const commission = (row as any)?.rangeCommission ?? 0;
  const avgPerBooking = (row as any)?.avgPerBooking ?? 0;
  const closeRate = quotes > 0 ? Math.round((bookings / quotes) * 100) : 0;
  const rangeLabel = RANGE_OPTIONS.find((r) => r.value === range)?.label ?? "This Month";

  return (
    <section className="space-y-4" data-testid="page-agent-stats">
      <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl"
              data-testid="button-agent-stats-back"
              onClick={() => navigate(isAdmin ? "/agency/overview" : "/branch-overview")}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div
              className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-sm font-bold text-white shadow-sm"
              data-testid="agent-stats-avatar"
            >
              {initialsFor(name)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold" data-testid="text-agent-stats-name">{name}</div>
              {subtitle && (
                <div className="truncate text-xs text-muted-foreground" data-testid="text-agent-stats-subtitle">{subtitle}</div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 rounded-2xl bg-black/5 p-1 dark:bg-white/5" data-testid="agent-stats-range">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setRange(opt.value)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-semibold transition",
                  range === opt.value
                    ? "bg-white text-black shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white",
                )}
                data-testid={`button-agent-range-${opt.value}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {perf.isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="h-7 w-7" />
        </div>
      ) : !row ? (
        <Card className="glass ringed grain rounded-3xl p-8 text-center">
          <p className="text-sm text-muted-foreground" data-testid="text-agent-stats-empty">
            No performance data found for this agent.
          </p>
        </Card>
      ) : (
        <>
          <ProfitStatBoxes profitStats={profitStats} isAgentView />

          <div className="space-y-2">
            <div className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Performance · {rangeLabel}
            </div>
            <motion.div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <MiniStat label="Bookings" value={String(bookings)} icon={Receipt} color="bg-emerald-500" />
              <MiniStat label="Quotes" value={String(quotes)} icon={FileText} color="bg-blue-500" />
              <MiniStat label="Commission" value={currency.format(commission)} icon={Wallet} color="bg-purple-500" />
              <MiniStat label="Avg / Booking" value={currency.format(avgPerBooking)} icon={BarChart3} color="bg-indigo-500" />
              <MiniStat label="Close Rate" value={`${closeRate}%`} icon={Percent} color="bg-amber-500" />
            </motion.div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="text-sm font-medium">Activity</div>
                  <div className="text-xs text-muted-foreground">Tasks and pipeline for {name}.</div>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                  <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5">
                    <TabsTrigger value="whats-on" className="rounded-xl" data-testid="tab-agent-whats-on">What's On!</TabsTrigger>
                    <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-agent-pipeline">Pipeline</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <Tabs value={tab}>
                <TabsContent value="whats-on" className="mt-0">
                  <WhatsOnTab
                    userId={agentId}
                    whatsOnFilter={whatsOnFilter}
                    whatsOnDate={whatsOnDate}
                    setWhatsOnFilter={setWhatsOnFilter}
                    setWhatsOnDate={setWhatsOnDate}
                  />
                </TabsContent>
                <TabsContent value="pipeline" className="mt-0">
                  <PipelineTab userId={agentId} tab="pipeline" />
                </TabsContent>
              </Tabs>
            </Card>

            <div className="flex flex-col gap-4">
              <ExpiringQuotesSection userId={agentId} tab="pipeline" />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
