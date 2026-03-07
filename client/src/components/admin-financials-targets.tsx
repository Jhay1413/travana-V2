import { useState, useMemo, useCallback } from "react";
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
  Copy,
} from "lucide-react";

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

const INITIAL_AGENTS = [
  { id: "1", name: "Sarah Mitchell" },
  { id: "2", name: "Dan Roberts" },
  { id: "3", name: "Emma Clarke" },
  { id: "4", name: "James Wilson" },
  { id: "5", name: "Tia Morgan" },
  { id: "6", name: "Casey Ashman" },
];

function randomTarget(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) / 500) * 500;
}

function initShopTargets() {
  const map: Record<string, number> = {};
  MONTHS.forEach((m) => { map[m.key] = randomTarget(30000, 50000); });
  return map;
}

function initAgentTargets(agents: { id: string; name: string }[]) {
  const map: Record<string, Record<string, number>> = {};
  agents.forEach((a) => {
    map[a.id] = {};
    MONTHS.forEach((m) => { map[a.id][m.key] = randomTarget(7000, 15000); });
  });
  return map;
}

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

export default function AdminFinancialsTargets() {
  const [agents] = useState(INITIAL_AGENTS);
  const [shopTargets, setShopTargets] = useState<Record<string, number>>(initShopTargets);
  const [agentTargets, setAgentTargets] = useState<Record<string, Record<string, number>>>(() => initAgentTargets(INITIAL_AGENTS));

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [wizardShopDefault, setWizardShopDefault] = useState("40000");
  const [wizardAgentDefaults, setWizardAgentDefaults] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    INITIAL_AGENTS.forEach(a => { m[a.id] = "10000"; });
    return m;
  });
  const [wizardApplyMode, setWizardApplyMode] = useState<"all" | "empty">("all");

  const [editMonth, setEditMonth] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<{ shop: string; agents: Record<string, string> }>({ shop: "", agents: {} });

  const [quarter, setQuarter] = useState(0);
  const quartersCount = Math.ceil(MONTHS.length / 3);
  const visibleMonths = MONTHS.slice(quarter * 3, quarter * 3 + 3);

  const validationData = useMemo(() => {
    return MONTHS.map((m) => {
      const shop = shopTargets[m.key] ?? 0;
      const agentTotal = agents.reduce((s, a) => s + (agentTargets[a.id]?.[m.key] ?? 0), 0);
      return { ...m, shop, agentTotal, diff: agentTotal - shop };
    });
  }, [shopTargets, agentTargets, agents]);

  const validationData12 = validationData.slice(0, 12);

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

  const saveEditMonth = useCallback(() => {
    if (!editMonth) return;
    const shopVal = parseInt(editDrafts.shop, 10);
    if (!isNaN(shopVal) && shopVal >= 0) {
      setShopTargets(prev => ({ ...prev, [editMonth]: shopVal }));
    }
    const newAgentTargets = { ...agentTargets };
    for (const a of agents) {
      const val = parseInt(editDrafts.agents[a.id] ?? "0", 10);
      if (!isNaN(val) && val >= 0) {
        newAgentTargets[a.id] = { ...newAgentTargets[a.id], [editMonth]: val };
      }
    }
    setAgentTargets(newAgentTargets);
    setEditMonth(null);
  }, [editMonth, editDrafts, agents, agentTargets]);

  const applyWizard = useCallback(() => {
    const shopVal = parseInt(wizardShopDefault, 10) || 0;
    setShopTargets(prev => {
      const next = { ...prev };
      MONTHS.forEach(m => {
        if (wizardApplyMode === "all" || next[m.key] == null) next[m.key] = shopVal;
      });
      return next;
    });
    setAgentTargets(prev => {
      const next = { ...prev };
      agents.forEach(a => {
        const val = parseInt(wizardAgentDefaults[a.id] || "0", 10) || 0;
        if (!next[a.id]) next[a.id] = {};
        MONTHS.forEach(m => {
          if (wizardApplyMode === "all" || next[a.id]?.[m.key] == null) next[a.id][m.key] = val;
        });
      });
      return next;
    });
    setWizardOpen(false);
    setWizardStep(0);
  }, [wizardShopDefault, wizardAgentDefaults, wizardApplyMode, agents]);

  const copyFromPrevQuarter = () => {
    if (quarter === 0) return;
    const prevMonths = MONTHS.slice((quarter - 1) * 3, (quarter - 1) * 3 + 3);
    const currMonths = MONTHS.slice(quarter * 3, quarter * 3 + 3);
    setShopTargets(prev => {
      const next = { ...prev };
      currMonths.forEach((cm, i) => {
        if (prevMonths[i]) next[cm.key] = prev[prevMonths[i].key] ?? 0;
      });
      return next;
    });
    setAgentTargets(prev => {
      const next = { ...prev };
      agents.forEach(a => {
        if (!next[a.id]) next[a.id] = {};
        currMonths.forEach((cm, i) => {
          if (prevMonths[i]) next[a.id][cm.key] = (prev[a.id]?.[prevMonths[i].key]) ?? 0;
        });
      });
      return next;
    });
  };

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

      <Card className="rounded-2xl border-black/10 bg-white/80 p-4 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-quarter-nav">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Monthly Targets</h3>
          <div className="flex items-center gap-2">
            {quarter > 0 && (
              <Button variant="ghost" size="sm" className="gap-1 rounded-xl text-xs" onClick={copyFromPrevQuarter} data-testid="button-copy-prev-quarter">
                <Copy className="h-3 w-3" />
                Copy Previous Quarter
              </Button>
            )}
            <div className="flex items-center gap-1 rounded-xl bg-black/5 p-0.5 dark:bg-white/5">
              <button
                onClick={() => setQuarter(q => Math.max(0, q - 1))}
                disabled={quarter === 0}
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30 dark:hover:bg-white/10"
                data-testid="button-prev-quarter"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[100px] px-2 text-center text-xs font-medium">
                {visibleMonths[0]?.short} {visibleMonths[0]?.year} – {visibleMonths[visibleMonths.length - 1]?.short} {visibleMonths[visibleMonths.length - 1]?.year}
              </span>
              <button
                onClick={() => setQuarter(q => Math.min(quartersCount - 1, q + 1))}
                disabled={quarter >= quartersCount - 1}
                className="rounded-lg p-1.5 transition hover:bg-white disabled:opacity-30 dark:hover:bg-white/10"
                data-testid="button-next-quarter"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {visibleMonths.map((m) => {
            const shop = shopTargets[m.key] ?? 0;
            const agentTotal = agents.reduce((s, a) => s + (agentTargets[a.id]?.[m.key] ?? 0), 0);
            const diff = agentTotal - shop;
            const si = statusInfo(diff);
            const borderColor = si.color === "emerald" ? "border-emerald-200" : si.color === "red" ? "border-red-200" : "border-amber-200";

            return (
              <div
                key={m.key}
                className={`group relative rounded-2xl border-2 ${borderColor} bg-white p-4 transition hover:shadow-md dark:bg-white/5`}
                data-testid={`month-card-${m.key}`}
              >
                <button
                  className="absolute right-3 top-3 rounded-lg bg-black/5 p-1.5 text-black/40 opacity-0 transition hover:bg-blue-500 hover:text-white group-hover:opacity-100"
                  onClick={() => openEditMonth(m.key)}
                  data-testid={`button-edit-${m.key}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>

                <h4 className="text-sm font-semibold">{m.label}</h4>

                <div className="mt-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-black/50">
                      <Store className="h-3 w-3" /> Shop Target
                    </span>
                    <span className="text-sm font-bold">{fmt(shop)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-black/50">
                      <Users className="h-3 w-3" /> Agent Total
                    </span>
                    <span className="text-sm font-semibold">{fmt(agentTotal)}</span>
                  </div>

                  <div className="h-px bg-black/5 dark:bg-white/5" />

                  <div className="flex items-center justify-between">
                    <StatusBadge diff={diff} />
                    <span className={`text-xs font-medium ${si.color === "emerald" ? "text-emerald-600" : si.color === "red" ? "text-red-600" : "text-amber-600"}`}>
                      {diff >= 0 ? "+" : ""}{fmt(diff)}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1">
                    {agents.map(a => {
                      const av = agentTargets[a.id]?.[m.key] ?? 0;
                      const pct = shop > 0 ? (av / shop) * 100 : 0;
                      return (
                        <div key={a.id} className="flex items-center gap-2">
                          <span className="w-16 truncate text-[11px] text-black/50">{a.name.split(" ")[0]}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/5">
                            <div className="h-full rounded-full bg-blue-400 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <span className="w-14 text-right text-[11px] font-medium">{fmt(av)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="overflow-hidden rounded-2xl border-black/10 bg-white/80 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-full-overview">
        <div className="p-4 pb-2">
          <h3 className="text-sm font-semibold">Full 24-Month Overview</h3>
          <p className="mt-0.5 text-[11px] text-black/40">Click any row to edit that month's targets.</p>
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
              {validationData.map((row) => (
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
