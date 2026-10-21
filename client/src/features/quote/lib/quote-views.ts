/**
 * Pure helpers for the "Quote views" card and the stage stepper: merging the
 * client and public view logs into one newest-first list, and the small
 * date / relative-time formats they share.
 */

export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";

export interface ViewLogEntry {
  id: string;
  viewedAt: string;
  deviceType: string | null;
  browser: string | null;
}

export interface ClientViewLogEntry extends ViewLogEntry {
  viewerName: string;
}

export interface ViewStatsInput {
  clientViews: ClientViewLogEntry[];
  publicViews: ViewLogEntry[];
}

export interface RecentView {
  id: string;
  viewedAt: string;
  source: "client" | "public";
  /** The client's name for client views; null for anonymous public-link views. */
  viewerName: string | null;
  deviceKind: DeviceKind;
  /** e.g. "Phone, Safari". */
  device: string;
}

export function deviceKind(deviceType: string | null | undefined): DeviceKind {
  const t = (deviceType ?? "").toLowerCase();
  if (t === "mobile" || t === "tablet" || t === "desktop") return t;
  return "unknown";
}

const KIND_LABEL: Record<DeviceKind, string> = {
  mobile: "Phone",
  tablet: "Tablet",
  desktop: "Computer",
  unknown: "Unknown device",
};

/** "Phone, Safari" / "Computer" / "Unknown device". */
export function deviceLabel(deviceType: string | null | undefined, browser: string | null | undefined): string {
  const base = KIND_LABEL[deviceKind(deviceType)];
  const b = (browser ?? "").trim();
  if (!b || b.toLowerCase() === "unknown") return base;
  return `${base}, ${b}`;
}

function toTime(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** The newest `limit` views across the client and public logs. */
export function recentViews(stats: ViewStatsInput | null | undefined, limit = 10): RecentView[] {
  if (!stats) return [];
  const merged: RecentView[] = [
    ...(stats.clientViews ?? []).map(
      (v): RecentView => ({
        id: `c-${v.id}`,
        viewedAt: v.viewedAt,
        source: "client",
        viewerName: v.viewerName || null,
        deviceKind: deviceKind(v.deviceType),
        device: deviceLabel(v.deviceType, v.browser),
      }),
    ),
    ...(stats.publicViews ?? []).map(
      (v): RecentView => ({
        id: `p-${v.id}`,
        viewedAt: v.viewedAt,
        source: "public",
        viewerName: null,
        deviceKind: deviceKind(v.deviceType),
        device: deviceLabel(v.deviceType, v.browser),
      }),
    ),
  ];
  return merged.sort((a, b) => toTime(b.viewedAt) - toTime(a.viewedAt)).slice(0, Math.max(limit, 0));
}

/** "12 Oct 2026"; empty string for a missing or invalid date. */
export function formatDay(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "14:30" (24-hour); empty string for a missing or invalid date. */
export function formatClock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago", then the date. */
export function timeAgo(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "";
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const mins = Math.floor((now.getTime() - t) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days} day${days === 1 ? "" : "s"} ago`;
  return formatDay(iso);
}

/** "Today", "Yesterday" or "12 Oct" for the views list. */
export function viewDayLabel(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
