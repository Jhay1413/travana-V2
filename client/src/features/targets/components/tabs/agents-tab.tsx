import { useState } from "react";
import { agentKey } from "../../lib/allocation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/ui/segmented";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { OUTLINE_ACTION } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { AGENT_SORTS, buildAgentRows, filterSortAgents, statusCounts, type AgentSort } from "../../lib/agent-rows";
import { agentsTotal, profitSoFar } from "../../lib/allocation";
import { canEditAgentsIn } from "../../lib/access";
import { gbp } from "../../lib/money";
import { sum } from "../../lib/months";
import { elapsedPercent, percentOf } from "../../lib/status";
import type { AgentYear, TargetsYear } from "../../types";
import { ProgressBar } from "../shared/progress-bar";
import { StatTile } from "../shared/stat-tiles";
import { StatusPill } from "../shared/status-pill";
import { TARGETS_CARD, TARGETS_CONTROL, TARGETS_TH } from "../shared/targets-styles";

interface AgentsTabProps {
  data: TargetsYear;
  onOpenAgent: (agent: AgentYear) => void;
}

export function AgentsTab({ data, onOpenAgent }: AgentsTabProps) {
  const [branchId, setBranchId] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AgentSort>("behind");
  const all = buildAgentRows(data);
  const rows = filterSortAgents(all, { branchId, query, sort });
  const counts = statusCounts(all);
  const target = agentsTotal(data);
  const profit = sum(data.agents.map((a) => profitSoFar(a.actual, data.currentMonth)));
  const countIn = (id: string) => data.agents.filter((a) => a.branchId === id).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-4">
        <StatTile label="Agent targets" value={gbp(target)} sub={`${data.agents.length} ${data.agents.length === 1 ? "agent" : "agents"} in ${data.branches.length} ${data.branches.length === 1 ? "shop" : "shops"}`} />
        <StatTile label="Profit so far" value={gbp(profit)} sub={`${percentOf(profit, target)}% of agent targets`} />
        <StatTile
          label="Who is behind"
          value={`${counts.behind} of ${data.agents.length}`}
          sub={`${counts.ahead} ahead · ${counts.on_track} on track · ${counts.behind} behind`}
        />
      </div>

      <section className={cn(TARGETS_CARD, "overflow-hidden")}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 pb-3.5 pt-4">
          {data.branches.length > 1 ? (
            <Segmented
              value={branchId}
              onChange={setBranchId}
              label="Shop"
              className="max-w-full overflow-x-auto"
              items={[
                { value: "all", label: "All shops", count: data.agents.length, testId: "agents-shop-all" },
                ...data.branches.map((b) => ({ value: b.id, label: b.name, count: countIn(b.id), testId: `agents-shop-${b.id}` })),
              ]}
            />
          ) : (
            <span />
          )}
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-social-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search agents" aria-label="Search agents" className={cn(TARGETS_CONTROL, "w-60 pl-9")} data-testid="agents-search" />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as AgentSort)}>
              <SelectTrigger className={cn(TARGETS_CONTROL, "w-[230px]")} aria-label="Sort agents">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_SORTS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-[13px]">
            <thead>
              <tr className="border-y border-social-border bg-muted/40">
                <th className={TARGETS_TH}>Agent</th>
                <th className={TARGETS_TH}>Shop</th>
                <th className={TARGETS_TH}>Yearly target</th>
                <th className={TARGETS_TH}>Share of shop</th>
                <th className={TARGETS_TH}>Profit so far</th>
                <th className={TARGETS_TH}>Progress to target</th>
                <th className={TARGETS_TH}>Status</th>
                <th className={TARGETS_TH} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const shop = data.branches.find((b) => b.id === r.agent.branchId);
                const editable = canEditAgentsIn(data.canEdit, r.agent.branchId) && !r.agent.inactive;
                return (
                  <tr key={agentKey(r.agent)} className="border-b border-social-border last:border-b-0" data-testid={`agent-row-${agentKey(r.agent)}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <PersonAvatar name={r.agent.name} size={36} />
                        <div className="whitespace-nowrap font-semibold">
                          {r.agent.name}
                          {r.agent.inactive && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-social-muted">Inactive</span>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{r.branchName}</td>
                    <td className="px-4 py-3 font-semibold tabular-nums">{gbp(r.target)}</td>
                    <td className="px-4 py-3 text-social-muted">{percentOf(r.target, shop ? sum(shop.months) : 0)}%</td>
                    <td className="px-4 py-3 tabular-nums">
                      {gbp(r.profit)}
                      <div className="text-[12px] text-social-muted">{percentOf(r.profit, r.target)}%</div>
                    </td>
                    <td className="w-[18%] px-4 py-3">
                      <ProgressBar profit={r.profit} target={r.target} elapsed={data.elapsed} />
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={() => onOpenAgent(r.agent)} aria-label={`${editable ? "Edit" : "View"} target for ${r.agent.name}`}>
                        {editable ? "Edit" : "View"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-social-muted">
                    <div className="font-semibold text-foreground">No agents match</div>
                    {(query || branchId !== "all") && (
                      <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "mt-3 h-8 px-3")} onClick={() => { setQuery(""); setBranchId("all"); }}>
                        Clear filters
                      </Button>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t border-social-border px-5 py-3.5 text-[12px] text-social-muted">
          <span className="inline-flex items-center gap-2">
            <span className="h-3 w-0.5 bg-foreground" />
            Marks how much of the year has gone ({Math.round(elapsedPercent(data.elapsed))}%)
          </span>
          <span>Branch Managers can change agent targets in their own shop. Owner / Admin can change any agent.</span>
        </div>
      </section>
    </div>
  );
}
