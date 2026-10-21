import { formatShortDate } from "./ticket-display";

export type HolidayKind = "booking" | "quote" | "enquiry";

export interface HolidayOption {
  id: string;
  kind: HolidayKind;
  title: string;
  date: string | null;
  /** "Booking · Majorca — 12 Jun 2026" */
  label: string;
  /** Booking only: the HAYS number, else the tour operator's own reference. */
  ref: string | null;
  operatorName: string | null;
  operatorLogoUrl: string | null;
}

export interface HolidayGroup {
  kind: HolidayKind;
  heading: string;
  options: HolidayOption[];
}

const GROUPS: ReadonlyArray<{ kind: HolidayKind; heading: string }> = [
  { kind: "booking", heading: "Bookings" },
  { kind: "quote", heading: "Quotes" },
  { kind: "enquiry", heading: "Enquiries" },
];

/** Bookings, then quotes, then enquiries; empty groups are left out and each group keeps its incoming order. */
export function groupHolidayOptions(options: readonly HolidayOption[]): HolidayGroup[] {
  return GROUPS.map((g) => ({ ...g, options: options.filter((o) => o.kind === g.kind) })).filter((g) => g.options.length > 0);
}

/** Case-insensitive match on the title, reference or operator; a blank query keeps everything. */
export function filterHolidayOptions(options: readonly HolidayOption[], query: string): HolidayOption[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...options];
  return options.filter((o) => [o.title, o.ref, o.operatorName].some((v) => !!v && v.toLowerCase().includes(q)));
}

/** "{ref} · {date}" for a booking, just the date for quotes and enquiries; null when nothing is known. */
export function holidayOptionSubline(option: Pick<HolidayOption, "kind" | "ref" | "date">): string | null {
  const parts: string[] = [];
  if (option.kind === "booking" && option.ref) parts.push(option.ref);
  const date = formatShortDate(option.date);
  if (date) parts.push(date);
  return parts.length > 0 ? parts.join(" · ") : null;
}
