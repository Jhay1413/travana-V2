import type { AgentProfileBranch, OpeningPattern } from "../types";
import { addDays, daysBetween, dayOf, weekdayIndex } from "./dates";

/** Mon-Fri is the default when a person has no shop with an opening pattern. */
export const DEFAULT_PATTERN: OpeningPattern = "mon-fri";

export function isWorkingDay(key: string, pattern: OpeningPattern | null | undefined): boolean {
  const dow = weekdayIndex(key);
  switch (pattern ?? DEFAULT_PATTERN) {
    case "seven-days":
      return true;
    case "mon-sat":
      return dow <= 5;
    default:
      return dow <= 4;
  }
}

/** Working days from `from` to `to`, both included. */
export function countWorkingDays(from: string, to: string, pattern: OpeningPattern | null | undefined): number {
  const span = daysBetween(from, to);
  let n = 0;
  for (let i = 0; i <= span; i++) if (isWorkingDay(addDays(from, i), pattern)) n++;
  return n;
}

/** The person's shop pattern: an active shop first, then any shop, else Mon-Fri. */
export function patternForBranches(branches: readonly AgentProfileBranch[]): OpeningPattern {
  const shops = branches.filter((b) => b.branchType === "shop" && b.openingPattern);
  const pick = shops.find((b) => b.isActive) ?? shops[0];
  return pick?.openingPattern ?? DEFAULT_PATTERN;
}

/** The part of a leave range that falls inside [from, to] (inclusive), or null when they do not meet. */
export function clipRange(leaveFrom: string, leaveTo: string, from: string, to: string): { from: string; to: string } | null {
  const a = dayOf(leaveFrom) > from ? dayOf(leaveFrom) : from;
  const b = dayOf(leaveTo) < to ? dayOf(leaveTo) : to;
  return a <= b ? { from: a, to: b } : null;
}
