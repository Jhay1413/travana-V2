export type QuietTone = "ok" | "warn" | "danger";

/** Whole days since the last activity; null when unknown. Never negative. */
export function quietDays(lastActivityAt: string | null | undefined, now: Date = new Date()): number | null {
  if (!lastActivityAt) return null;
  const at = new Date(lastActivityAt).getTime();
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.floor((now.getTime() - at) / 86_400_000));
}

/** 7+ days reads as a warning, 14+ as danger. */
export function quietTone(days: number): QuietTone {
  if (days >= 14) return "danger";
  if (days >= 7) return "warn";
  return "ok";
}

export function quietLabel(days: number): string {
  return `${days} ${days === 1 ? "day" : "days"} quiet`;
}
