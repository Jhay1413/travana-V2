import type { LeaveEntry } from "@/features/hr";
import type { OpeningPattern } from "../types";
import { MONTH_NAMES, addDays, dayOf, daysInMonth, formatDayLong, makeKey, weekdayIndex } from "./dates";
import { plural } from "./money";
import { clipRange, countWorkingDays, isWorkingDay } from "./working-days";

export type CalendarState = "holiday" | "sick" | "leave" | "pending" | "off" | "working";

export const CALENDAR_STATE_LABEL: Record<CalendarState, string> = {
  holiday: "holiday",
  sick: "sick",
  leave: "leave",
  pending: "leave requested, waiting for approval",
  off: "not a working day",
  working: "working day",
};

export interface CalendarCell {
  date: string;
  day: number;
  state: CalendarState;
  isToday: boolean;
  /** Screen reader text, e.g. "Thursday 15 October: holiday, today". */
  label: string;
}

export interface CalendarStats {
  workingDaysSoFar: number;
  holidayDays: number;
  sickDays: number;
  pendingRequests: number;
}

export interface LeaveCalendar {
  title: string;
  /** Empty cells before the 1st so the grid starts on Monday. */
  leading: number;
  cells: CalendarCell[];
  stats: CalendarStats;
}

/** Approved leave by type; pending leave is its own state. Rejected and cancelled leave never shows. */
function stateOfLeave(l: LeaveEntry): CalendarState | null {
  if (l.status === "Pending") return "pending";
  if (l.status !== "Approved") return null;
  if (l.type === "Annual") return "holiday";
  if (l.type === "Sick") return "sick";
  return "leave";
}

// When ranges overlap on a day, approved leave wins over pending, sickness over holiday over other leave.
const PRECEDENCE: CalendarState[] = ["sick", "holiday", "leave", "pending"];

export function buildLeaveCalendar(input: {
  year: number;
  month: number;
  todayKey: string;
  pattern: OpeningPattern | null | undefined;
  leaves: readonly LeaveEntry[];
}): LeaveCalendar {
  const { year, month, todayKey, pattern, leaves } = input;
  const first = makeKey(year, month, 1);
  const total = daysInMonth(year, month);
  const last = makeKey(year, month, total);

  const marked = new Map<string, CalendarState>();
  const apply = (date: string, state: CalendarState) => {
    const current = marked.get(date);
    if (!current || PRECEDENCE.indexOf(state) < PRECEDENCE.indexOf(current)) marked.set(date, state);
  };
  for (const l of leaves) {
    const state = stateOfLeave(l);
    const clip = state ? clipRange(l.from, l.to, first, last) : null;
    if (!state || !clip) continue;
    for (let d = clip.from; d <= clip.to; d = addDays(d, 1)) apply(d, state);
  }

  const cells: CalendarCell[] = [];
  let holidayDays = 0;
  let sickDays = 0;
  for (let day = 1; day <= total; day++) {
    const date = makeKey(year, month, day);
    const working = isWorkingDay(date, pattern);
    const mark = marked.get(date);
    const state: CalendarState = !working ? "off" : (mark ?? "working");
    if (state === "holiday") holidayDays++;
    if (state === "sick") sickDays++;
    const isToday = date === todayKey;
    cells.push({
      date,
      day,
      state,
      isToday,
      label: `${formatDayLong(date)}: ${CALENDAR_STATE_LABEL[state]}${isToday ? ", today" : ""}`,
    });
  }

  const soFarEnd = todayKey < last ? todayKey : last;
  const soFarStart = first;
  const workingDaysSoFar = soFarEnd >= soFarStart ? countWorkingDays(soFarStart, soFarEnd, pattern) : 0;
  const pendingRequests = leaves.filter((l) => l.status === "Pending" && clipRange(l.from, l.to, first, last)).length;

  return {
    title: `${MONTH_NAMES[month - 1]} ${year}`,
    leading: weekdayIndex(first),
    cells,
    stats: { workingDaysSoFar, holidayDays, sickDays, pendingRequests },
  };
}

export function statsRows(stats: CalendarStats): Array<{ label: string; value: string }> {
  return [
    { label: "Working days so far", value: String(stats.workingDaysSoFar) },
    { label: "Holiday this month", value: plural(stats.holidayDays, "day") },
    { label: "Sickness this month", value: plural(stats.sickDays, "day") },
    { label: "Pending requests", value: String(stats.pendingRequests) },
  ];
}

/** Step the shown month by `delta`, rolling the year. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}
