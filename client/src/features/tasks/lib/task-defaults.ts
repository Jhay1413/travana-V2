import { addDaysToKey, londonDayKey, londonOffsetMs } from "@/lib/london-day";

/** Default due time for "add a follow-up" pop-ups. */
export const FOLLOW_UP_DUE_TIME = "10:00";

/** Tomorrow's calendar day (YYYY-MM-DD) in Europe/London. */
export function tomorrowLondonKey(now: Date = new Date()): string {
  return addDaysToKey(londonDayKey(now), 1);
}

export interface TaskFormDefaults {
  dueDate: string;
  dueTime: string;
  assignedToId: string;
}

/** Initial form values: caller overrides win, otherwise today 09:00 and the default assignee. */
export function resolveTaskFormDefaults(
  opts: { defaultDueDate?: string; defaultDueTime?: string; defaultAssignedToId?: string },
  today: string,
): TaskFormDefaults {
  return {
    dueDate: opts.defaultDueDate || today,
    dueTime: opts.defaultDueTime || "09:00",
    assignedToId: opts.defaultAssignedToId ?? "",
  };
}

/** True only on the render where the dialog flips closed -> open (the only moment the form resets). */
export function isOpening(prevOpen: boolean, open: boolean): boolean {
  return open && !prevOpen;
}

/** A late-arriving default assignee fills an empty one but never overwrites a choice. */
export function fillEmptyAssignee(current: string, defaultAssignedToId: string | undefined): string {
  return current || defaultAssignedToId || "";
}

/** The instant of a London wall-clock `dateKey` (YYYY-MM-DD) + `time` (HH:mm). DST-safe; null if either is malformed. */
export function londonDueDate(dateKey: string, time: string): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  const t = /^(\d{2}):(\d{2})$/.exec(time);
  if (!d || !t) return null;
  const naive = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), Number(t[1]), Number(t[2]));
  const first = naive - londonOffsetMs(naive);
  return new Date(naive - londonOffsetMs(first));
}
