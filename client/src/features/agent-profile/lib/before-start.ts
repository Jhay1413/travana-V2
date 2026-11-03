import { dayKeyOf, dayOf, formatDay } from "./dates";

/** True when the whole half-open window ends on or before the member's first day. */
export function windowBeforeStart(windowTo: string, startedAt: string): boolean {
  return dayOf(windowTo) <= dayKeyOf(startedAt);
}

export function beforeStartNote(firstName: string, startedAt: string, what: "figures" | "earnings"): string {
  return `${firstName} started on ${formatDay(dayKeyOf(startedAt))}, so there are no ${what} for this period.`;
}
