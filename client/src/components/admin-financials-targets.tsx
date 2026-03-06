import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Copy, Plus, Trash2, Info } from "lucide-react";

function generateMonths(count: number) {
  const now = new Date();
  const months: { key: string; label: string; short: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      short: d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" }),
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
  MONTHS.forEach((m) => {
    map[m.key] = randomTarget(30000, 50000);
  });
  return map;
}

function initAgentTargets(agents: { id: string; name: string }[]) {
  const map: Record<string, Record<string, number>> = {};
  agents.forEach((a) => {
    map[a.id] = {};
    MONTHS.forEach((m) => {
      map[a.id][m.key] = randomTarget(7000, 15000);
    });
  });
  return map;
}

function fmt(v: number) {
  return "£" + v.toLocaleString("en-GB");
}

function EditableCell({
  value,
  onChange,
  testId,
}: {
  value: number;
  onChange: (v: number) => void;
  testId?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  if (editing) {
    return (
      <input
        type="text"
        inputMode="numeric"
        className="w-full rounded-lg border border-blue-400 bg-white px-2 py-1 text-right text-sm font-medium outline-none focus:ring-2 focus:ring-blue-400/30"
        value={draft}
        autoFocus
        onChange={(e) => {
          const clean = e.target.value.replace(/[^0-9]/g, "");
          setDraft(clean);
        }}
        onBlur={() => {
          const num = parseInt(draft, 10);
          if (!isNaN(num) && num >= 0) onChange(num);
          else setDraft(String(value));
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            setEditing(false);
          }
        }}
        data-testid={testId}
      />
    );
  }

  return (
    <button
      className="w-full rounded-lg px-2 py-1 text-right text-sm font-medium transition hover:bg-blue-50 dark:hover:bg-blue-500/10"
      onClick={() => {
        setDraft(String(value));
        setEditing(true);
      }}
      data-testid={testId}
    >
      {fmt(value)}
    </button>
  );
}

export default function AdminFinancialsTargets() {
  const [agents, setAgents] = useState(INITIAL_AGENTS);
  const [shopTargets, setShopTargets] = useState<Record<string, number>>(initShopTargets);
  const [agentTargets, setAgentTargets] = useState<Record<string, Record<string, number>>>(() => initAgentTargets(INITIAL_AGENTS));

  const updateShopTarget = (monthKey: string, value: number) => {
    setShopTargets((prev) => ({ ...prev, [monthKey]: value }));
  };

  const updateAgentTarget = (agentId: string, monthKey: string, value: number) => {
    setAgentTargets((prev) => ({
      ...prev,
      [agentId]: { ...prev[agentId], [monthKey]: value },
    }));
  };

  const addAgent = () => {
    const id = String(Date.now());
    const name = `New Agent ${agents.length + 1}`;
    setAgents((prev) => [...prev, { id, name }]);
    const targets: Record<string, number> = {};
    MONTHS.forEach((m) => {
      targets[m.key] = 10000;
    });
    setAgentTargets((prev) => ({ ...prev, [id]: targets }));
  };

  const removeAgent = (id: string) => {
    setAgents((prev) => prev.filter((a) => a.id !== id));
    setAgentTargets((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const copyPreviousMonth = () => {
    const prevKey = MONTHS[0]?.key;
    if (!prevKey) return;
    const secondKey = MONTHS[1]?.key;
    if (!secondKey) return;
    setShopTargets((prev) => ({ ...prev, [secondKey]: prev[prevKey] ?? 0 }));
    setAgentTargets((prev) => {
      const next = { ...prev };
      for (const agentId of Object.keys(next)) {
        next[agentId] = { ...next[agentId], [secondKey]: next[agentId]?.[prevKey] ?? 0 };
      }
      return next;
    });
  };

  const validationData = useMemo(() => {
    return MONTHS.map((m) => {
      const shop = shopTargets[m.key] ?? 0;
      const agentTotal = agents.reduce((s, a) => s + (agentTargets[a.id]?.[m.key] ?? 0), 0);
      const diff = agentTotal - shop;
      return { ...m, shop, agentTotal, diff };
    });
  }, [shopTargets, agentTargets, agents]);

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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-xl"
          onClick={copyPreviousMonth}
          data-testid="button-copy-previous"
        >
          <Copy className="h-3.5 w-3.5" />
          Copy Previous Month Targets
        </Button>
      </div>

      <Card className="rounded-2xl border-black/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-shop-targets">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Shop Monthly Targets</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-black/30" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[220px] text-xs">These targets represent the total monthly commission goal for the shop.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mb-3 text-[11px] text-black/40 dark:text-white/40">
          These targets represent the total monthly commission goal for the shop.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-black/5 dark:border-white/5">
                <TableHead className="text-xs">Month</TableHead>
                <TableHead className="w-[160px] text-right text-xs">Shop Target (£)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MONTHS.map((m) => (
                <TableRow key={m.key} className="border-black/5 dark:border-white/5" data-testid={`row-shop-${m.key}`}>
                  <TableCell className="text-sm font-medium">{m.label}</TableCell>
                  <TableCell className="w-[160px]">
                    <EditableCell
                      value={shopTargets[m.key] ?? 0}
                      onChange={(v) => updateShopTarget(m.key, v)}
                      testId={`input-shop-${m.key}`}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Card className="rounded-2xl border-black/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-agent-targets">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Agent Monthly Targets</h3>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl text-xs" onClick={addAgent} data-testid="button-add-agent">
              <Plus className="h-3.5 w-3.5" />
              Add Agent
            </Button>
          </div>
        </div>
        <p className="mb-3 text-[11px] text-black/40 dark:text-white/40">
          Set individual commission targets per agent per month. Scroll horizontally to see all months.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-black/5 dark:border-white/5">
                <th className="sticky left-0 z-10 bg-white/95 px-3 py-2 text-left text-xs font-medium text-black/50 backdrop-blur dark:bg-black/80 dark:text-white/50">
                  Agent
                </th>
                {MONTHS.map((m) => (
                  <th key={m.key} className="whitespace-nowrap px-2 py-2 text-right text-[11px] font-medium text-black/50 dark:text-white/50">
                    {m.short}
                  </th>
                ))}
                <th className="w-10 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id} className="border-b border-black/5 dark:border-white/5" data-testid={`row-agent-target-${agent.id}`}>
                  <td className="sticky left-0 z-10 bg-white/95 px-3 py-1.5 text-sm font-medium backdrop-blur dark:bg-black/80">
                    {agent.name}
                  </td>
                  {MONTHS.map((m) => (
                    <td key={m.key} className="px-1 py-1">
                      <EditableCell
                        value={agentTargets[agent.id]?.[m.key] ?? 0}
                        onChange={(v) => updateAgentTarget(agent.id, m.key, v)}
                        testId={`input-agent-${agent.id}-${m.key}`}
                      />
                    </td>
                  ))}
                  <td className="px-1 py-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className="rounded-lg p-1 text-black/25 transition hover:bg-red-50 hover:text-red-500"
                            onClick={() => removeAgent(agent.id)}
                            data-testid={`button-remove-agent-${agent.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent><p className="text-xs">Remove agent</p></TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="rounded-2xl border-black/10 bg-white/80 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5" data-testid="card-validation-summary">
        <div className="mb-1 flex items-center gap-2">
          <h3 className="text-sm font-semibold">Target Allocation Summary</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3.5 w-3.5 text-black/30" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-[220px] text-xs">This helps ensure agent targets align with the overall shop target.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <p className="mb-3 text-[11px] text-black/40 dark:text-white/40">
          This helps ensure agent targets align with the overall shop target.
        </p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-black/5 dark:border-white/5">
                <TableHead className="text-xs">Month</TableHead>
                <TableHead className="text-right text-xs">Shop Target</TableHead>
                <TableHead className="text-right text-xs">Agent Targets Total</TableHead>
                <TableHead className="text-right text-xs">Difference</TableHead>
                <TableHead className="text-right text-xs">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {validationData.map((row) => {
                const balanced = Math.abs(row.diff) < 500;
                const over = row.diff > 0;
                return (
                  <TableRow key={row.key} className="border-black/5 dark:border-white/5" data-testid={`row-validation-${row.key}`}>
                    <TableCell className="text-sm font-medium">{row.label}</TableCell>
                    <TableCell className="text-right text-sm">{fmt(row.shop)}</TableCell>
                    <TableCell className="text-right text-sm font-medium">{fmt(row.agentTotal)}</TableCell>
                    <TableCell className="text-right text-sm">
                      <span
                        className={
                          balanced
                            ? "text-emerald-600"
                            : over
                            ? "text-red-600"
                            : "text-amber-600"
                        }
                      >
                        {row.diff >= 0 ? "+" : ""}
                        {fmt(row.diff)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {balanced ? (
                        <Badge className="border-emerald-500/25 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/10">
                          Balanced
                        </Badge>
                      ) : over ? (
                        <Badge className="border-red-500/25 bg-red-500/10 text-red-700 hover:bg-red-500/10">
                          Over
                        </Badge>
                      ) : (
                        <Badge className="border-amber-500/25 bg-amber-500/10 text-amber-700 hover:bg-amber-500/10">
                          Under
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </section>
  );
}
