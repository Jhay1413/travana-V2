import { buildMonthCells, buildWeekCells } from "../../lib/calendar-grid";

export type CalendarMode = "month" | "week";

export interface VisibleRange {
  /** First visible day, "YYYY-MM-DD". */
  firstDay: string;
  /** Last visible day, "YYYY-MM-DD". */
  lastDay: string;
  /** Start of the first day in local time, as a UTC ISO string. */
  startUtc: string;
  /** End of the last day in local time, as a UTC ISO string. */
  endUtc: string;
}

/** Whole local days covered by the visible grid, expressed as inclusive UTC bounds. */
export function visibleRange(mode: CalendarMode, ym: string, weekStartIso: string): VisibleRange {
  const cells = mode === "month" ? buildMonthCells(ym) : buildWeekCells(weekStartIso);
  const firstDay = cells[0].iso;
  const lastDay = cells[cells.length - 1].iso;
  return {
    firstDay,
    lastDay,
    startUtc: new Date(`${firstDay}T00:00:00`).toISOString(),
    endUtc: new Date(`${lastDay}T23:59:59.999`).toISOString(),
  };
}

/** Local "YYYY-MM-DD" of an instant. */
export function localYmd(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "9:00am" style label of an instant in local time. */
export function chipTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h % 12 === 0 ? 12 : h % 12}:${m}${h >= 12 ? "pm" : "am"}`;
}
