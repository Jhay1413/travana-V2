import { combineLocal, isFutureLocal } from "@/features/social/lib/schedule-time";

export type ScheduleValidation =
  | { ok: true; local: string; utcIso: string }
  | { ok: false; error: string };

export const FUTURE_ERROR = "Pick a date and time in the future.";

/** Validates the picked date ("YYYY-MM-DD") and time ("HH:mm"): both required and strictly in the future. */
export function validateSchedule(date: string, time: string, now: Date = new Date()): ScheduleValidation {
  if (!date || !time) return { ok: false, error: FUTURE_ERROR };
  const local = `${date}T${time}`;
  if (!isFutureLocal(local, now)) return { ok: false, error: FUTURE_ERROR };
  const combined = combineLocal(date, time);
  return { ok: true, local: combined.local, utcIso: combined.utcIso };
}
