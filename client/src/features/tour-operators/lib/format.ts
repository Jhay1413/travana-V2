const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short" });
const DAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric" });
const MONTH = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", month: "short" });

/** "trade.example.com" for "https://trade.example.com/". */
export function displayWeb(url: string | null | undefined): string {
  if (!url) return "";
  return url.trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

/** A safe href: the stored address, with https:// added when missing. */
export function hrefFor(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/** "Updated Mon 12 Oct" in London time; "" when the date is unreadable. */
export function updatedLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Updated ${WEEKDAY.format(d)} ${DAY.format(d)} ${MONTH.format(d)}`;
}

/** "14 weeks" / "1 week". */
export function balanceLabel(weeks: number): string {
  return `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** "10%" for "10.00", "8.5%" for "8.50"; "—" when not set. */
export function commissionLabel(value: string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${n}%` : "—";
}
