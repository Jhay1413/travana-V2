import type { AgentYear, TargetsYear } from "../types";
import { gbp } from "./money";
import { sum } from "./months";

/* ---------------------------------------------------------------- saved numbers */

export const businessTotal = (data: TargetsYear): number => (data.business ? sum(data.business.months) : 0);
export const shopsTotal = (data: TargetsYear): number => sum(data.branches.map((b) => sum(b.months)));
export const homeworkersTotal = (data: TargetsYear): number => sum(data.homeworkers.map((h) => sum(h.months)));
export const agentsOf = (data: TargetsYear, branchId: string): AgentYear[] => data.agents.filter((a) => a.branchId === branchId);
export const agentsTotal = (data: TargetsYear, branchId?: string): number =>
  sum((branchId ? agentsOf(data, branchId) : data.agents).map((a) => sum(a.months)));

/** Profit so far: the months up to and including the current one. */
export function profitSoFar(actual: readonly number[], currentMonth: number): number {
  return sum(actual.slice(0, Math.max(0, Math.min(12, currentMonth))));
}

/** Positive: over-allocated. Negative: still to allocate. */
export const driftOf = (allocated: number, target: number): number => allocated - target;

export const businessDrift = (data: TargetsYear): number => driftOf(shopsTotal(data) + homeworkersTotal(data), businessTotal(data));

export const shopDrift = (data: TargetsYear, branchId: string): number => {
  const shop = data.branches.find((b) => b.id === branchId);
  return driftOf(agentsTotal(data, branchId), shop ? sum(shop.months) : 0);
};

/** Month numbers (0 to 11) where shops plus homeworkers do not equal the business target. */
export function unbalancedMonths(data: TargetsYear): number[] {
  if (!data.business) return [];
  const biz = data.business.months;
  const out: number[] = [];
  for (let i = 0; i < 12; i++) {
    const total = sum(data.branches.map((b) => b.months[i] ?? 0)) + sum(data.homeworkers.map((h) => h.months[i] ?? 0));
    if (total !== (biz[i] ?? 0)) out.push(i);
  }
  return out;
}

export type DriftTone = "ok" | "warn" | "bad";

/** "Fully allocated" / "£2,000 not allocated yet" / "£2,000 over". */
export function driftMessage(drift: number, short = false): { tone: DriftTone; text: string } {
  if (drift === 0) return { tone: "ok", text: short ? "Allocated" : "Fully allocated" };
  if (drift < 0) return { tone: "warn", text: `${gbp(-drift)} not allocated yet` };
  return { tone: "bad", text: `${gbp(drift)} over` };
}

/** Agents are keyed by shop and person, so the same person in two shops never collides. */
export const agentKey = (a: { branchId: string; userId: string }): string => `${a.branchId}|${a.userId}`;

/** A business target counts as set only when its months add up to something. */
export const isBusinessSet = (data: TargetsYear): boolean => !!data.business && sum(data.business.months) > 0;

/** The month that is "to date" (1 to 12), or 0 when the year is over or has not started. */
export const liveMonth = (data: Pick<TargetsYear, "elapsed" | "currentMonth">): number =>
  data.elapsed > 0 && data.elapsed < 1 && data.currentMonth >= 1 && data.currentMonth <= 12 ? data.currentMonth : 0;

