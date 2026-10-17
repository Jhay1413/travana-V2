// SAMPLE departures for the "Departures and balances" card (prototype copy, not live data).
import { gbp, plural } from "./money";

export type DepartureKind = "ok" | "bal" | "pass";
export type DepartureTone = "ok" | "done" | "warn" | "error";

export interface Departure {
  id: string;
  day: string;
  num: string;
  dayFull: string;
  who: string;
  dest: string;
  meta: string;
  kind: DepartureKind;
  amount?: number;
}

export const DEPARTURES: ReadonlyArray<Departure> = [
  { id: "d1", day: "Sat", num: "17", dayFull: "Sat 17 Oct", who: "A. W.", dest: "Lanzarote", meta: "7 nights, 2 travellers", kind: "ok" },
  { id: "d2", day: "Mon", num: "19", dayFull: "Mon 19 Oct", who: "J. B.", dest: "Dalaman", meta: "10 nights, 2 travellers", kind: "ok" },
  { id: "d3", day: "Wed", num: "21", dayFull: "Wed 21 Oct", who: "S. M.", dest: "Tenerife", meta: "7 nights, 4 travellers", kind: "bal", amount: 1200 },
  { id: "d4", day: "Thu", num: "22", dayFull: "Thu 22 Oct", who: "D. R.", dest: "Orlando", meta: "14 nights, 4 travellers", kind: "pass" },
  { id: "d5", day: "Fri", num: "23", dayFull: "Fri 23 Oct", who: "P. H.", dest: "Gran Canaria", meta: "7 nights, 2 travellers", kind: "bal", amount: 640 },
];

export type DoneMap = Readonly<Record<string, boolean>>;

export interface DepartureRow {
  dep: Departure;
  isDone: boolean;
  hasAction: boolean;
  status: string;
  tone: DepartureTone;
  actionLabel: string;
}

/** Every departure with its status pill and action button text for the given done map. */
export function deriveRows(done: DoneMap): DepartureRow[] {
  return DEPARTURES.map((dep) => {
    const isDone = !!done[dep.id];
    const hasAction = dep.kind !== "ok";
    let status: string;
    let tone: DepartureTone;
    if (dep.kind === "ok") {
      status = "All set";
      tone = "ok";
    } else if (isDone) {
      status = dep.kind === "bal" ? "Chased today" : "Requested today";
      tone = "done";
    } else if (dep.kind === "bal") {
      status = `Balance of ${gbp(dep.amount ?? 0)} due`;
      tone = "warn";
    } else {
      status = "Passport details missing";
      tone = "error";
    }
    const actionLabel = isDone ? "Undo" : dep.kind === "bal" ? "Chase balance" : "Request details";
    return { dep, isDone, hasAction, status, tone, actionLabel };
  });
}

export function owedTotal(done: DoneMap): number {
  return DEPARTURES.filter((d) => d.kind === "bal" && !done[d.id]).reduce((s, d) => s + (d.amount ?? 0), 0);
}

export function passportsMissing(done: DoneMap): number {
  return DEPARTURES.filter((d) => d.kind === "pass" && !done[d.id]).length;
}

/** Departures that still need someone to act. */
export function needsActionCount(done: DoneMap): number {
  return DEPARTURES.filter((d) => d.kind !== "ok" && !done[d.id]).length;
}

export function summaryLine(done: DoneMap): string {
  const owed = owedTotal(done);
  const passports = passportsMissing(done);
  const bits = [`${DEPARTURES.length} departures`];
  if (owed > 0) bits.push(`${gbp(owed)} of balances still to collect`);
  if (passports > 0) bits.push(`${plural(passports, "passport")} missing`);
  return bits.length === 1 ? `${bits[0]}, nothing outstanding.` : bits.join(" · ");
}
