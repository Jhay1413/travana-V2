/** Pure wording and grouping rules for the portal's Bookings screens. */
import type { PortalBookingListItem, PortalTripStatus } from "@shared/portal-bookings";
import { MAX_ABOUT } from "./message-prefill";

/** "12 days to go", "1 day to go", "You're away now", "Travelled": the short line on a booking. */
export function tripStatusLine(status: PortalTripStatus, daysToGo: number): string {
  if (status === "in_progress") return "You're away now";
  if (status === "past") return "Travelled";
  return `${daysToGo} ${daysToGo === 1 ? "day" : "days"} to go`;
}

export interface HeroCountdown {
  /** The large figure ("12"); null when the trip is not counting down. */
  figure: string | null;
  label: string;
}

/** The booking hero's countdown: a large "N days to go" for an upcoming trip, "You're away" or "Travelled" otherwise. */
export function heroCountdown(status: PortalTripStatus, daysToGo: number): HeroCountdown {
  if (status === "in_progress") return { figure: null, label: "You're away" };
  if (status === "past") return { figure: null, label: "Travelled" };
  return { figure: String(daysToGo), label: daysToGo === 1 ? "Day to go" : "Days to go" };
}

export interface SplitBookings {
  /** Upcoming and in progress: the one you are on first, then the soonest. */
  upcoming: PortalBookingListItem[];
  /** Finished trips, most recent first. */
  past: PortalBookingListItem[];
}

const startOf = (b: PortalBookingListItem): string => (b.travel_date instanceof Date ? b.travel_date.toISOString() : String(b.travel_date)).slice(0, 10);

export function splitBookings(bookings: PortalBookingListItem[]): SplitBookings {
  const upcoming = bookings.filter((b) => b.trip_status !== "past").sort((a, b) => a.days_to_go - b.days_to_go);
  const past = bookings.filter((b) => b.trip_status === "past").sort((a, b) => (startOf(a) < startOf(b) ? 1 : startOf(a) > startOf(b) ? -1 : 0));
  return { upcoming, past };
}

/**
 * "Hotel Roma (HAY-123)": what the composer is prefilled with, so the agent knows which booking. The composer
 * keeps only the first MAX_ABOUT characters, so a long title is shortened (never the reference).
 */
export function aboutBookingText(title: string, reference: string): string {
  const ref = reference.trim();
  const name = title.trim();
  if (!ref) return name.slice(0, MAX_ABOUT);
  const suffix = ` (${ref})`;
  const room = Math.max(1, MAX_ABOUT - suffix.length);
  const short = name.length > room ? `${name.slice(0, Math.max(1, room - 1)).trimEnd()}…` : name;
  return `${short}${suffix}`;
}

/** Where a booked quote's "view" button goes: straight to its booking when the server named one, else the Bookings list. */
export function bookedLink(bookingId: string | null | undefined): string {
  return bookingId ? `/portal/booking/${encodeURIComponent(bookingId)}` : "/portal/bookings";
}

/** The payments placeholder is only shown when `VITE_PORTAL_PAYMENTS` is switched on ("true" or "1"). */
export function paymentsSectionEnabled(raw: string | boolean | undefined): boolean {
  return raw === true || raw === "true" || raw === "1";
}
