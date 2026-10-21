import { isLondonTomorrow, isSameLondonDay } from "@/lib/london-day";

/** Formats a task due date as "Today 15:15" / "Tomorrow 15:15" / "Mon 14 Sep 09:30", or "No date". */
export function formatDueDateTime(due: string | null | undefined, now: Date = new Date()): string {
  if (!due) return "No date";
  const d = new Date(due);
  if (isNaN(d.getTime())) return "No date";

  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });

  // Day boundaries are Europe/London, the zone the server uses for "due today".
  if (isSameLondonDay(d, now)) return `Today ${time}`;
  if (isLondonTomorrow(d, now)) return `Tomorrow ${time}`;

  const weekday = d.toLocaleDateString("en-GB", { weekday: "short" });
  const day = d.getDate();
  // Slice to 3 letters — some ICU versions render "short" September as "Sept".
  const month = d.toLocaleDateString("en-GB", { month: "short" }).slice(0, 3);
  return `${weekday} ${day} ${month} ${time}`;
}

/** Whether an ISO due date falls on the same Europe/London calendar day as `now`. */
export function isDueToday(due: string | null | undefined, now: Date = new Date()): boolean {
  if (!due) return false;
  const d = new Date(due);
  return !Number.isNaN(d.getTime()) && isSameLondonDay(d, now);
}
