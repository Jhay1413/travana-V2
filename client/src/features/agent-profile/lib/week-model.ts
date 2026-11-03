import type { PillTone } from "@/features/admin-dashboard";
import type { AgentProfileWeek, AgentProfileWeekItem } from "../types";
import { MONTH_NAMES, WEEKDAY_NAMES, WEEKDAY_SHORT, addDays, formatDayLong, londonClock, parseKey, weekdayIndex } from "./dates";
import { plural } from "./money";

export type WeekChoice = "this" | "next";

export type WeekKind = AgentProfileWeekItem["kind"];

const KIND: Record<WeekKind, { label: string; one: string; tone: PillTone }> = {
  departure: { label: "Departure", one: "departure", tone: "info" },
  task: { label: "Task", one: "task", tone: "warn" },
};

export interface WeekItemView {
  id: string;
  kind: WeekKind;
  label: string;
  tone: PillTone;
  text: string;
  time: string | null;
}

export interface WeekDayView {
  date: string;
  short: string;
  dayNumber: number;
  isToday: boolean;
  items: WeekItemView[];
}

export interface WeekChip {
  kind: WeekKind;
  tone: PillTone;
  text: string;
}

export interface WeekView {
  total: number;
  summary: string;
  chips: WeekChip[];
  days: WeekDayView[];
}

/** Monday of the London week containing `todayKey`, and the Monday after it. */
export function weekStarts(todayKey: string): Record<WeekChoice, string> {
  const monday = addDays(todayKey, -weekdayIndex(todayKey));
  return { this: monday, next: addDays(monday, 7) };
}

/** "Monday 12 to Sunday 18 October", or both months when the week straddles two. */
export function weekRangeText(startKey: string): string {
  const end = addDays(startKey, 6);
  const a = parseKey(startKey);
  const b = parseKey(end);
  if (a.month === b.month) return `${WEEKDAY_NAMES[0]} ${a.day} to ${WEEKDAY_NAMES[6]} ${b.day} ${MONTH_NAMES[b.month - 1]}`;
  return `${formatDayLong(startKey)} to ${formatDayLong(end)}`;
}

function describe(item: AgentProfileWeekItem): string {
  if (item.kind === "departure") {
    return [item.clientName, item.title].filter(Boolean).join(" · ") || "Departure";
  }
  const lead = item.title || item.entityTitle || "Task";
  return item.clientName ? `${lead} · ${item.clientName}` : lead;
}

function toView(item: AgentProfileWeekItem): WeekItemView {
  const k = KIND[item.kind];
  return {
    id: `${item.kind}-${item.id}`,
    kind: item.kind,
    label: k.label,
    tone: k.tone,
    text: describe(item),
    time: item.kind === "task" ? londonClock(item.dueAt) : null,
  };
}

/** Turns the server's seven days into what the planner draws. Tasks are ordered by time within a day. */
export function buildWeekView(week: AgentProfileWeek | undefined, startKey: string, todayKey: string): WeekView {
  const byDate = new Map((week?.days ?? []).map((d) => [d.date.slice(0, 10), d.items]));
  const counts: Partial<Record<WeekKind, number>> = {};
  const days: WeekDayView[] = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(startKey, i);
    const items = (byDate.get(date) ?? []).map(toView);
    items.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    for (const it of items) counts[it.kind] = (counts[it.kind] ?? 0) + 1;
    return { date, short: WEEKDAY_SHORT[i], dayNumber: parseKey(date).day, isToday: date === todayKey, items };
  });
  const total = days.reduce((n, d) => n + d.items.length, 0);
  const chips = (Object.keys(KIND) as WeekKind[])
    .filter((k) => counts[k])
    .map((k) => ({ kind: k, tone: KIND[k].tone, text: plural(counts[k] ?? 0, KIND[k].one) }));
  return { total, summary: total === 0 ? "Nothing planned." : `${plural(total, "thing")} planned`, chips, days };
}
