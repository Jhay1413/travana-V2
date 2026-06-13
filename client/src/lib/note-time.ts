/**
 * Timestamp formatting for notes/replies (pipeline drawer, enquiry details,
 * quote details). Naive timestamps from the API (no timezone suffix) are
 * treated as UTC so the relative + absolute values stay consistent everywhere.
 */

function parseTimestamp(date: string | Date): Date {
  if (date instanceof Date) return date;
  // Append "Z" when the string carries no timezone so it's parsed as UTC.
  return new Date(/Z|[+-]\d{2}:?\d{2}$/.test(date) ? date : date.replace(" ", "T") + "Z");
}

/** e.g. "Just now", "5m ago", "3h ago", "2d ago", or a date once older than a week. */
export function formatRelativeTime(date: string | Date): string {
  const d = parseTimestamp(date);
  const diffMins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Full created date + time, e.g. "10 Jun 2025, 14:30". */
export function formatFullDateTime(date: string | Date): string {
  return parseTimestamp(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
