import type { DepartureChecks, DepartureCheckKey, DepartureRow } from "../types";
import { CHECK_STEPS, stampText } from "./stamp";

/** How many of the four ticket checks are ticked (0 to 4). */
export function stepsDone(checks: DepartureChecks): number {
  return CHECK_STEPS.filter((s) => checks[s.key]).length;
}

/** Completed can be ticked only once all four checks are. */
export function canComplete(checks: DepartureChecks): boolean {
  return stepsDone(checks) === CHECK_STEPS.length;
}

/** Completed box disabled: it can always be unticked, but not ticked early. */
export function completedDisabled(checks: DepartureChecks): boolean {
  return !checks.completed && !canComplete(checks);
}

export interface CheckActor {
  id: string | null;
  name: string | null;
}

/** The row as the server will return it after the tick (optimistic update). Mirrors the server rules. */
export function applyCheck(row: DepartureRow, key: DepartureCheckKey, value: boolean, actor: CheckActor, now: Date): DepartureRow {
  if (key === "completed" && value && !canComplete(row.checks)) return row;
  const checks: DepartureChecks = { ...row.checks, [key]: value };
  const isStep = CHECK_STEPS.some((s) => s.key === key);
  if (isStep && !value) checks.completed = false;
  return {
    ...row,
    checks,
    lastChange: { by: actor.id, byName: actor.name, at: now.toISOString(), what: stampText(key, value) },
  };
}
