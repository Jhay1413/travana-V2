/**
 * Formatting Utilities for Quote Page
 * Pure functions for formatting dates, times, and display values.
 */

/**
 * Format ISO date to UK format (DD/MM/YYYY)
 */
export function formatUKDate(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Format lead source enum to readable text
 */
export function formatLeadSource(source: string | null | undefined): string {
  if (!source) return "—";
  return source.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Format task due date relative to now
 */
export function formatTaskDue(dueDate: string): { text: string; isOverdue: boolean } {
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { text: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  if (diffDays === 0) return { text: "Due today", isOverdue: false };
  if (diffDays === 1) return { text: "Due tomorrow", isOverdue: false };
  if (diffDays < 7) return { text: `Due in ${diffDays}d`, isOverdue: false };

  return { text: `Due ${formatUKDate(dueDate)}`, isOverdue: false };
}

/**
 * Format time to 24h format (HH:MM)
 */
export function formatTime24(timeStr: string): string {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

/**
 * Format date for timeline display (e.g., "Mon, 12 Apr 2024")
 */
export function formatTimelineDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { 
    weekday: "short", 
    day: "numeric", 
    month: "short", 
    year: "numeric" 
  });
}

/**
 * Split ISO datetime into [date, time] parts
 */
export function splitIsoDateTime(iso: string | null | undefined): {
  date: string;
  time: string;
} {
  if (!iso) return { date: "", time: "" };
  const parts = iso.split("T");
  const date = parts[0] || "";
  const time = parts[1] ? parts[1].substring(0, 5) : "";
  return { date, time };
}

/**
 * Format an ISO datetime string to "D Mon at HH:MM"
 */
export function formatIsoDateTime(isoStr: string | null): string {
  if (!isoStr) return "";
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  const date = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

/**
 * Format tag label (trim and normalize spaces)
 */
export function formatTagLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/**
 * Normalize package type for consistency
 */
export function normalizePackageType(raw: string): string {
  const map: Record<string, string> = {
    "Package (Flight + Hotel)": "Package Holiday",
    Cruise: "Cruise Package",
  };
  return map[raw] || raw;
}
