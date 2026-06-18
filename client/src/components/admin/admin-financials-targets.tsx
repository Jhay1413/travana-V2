import { useState, useMemo, useCallback, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Wand2,
  Pencil,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Users,
  Store,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { 
  useTargetsOverview, 
  useUpsertShopTargets, 
  useUpsertAgentTargets,
  useMonthBookings,
} from "@/hooks/queries";
import type { ShopTargetInput, AgentTargetInput } from "@/features/reports/types/targets/targets.types";

function generateMonths(count: number) {
  const now = new Date();
  const months: { key: string; label: string; short: string; monthNum: number; year: number }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      short: d.toLocaleDateString("en-GB", { month: "short" }),
      monthNum: d.getMonth(),
      year: d.getFullYear(),
    });
  }
  return months;
}

const MONTHS = generateMonths(24);

function fmt(v: number) {
  return "£" + v.toLocaleString("en-GB");
}

function statusInfo(diff: number) {
  if (Math.abs(diff) < 500) return { label: "Balanced", color: "emerald" as const };
  if (diff > 0) return { label: "Over", color: "red" as const };
  return { label: "Under", color: "amber" as const };
}

function StatusBadge({ diff }: { diff: number }) {
  const s = statusInfo(diff);
  const cls = s.color === "emerald"
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
    : s.color === "red"
    ? "border-red-500/25 bg-red-500/10 text-red-700"
    : "border-amber-500/25 bg-amber-500/10 text-amber-700";
  return <Badge className={`${cls} hover:${cls}`}>{s.label}</Badge>;
}

function LiveProjectionsCard({
  agents,
  agentTargets,
  shopTargets,
}: {
  agents: { id: string; name: string }[];
  agentTargets: Record<string, Record<string, number>>;
  shopTargets: Record<string, number>;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthLabel = now.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const daysInMonth = new Date(year, month, 0).getDate();
  const dayOfMonth = Math.min(now.getDate(), daysInMonth);
  const runRateFactor = dayOfMonth > 0 ? daysInMonth / dayOfMonth : 1;

  const { data: monthBookings, isLoading } = useMonthBookings(year, month);

  const liveByAgent = useMemo(() => {
    const map: Record<string, number> = {};
    (monthBookings?.bookings ?? []).forEach((b) => {
      map[b.agentId] = (map[b.agentId] ?? 0) + (b.commission ?? 0);
    });
    return map;
  }, [monthBookings]);

  const shopTarget = shopTargets[monthKey] ?? 0;
  const shopLive = agents.reduce((s, a) => s + (liveByAgent[a.id] ?? 0), 0);
  const shopProjected = shopLive * runRateFactor;
  const shopPctOfTarget = shopTarget > 0 ? Math.round((shopProjected / shopTarget) * 100) : 0;
  const shopOnTrack = shopProjected >= shopTarget;

  return (
    <Card
      className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5"
      data-testid="card-live-projections"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-blue-500" /> Live & Projections
          </h3>
          <p className="mt-0.5 text-[11px] text-black/40">
            {monthLabel} · day {dayOfMonth} of {daysInMonth} · projected from run-rate
          </p>
        </div>
        <div
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
            shopOnTrack
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700"
              : "border-amber-500/25 bg-amber-500/10 text-amber-700"
          }`}
          data-testid="badge-shop-projection"
        >
          {shopOnTrack ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5" />
          )}
          <span>
            Shop: {fmt(shopProjected)} / {fmt(shopTarget)} ({shopPctOfTarget}%)
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 py-6 text-xs text-black/50">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading live sales…
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5">
                <th className="px-3 py-2 text-left text-xs font-medium text-black/50">Agent</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-black/50">Target</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-black/50">Live MTD</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-black/50">Projected</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-black/50">vs Target</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-black/50">Status</th>
              </tr>
            </thead>
            <tbody>
              {agents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-xs text-black/40">
                    No agents with targets yet.
                  </td>
                </tr>
              ) : (
                agents.map((a) => {
                  const target = agentTargets[a.id]?.[monthKey] ?? 0;
                  const live = liveByAgent[a.id] ?? 0;
                  const projected = live * runRateFactor;
                  const diff = projected - target;
                  const onTrack = target > 0 ? projected >= target : false;
                  const pct = target > 0 ? Math.min(100, Math.round((projected / target) * 100)) : 0;
                  const barColor = onTrack
                    ? "bg-emerald-500"
                    : pct >= 75
                      ? "bg-amber-500"
                      : "bg-rose-500";
                  return (
                    <tr
                      key={a.id}
                      className="border-b border-black/[0.03] dark:border-white/[0.03]"
                      data-testid={`row-live-${a.id}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="text-sm font-medium">{a.name}</div>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
                          <div
                            className={`h-full rounded-full ${barColor} transition-all`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right text-sm tabular-nums">{fmt(target)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-medium tabular-nums">{fmt(live)}</td>
                      <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                        {fmt(Math.round(projected))}
                      </td>
                      <td
                        className={`px-3 py-2.5 text-right text-sm font-medium tabular-nums ${
                          diff >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {diff >= 0 ? "+" : ""}
                        {fmt(Math.round(diff))}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {target === 0 ? (
                          <Badge className="border-black/10 bg-black/5 text-black/50 hover:bg-black/5">
                            No target
                          </Badge>
                        ) : onTrack ? (
                          <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                            On track
                          </Badge>
                        ) : (
                          <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                            Behind
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function CurrencyInput({ value, onChange, placeholder, autoFocus, className, testId }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  testId?: string;
}) {
  return (
    <div className={`relative ${className || ""}`}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-black/40">£</span>
      <Input
        type="text"
        inputMode="numeric"
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9]/g, ""))}
        className="h-10 rounded-xl border-black/10 pl-7 text-right text-sm font-medium"
        data-testid={testId}
      />
    </div>
  );
}

export default function AdminFinancialsTargets({ branchId }: { branchId?: string } = {}) {
  // Fetch data from API (scoped to the selected branch when provided)
  const { data: overview, isLoading, error } = useTargetsOverview(branchId);
  const upsertShopMutation = useUpsertShopTargets(branchId);
  const upsertAgentMutation = useUpsertAgentTargets(branchId);

  // Transform API data to component state format
  const agents = useMemo(() => {
    if (!overview?.agents) return [];
    return overview.agents.map(a => ({ id: a.id, name: a.name }));
  }, [overview?.agents]);

  const [shopTargets, setShopTargets] = useState<Record<string, number>>({});
  const [agentTargets, setAgentTargets] = useState<Record<string, Record<string, number>>>({});

  // Initialize state from API data — skip while a save is in flight so the
  // partial refetch between two parallel mutations doesn't blast over local
  // values the user just entered.
  const isSaving = upsertShopMutation.isPending || upsertAgentMutation.isPending;
  useEffect(() => {
    if (!overview || isSaving) return;

    const shopMap: Record<string, number> = {};
    overview.shopTargets.forEach(target => {
      const key = `${target.year}-${String(target.month).padStart(2, "0")}`;
      shopMap[key] = parseFloat(target.targetAmount);
    });
    setShopTargets(shopMap);

    const agentMap: Record<string, Record<string, number>> = {};
    overview.agentTargets.forEach(target => {
      const key = `${target.year}-${String(target.month).padStart(2, "0")}`;
      if (!agentMap[target.userId]) agentMap[target.userId] = {};
      agentMap[target.userId][key] = parseFloat(target.targetAmount);
    });
    setAgentTargets(agentMap);
  }, [overview, isSaving]);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardShopDefault, setWizardShopDefault] = useState("40000");
  const [wizardAgentDefaults, setWizardAgentDefaults] = useState<Record<string, string>>({});
  const [wizardApplyMode, setWizardApplyMode] = useState<"all" | "empty">("all");

  // Initialize wizard agent defaults when agents change
  useEffect(() => {
    if (agents.length > 0 && Object.keys(wizardAgentDefaults).length === 0) {
      const defaults: Record<string, string> = {};
      agents.forEach(a => { defaults[a.id] = "10000"; });
      setWizardAgentDefaults(defaults);
    }
  }, [agents, wizardAgentDefaults]);

  const [editMonth, setEditMonth] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<{ shop: string; agents: Record<string, string> }>({ shop: "", agents: {} });

  const [overviewHorizon, setOverviewHorizon] = useState<12 | 18 | 24>(12);

  const validationData = useMemo(() => {
    return MONTHS.map((m) => {
      const shop = shopTargets[m.key] ?? 0;
      const agentTotal = agents.reduce((s, a) => s + (agentTargets[a.id]?.[m.key] ?? 0), 0);
      return { ...m, shop, agentTotal, diff: agentTotal - shop };
    });
  }, [shopTargets, agentTargets, agents]);

  const validationData12 = validationData.slice(0, 12);

  const overviewRows = useMemo(() => {
    const now = new Date();
    const startYear = now.getFullYear();
    const rows: typeof validationData = [];
    for (let i = 0; i < overviewHorizon; i++) {
      const d = new Date(startYear, i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const shop = shopTargets[key] ?? 0;
      const agentTotal = agents.reduce((s, a) => s + (agentTargets[a.id]?.[key] ?? 0), 0);
      rows.push({
        key,
        label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
        short: d.toLocaleDateString("en-GB", { month: "short" }),
        monthNum: d.getMonth(),
        year: d.getFullYear(),
        shop,
        agentTotal,
        diff: agentTotal - shop,
      });
    }
    return rows;
  }, [overviewHorizon, shopTargets, agentTargets, agents]);

  const overallHealth = useMemo(() => {
    const balanced = validationData12.filter(v => Math.abs(v.diff) < 500).length;
    return Math.round((balanced / validationData12.length) * 100);
  }, [validationData12]);

  const openEditMonth = useCallback((monthKey: string) => {
    setEditDrafts({
      shop: String(shopTargets[monthKey] ?? 0),
      agents: agents.reduce((acc, a) => {
        acc[a.id] = String(agentTargets[a.id]?.[monthKey] ?? 0);
        return acc;
      }, {} as Record<string, string>),
    });
    setEditMonth(monthKey);
  }, [shopTargets, agentTargets, agents]);

  const saveEditMonth = useCallback(async () => {
    if (!editMonth) return;
    
    const monthData = MONTHS.find(m => m.key === editMonth);
    if (!monthData) return;

    // Update shop target
    const shopVal = parseInt(editDrafts.shop, 10);
    if (!isNaN(shopVal) && shopVal >= 0) {
      setShopTargets(prev => ({ ...prev, [editMonth]: shopVal }));
      
      // Save to API
      await upsertShopMutation.mutateAsync({
        targets: [{
          year: monthData.year,
          month: monthData.monthNum + 1,
          targetAmount: shopVal.toFixed(2),
        }]
      });
    }

    // Update agent targets
    const agentTargetsToSave: AgentTargetInput[] = [];
    const newAgentTargets = { ...agentTargets };
    
    for (const a of agents) {
      const val = parseInt(editDrafts.agents[a.id] ?? "0", 10);
      if (!isNaN(val) && val >= 0) {
        if (!newAgentTargets[a.id]) newAgentTargets[a.id] = {};
        newAgentTargets[a.id][editMonth] = val;
        
        agentTargetsToSave.push({
          userId: a.id,
          year: monthData.year,
          month: monthData.monthNum + 1,
          targetAmount: val.toFixed(2),
        });
      }
    }
    
    setAgentTargets(newAgentTargets);
    
    // Save to API
    if (agentTargetsToSave.length > 0) {
      await upsertAgentMutation.mutateAsync({ targets: agentTargetsToSave });
    }
    
    setEditMonth(null);
  }, [editMonth, editDrafts, agents, agentTargets, upsertShopMutation, upsertAgentMutation]);

  const applyWizard = useCallback(async () => {
    const shopVal = parseInt(wizardShopDefault, 10) || 0;

    const shopTargetsToSave: ShopTargetInput[] = [];
    const nextShop: Record<string, number> = { ...shopTargets };
    MONTHS.forEach(m => {
      if (wizardApplyMode === "all" || nextShop[m.key] == null) {
        nextShop[m.key] = shopVal;
        shopTargetsToSave.push({
          year: m.year,
          month: m.monthNum + 1,
          targetAmount: shopVal.toFixed(2),
        });
      }
    });

    const agentTargetsToSave: AgentTargetInput[] = [];
    const nextAgent: Record<string, Record<string, number>> = { ...agentTargets };
    agents.forEach(a => {
      const val = parseInt(wizardAgentDefaults[a.id] || "0", 10) || 0;
      nextAgent[a.id] = { ...(nextAgent[a.id] ?? {}) };
      MONTHS.forEach(m => {
        if (wizardApplyMode === "all" || nextAgent[a.id]?.[m.key] == null) {
          nextAgent[a.id][m.key] = val;
          agentTargetsToSave.push({
            userId: a.id,
            year: m.year,
            month: m.monthNum + 1,
            targetAmount: val.toFixed(2),
          });
        }
      });
    });

    setShopTargets(nextShop);
    setAgentTargets(nextAgent);

    try {
      await Promise.all([
        shopTargetsToSave.length > 0 ? upsertShopMutation.mutateAsync({ targets: shopTargetsToSave }) : Promise.resolve(),
        agentTargetsToSave.length > 0 ? upsertAgentMutation.mutateAsync({ targets: agentTargetsToSave }) : Promise.resolve(),
      ]);
    } catch (error) {
      console.error("Failed to save wizard targets:", error);
    }

    setWizardOpen(false);
    setWizardStep(0);
  }, [wizardShopDefault, wizardAgentDefaults, wizardApplyMode, agents, shopTargets, agentTargets, upsertShopMutation, upsertAgentMutation]);

  const wizardSteps = [
    { title: "Shop Target", icon: Store, desc: "Set the default monthly shop target" },
    { title: "Agent Targets", icon: Users, desc: "Set default targets for each agent" },
    { title: "Apply", icon: CheckCircle2, desc: "Review and apply your targets" },
  ];

  const editMonthData = editMonth ? MONTHS.find(m => m.key === editMonth) : null;
  const editMonthValidation = editMonth ? (() => {
    const shop = parseInt(editDrafts.shop, 10) || 0;
    const agentTotal = agents.reduce((s, a) => s + (parseInt(editDrafts.agents[a.id] ?? "0", 10) || 0), 0);
    return { shop, agentTotal, diff: agentTotal - shop };
  })() : null;

  // Loading state
  if (isLoading) {
    return (
      <section className="space-y-6" data-testid="section-financials-targets">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-black/40" />
          <p className="mt-4 text-sm text-black/50">Loading targets data...</p>
        </div>
      </section>
    );
  }

  // Error state
  if (error) {
    return (
      <section className="space-y-6" data-testid="section-financials-targets">
        <Card className="rounded-2xl border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900">Failed to load targets</h3>
              <p className="mt-1 text-sm text-red-700">
                {error instanceof Error ? error.message : "An error occurred while loading targets data"}
              </p>
            </div>
          </div>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-6" data-testid="section-financials-targets">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight" data-testid="heading-targets">
            Sales Targets Management
          </h2>
          <p className="mt-0.5 text-sm text-black/50 dark:text-white/50">
            Set monthly shop and agent sales targets for the next 24 months.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl"
            onClick={() => { setWizardStep(0); setWizardOpen(true); }}
            data-testid="button-open-wizard"
          >
            <Wand2 className="h-3.5 w-3.5" />
            Target Setup Wizard
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3" data-testid="target-summary-cards">
        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium text-black/50 dark:text-white/50">Target Health</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-black/10">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${overallHealth}%` }} />
              </div>
            </div>
            <span className="text-lg font-bold">{overallHealth}%</span>
          </div>
          <p className="mt-1 text-[11px] text-black/40">{validationData12.filter(v => Math.abs(v.diff) < 500).length} of {validationData12.length} months balanced</p>
        </Card>
        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium text-black/50 dark:text-white/50">Total Shop Target (12m)</p>
          <p className="mt-1 text-xl font-bold">{fmt(MONTHS.slice(0, 12).reduce((s, m) => s + (shopTargets[m.key] ?? 0), 0))}</p>
          <p className="mt-0.5 text-[11px] text-black/40">Next 12 months combined</p>
        </Card>
        <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
          <p className="text-xs font-medium text-black/50 dark:text-white/50">Active Agents</p>
          <p className="mt-1 text-xl font-bold">{agents.length}</p>
          <p className="mt-0.5 text-[11px] text-black/40">With assigned targets</p>
        </Card>
      </div>

      <LiveProjectionsCard
        agents={agents}
        agentTargets={agentTargets}
        shopTargets={shopTargets}
      />

      <Card className="overflow-hidden rounded-2xl border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-full-overview">
        <div className="flex items-start justify-between gap-3 p-4 pb-2">
          <div>
            <h3 className="text-sm font-semibold" data-testid="text-overview-heading">
              Full {overviewHorizon}-Month Overview
            </h3>
            <p className="mt-0.5 text-[11px] text-black/40">Click any row to edit that month's targets.</p>
          </div>
          <div
            className="flex items-center gap-1 rounded-xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5"
            data-testid="overview-horizon-toggle"
          >
            {([12, 18, 24] as const).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => setOverviewHorizon(h)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  overviewHorizon === h
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
                }`}
                data-testid={`button-overview-horizon-${h}`}
              >
                {h}m
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-black/50">Month</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-black/50">Shop Target</th>
                {agents.map(a => (
                  <th key={a.id} className="px-3 py-2.5 text-right text-xs font-medium text-black/50">{a.name.split(" ")[0]}</th>
                ))}
                <th className="px-4 py-2.5 text-right text-xs font-medium text-black/50">Agent Total</th>
                <th className="px-4 py-2.5 text-right text-xs font-medium text-black/50">Status</th>
                <th className="w-8 px-2" />
              </tr>
            </thead>
            <tbody>
              {overviewRows.map((row) => (
                <tr
                  key={row.key}
                  className="cursor-pointer border-b border-black/[0.03] transition hover:bg-blue-50/50 dark:border-white/[0.03] dark:hover:bg-blue-500/5"
                  onClick={() => openEditMonth(row.key)}
                  data-testid={`row-overview-${row.key}`}
                >
                  <td className="px-4 py-2 text-sm font-medium">{row.label}</td>
                  <td className="px-4 py-2 text-right text-sm font-semibold">{fmt(row.shop)}</td>
                  {agents.map(a => (
                    <td key={a.id} className="px-3 py-2 text-right text-sm text-black/70">{fmt(agentTargets[a.id]?.[row.key] ?? 0)}</td>
                  ))}
                  <td className="px-4 py-2 text-right text-sm font-semibold">{fmt(row.agentTotal)}</td>
                  <td className="px-4 py-2 text-right"><StatusBadge diff={row.diff} /></td>
                  <td className="px-2 py-2"><ChevronRight className="h-3.5 w-3.5 text-black/20" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-md rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl sm:max-w-lg" data-testid="dialog-wizard">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Target Setup Wizard</DialogTitle>
            <DialogDescription className="text-xs text-black/50">
              Quickly set up targets for all 24 months in 3 simple steps.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2 flex gap-1">
            {wizardSteps.map((s, i) => {
              const Icon = s.icon;
              const done = i < wizardStep;
              const current = i === wizardStep;
              return (
                <button
                  key={i}
                  className={`flex flex-1 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    current ? "bg-blue-500 text-white" : done ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-black/40"
                  }`}
                  onClick={() => setWizardStep(i)}
                  data-testid={`wizard-step-${i}`}
                >
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                  {s.title}
                </button>
              );
            })}
          </div>

          <div className="mt-4 min-h-[200px]">
            {wizardStep === 0 && (
              <div className="space-y-4" data-testid="wizard-step-shop">
                <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Set a default monthly target for the shop. This will be applied to all 24 months.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Default Monthly Shop Target</Label>
                  <CurrencyInput
                    value={wizardShopDefault}
                    onChange={setWizardShopDefault}
                    placeholder="40000"
                    autoFocus
                    testId="input-wizard-shop"
                  />
                  <p className="text-[11px] text-black/40">
                    This sets the total commission goal the shop should achieve each month.
                  </p>
                </div>
              </div>
            )}

            {wizardStep === 1 && (
              <div className="space-y-4" data-testid="wizard-step-agents">
                <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Set a default monthly target for each agent. You can adjust individual months later.
                  </p>
                </div>
                <div className="space-y-2.5">
                  {agents.map(a => (
                    <div key={a.id} className="flex items-center gap-3">
                      <span className="w-28 truncate text-sm font-medium">{a.name}</span>
                      <CurrencyInput
                        value={wizardAgentDefaults[a.id] || ""}
                        onChange={v => setWizardAgentDefaults(prev => ({ ...prev, [a.id]: v }))}
                        className="flex-1"
                        testId={`input-wizard-agent-${a.id}`}
                      />
                    </div>
                  ))}
                </div>
                {(() => {
                  const shopVal = parseInt(wizardShopDefault, 10) || 0;
                  const agentSum = agents.reduce((s, a) => s + (parseInt(wizardAgentDefaults[a.id] || "0", 10) || 0), 0);
                  const diff = agentSum - shopVal;
                  const si = statusInfo(diff);
                  return (
                    <div className={`flex items-center justify-between rounded-xl p-3 ${
                      si.color === "emerald" ? "bg-emerald-50" : si.color === "red" ? "bg-red-50" : "bg-amber-50"
                    }`}>
                      <div className="flex items-center gap-2 text-xs">
                        {si.color === "emerald" ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />}
                        <span>Agent total: {fmt(agentSum)} / Shop: {fmt(shopVal)}</span>
                      </div>
                      <span className={`text-xs font-semibold ${si.color === "emerald" ? "text-emerald-700" : si.color === "red" ? "text-red-700" : "text-amber-700"}`}>
                        {diff >= 0 ? "+" : ""}{fmt(diff)}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {wizardStep === 2 && (
              <div className="space-y-4" data-testid="wizard-step-apply">
                <div className="rounded-xl bg-blue-50 p-3 dark:bg-blue-500/10">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Review your settings and choose how to apply them.
                  </p>
                </div>

                <div className="rounded-xl border border-black/5 p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-black/50">Shop Target</span>
                    <span className="font-semibold">{fmt(parseInt(wizardShopDefault, 10) || 0)} / month</span>
                  </div>
                  {agents.map(a => (
                    <div key={a.id} className="flex justify-between text-sm">
                      <span className="text-black/50">{a.name}</span>
                      <span className="font-medium">{fmt(parseInt(wizardAgentDefaults[a.id] || "0", 10) || 0)} / month</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium text-black/60">Apply Mode</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      className={`rounded-xl border-2 p-3 text-left transition ${wizardApplyMode === "all" ? "border-blue-500 bg-blue-50" : "border-black/10"}`}
                      onClick={() => setWizardApplyMode("all")}
                      data-testid="wizard-apply-all"
                    >
                      <p className="text-xs font-semibold">Overwrite All</p>
                      <p className="mt-0.5 text-[11px] text-black/50">Replace all 24 months with these values</p>
                    </button>
                    <button
                      className={`rounded-xl border-2 p-3 text-left transition ${wizardApplyMode === "empty" ? "border-blue-500 bg-blue-50" : "border-black/10"}`}
                      onClick={() => setWizardApplyMode("empty")}
                      data-testid="wizard-apply-empty"
                    >
                      <p className="text-xs font-semibold">Fill Empty Only</p>
                      <p className="mt-0.5 text-[11px] text-black/50">Only set months that have no target yet</p>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-black/5 pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl text-xs"
              onClick={() => wizardStep > 0 ? setWizardStep(s => s - 1) : setWizardOpen(false)}
              data-testid="wizard-back"
            >
              {wizardStep > 0 ? <><ChevronLeft className="mr-1 h-3 w-3" /> Back</> : "Cancel"}
            </Button>
            {wizardStep < 2 ? (
              <Button
                size="sm"
                className="gap-1 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => setWizardStep(s => s + 1)}
                data-testid="wizard-next"
              >
                Next <ArrowRight className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1 rounded-xl bg-emerald-500 text-white hover:bg-emerald-600"
                onClick={applyWizard}
                data-testid="wizard-apply"
              >
                <Check className="h-3.5 w-3.5" /> Apply Targets
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={!!editMonth} onOpenChange={open => !open && setEditMonth(null)}>
        <SheetContent className="w-full overflow-y-auto border-black/10 bg-white/95 backdrop-blur-xl sm:max-w-md" data-testid="sheet-edit-month">
          <SheetHeader>
            <SheetTitle className="text-base font-semibold">
              Edit {editMonthData?.label}
            </SheetTitle>
          </SheetHeader>

          <div className="mt-5 space-y-5">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5 text-xs font-medium text-black/60">
                <Store className="h-3 w-3" /> Shop Target
              </Label>
              <CurrencyInput
                value={editDrafts.shop}
                onChange={v => setEditDrafts(prev => ({ ...prev, shop: v }))}
                autoFocus
                testId="input-edit-shop"
              />
            </div>

            <div className="h-px bg-black/5" />

            <div>
              <Label className="flex items-center gap-1.5 text-xs font-medium text-black/60">
                <Users className="h-3 w-3" /> Agent Targets
              </Label>
              <div className="mt-2 space-y-2.5">
                {agents.map(a => (
                  <div key={a.id} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm font-medium">{a.name}</span>
                    <CurrencyInput
                      value={editDrafts.agents[a.id] || ""}
                      onChange={v => setEditDrafts(prev => ({
                        ...prev,
                        agents: { ...prev.agents, [a.id]: v },
                      }))}
                      className="flex-1"
                      testId={`input-edit-agent-${a.id}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {editMonthValidation && (
              <>
                <div className="h-px bg-black/5" />
                <div className={`flex items-center justify-between rounded-xl p-3 ${
                  statusInfo(editMonthValidation.diff).color === "emerald" ? "bg-emerald-50" :
                  statusInfo(editMonthValidation.diff).color === "red" ? "bg-red-50" : "bg-amber-50"
                }`}>
                  <div className="space-y-0.5">
                    <p className="text-xs font-medium">Allocation Check</p>
                    <p className="text-[11px] text-black/50">
                      Agents: {fmt(editMonthValidation.agentTotal)} / Shop: {fmt(editMonthValidation.shop)}
                    </p>
                  </div>
                  <StatusBadge diff={editMonthValidation.diff} />
                </div>
              </>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 rounded-xl"
                onClick={() => setEditMonth(null)}
                data-testid="edit-cancel"
              >
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                className="flex-1 rounded-xl bg-blue-500 text-white hover:bg-blue-600"
                onClick={saveEditMonth}
                data-testid="edit-save"
              >
                <Check className="mr-1 h-3.5 w-3.5" /> Save Changes
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}
