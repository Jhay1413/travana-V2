import type { DepartureCheckKey, DepartureLastChange } from "../types";
import { formatChangeTime } from "./day-labels";

export type StepKey = Exclude<DepartureCheckKey, "completed" | "fullyPaid">;

export const CHECK_STEPS: ReadonlyArray<{ key: StepKey; label: string }> = [
  { key: "passportInfo", label: "Passport info" },
  { key: "ticketsInHouse", label: "Tickets in house" },
  { key: "checkIn", label: "Check in" },
  { key: "ticketsPickUp", label: "Tickets pick up" },
];

/** What the stamp says after a tick: "Check in", "Passport info unticked", "Completed", "Marked not paid". */
export function stampText(key: DepartureCheckKey, value: boolean): string {
  if (key === "completed") return value ? "Completed" : "Reopened";
  if (key === "fullyPaid") return value ? "Fully paid" : "Marked not paid";
  const label = CHECK_STEPS.find((s) => s.key === key)?.label ?? key;
  return value ? label : `${label} unticked`;
}

/** "Check in · Tina, Thu 15 Oct, 16:20", or "No changes yet". */
export function lastChangeLine(change: DepartureLastChange | null, now: Date = new Date()): string {
  if (!change) return "No changes yet";
  const when = formatChangeTime(change.at, now);
  const who = change.byName ? `${change.byName}, ${when}` : when;
  return `${change.what} · ${who}`;
}
