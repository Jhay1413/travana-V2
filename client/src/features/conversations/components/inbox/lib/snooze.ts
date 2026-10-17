export type SnoozePresetId = "1h" | "later_today" | "tomorrow" | "next_week";

export const SNOOZE_PRESETS: { id: SnoozePresetId; label: string; sub: string }[] = [
  { id: "1h", label: "In 1 hour", sub: "Back in 60 minutes" },
  { id: "later_today", label: "Later today", sub: "5:00 PM, or in 2 hours" },
  { id: "tomorrow", label: "Tomorrow morning", sub: "9:00 AM" },
  { id: "next_week", label: "Next week", sub: "Monday 9:00 AM" },
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function at(base: Date, dayOffset: number, hour: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, hour, 0, 0, 0);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Local-time "HH:mm". */
export function formatClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Three-letter local weekday, e.g. "Mon". */
export function dayName(d: Date): string {
  return DAY_NAMES[d.getDay()];
}

/** Later today = 17:00, or now + 2h once it is 15:00 or later (capped at 23:30 today). */
export function snoozeUntil(id: SnoozePresetId, now: Date): Date {
  switch (id) {
    case "1h":
      return new Date(now.getTime() + 60 * 60 * 1000);
    case "later_today": {
      if (now.getHours() < 15) return at(now, 0, 17);
      const plus2h = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      // Past ~21:30 +2h would spill into tomorrow: clamp to 23:30 today.
      const cap = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 30, 0, 0);
      return plus2h.getTime() > cap.getTime() ? cap : plus2h;
    }
    case "tomorrow":
      return at(now, 1, 9);
    case "next_week": {
      const daysToMonday = (8 - now.getDay()) % 7 || 7;
      return at(now, daysToMonday, 9);
    }
  }
}

/** "Back today 15:30" / "Back tomorrow 09:00" / "Back Mon 09:00". */
export function snoozeLabel(until: Date, now: Date): string {
  if (until.getTime() <= now.getTime()) return "Back now";
  const diffDays = Math.round((startOfDay(until).getTime() - startOfDay(now).getTime()) / 86_400_000);
  const when = diffDays <= 0 ? "today" : diffDays === 1 ? "tomorrow" : dayName(until);
  return `Back ${when} ${formatClock(until)}`;
}
