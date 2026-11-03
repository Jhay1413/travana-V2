export type TargetStatus = "ahead" | "on_track" | "behind";

export const STATUS_LABEL: Record<TargetStatus, string> = {
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
};

/**
 * Pace = (profit / target) / share of the year gone. 100% or more is Ahead, 90% to 99% On track,
 * under 90% Behind. No target, or none of the year gone yet, is On track.
 */
export function paceStatus(profit: number, target: number, elapsed: number): TargetStatus {
  if (target <= 0 || elapsed <= 0) return "on_track";
  const pace = profit / target / elapsed;
  if (pace >= 1) return "ahead";
  if (pace >= 0.9) return "on_track";
  return "behind";
}

/** Whole-number percentage; 0 when there is no target. */
export const percentOf = (part: number, whole: number): number => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/** Bar fill width, capped at 100. */
export const barPercent = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.max(0, (part / whole) * 100)) : 0;

/** Marker position (0 to 100) for how much of the year has gone. */
export const elapsedPercent = (elapsed: number): number => Math.min(100, Math.max(0, elapsed * 100));
