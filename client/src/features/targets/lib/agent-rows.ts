import type { AgentYear, TargetsYear } from "../types";
import { profitSoFar } from "./allocation";
import { sum } from "./months";
import { paceStatus, type TargetStatus } from "./status";

export type AgentSort = "behind" | "target" | "profit" | "name";

export const AGENT_SORTS: Array<{ value: AgentSort; label: string }> = [
  { value: "behind", label: "Sort: Behind first" },
  { value: "target", label: "Sort: Target, high to low" },
  { value: "profit", label: "Sort: Profit, high to low" },
  { value: "name", label: "Sort: Name, A to Z" },
];

export interface AgentRow {
  agent: AgentYear;
  branchName: string;
  target: number;
  profit: number;
  status: TargetStatus;
  /** Profit as a share of target; 0 when there is no target. */
  ratio: number;
}

export function buildAgentRows(data: TargetsYear): AgentRow[] {
  return data.agents.map((agent) => {
    const target = sum(agent.months);
    const profit = profitSoFar(agent.actual, data.currentMonth);
    return {
      agent,
      branchName: data.branches.find((b) => b.id === agent.branchId)?.name ?? "",
      target,
      profit,
      status: paceStatus(profit, target, data.elapsed),
      ratio: target > 0 ? profit / target : 0,
    };
  });
}

const RANK: Record<TargetStatus, number> = { behind: 0, on_track: 1, ahead: 2 };

export function filterSortAgents(rows: AgentRow[], opts: { branchId: string | "all"; query: string; sort: AgentSort }): AgentRow[] {
  const q = opts.query.trim().toLowerCase();
  const kept = rows.filter(
    (r) =>
      (opts.branchId === "all" || r.agent.branchId === opts.branchId) &&
      (q === "" || r.agent.name.toLowerCase().includes(q) || r.branchName.toLowerCase().includes(q)),
  );
  return kept.sort((a, b) => {
    switch (opts.sort) {
      case "name":
        return a.agent.name.localeCompare(b.agent.name);
      case "target":
        return b.target - a.target;
      case "profit":
        return b.profit - a.profit;
      default:
        return RANK[a.status] - RANK[b.status] || a.ratio - b.ratio || a.agent.name.localeCompare(b.agent.name);
    }
  });
}

export function statusCounts(rows: AgentRow[]): Record<TargetStatus, number> {
  const counts: Record<TargetStatus, number> = { ahead: 0, on_track: 0, behind: 0 };
  for (const r of rows) counts[r.status] += 1;
  return counts;
}
