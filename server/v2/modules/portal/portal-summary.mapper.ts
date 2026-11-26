import type { PortalQuoteListItem } from '@shared/portal-quotes';
import type { PortalSummaryNextBooking, PortalSummaryPriceHeld } from '@shared/portal-summary';
import { toUkWallClock } from '../../utils/uk-time';
import type { PortalBookingDto } from './portal.types';

const DAY_MS = 86_400_000;

/** The UK calendar day of an instant, as "YYYY-MM-DD". */
export function ukDay(instant: Date): string {
  const w = toUkWallClock(instant);
  return `${String(w.year).padStart(4, '0')}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

/** Days since the epoch of a "YYYY-MM-DD" day; whole numbers, so a clock change can never shift a difference. */
export function dayNumber(isoDay: string): number {
  const [y, m, d] = isoDay.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** "YYYY-MM-DD" from a date column value (a string, or a Date at midnight UTC). */
export function toIsoDay(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

export interface BookingTiming {
  booking: PortalBookingDto;
  startDate: string;
  endDate: string;
  daysToGo: number;
}

/**
 * The customer's bookings that have not finished (the last day is today or later), soonest first.
 * The repository has already left out LOST and inactive bookings.
 */
export function unfinishedBookings(bookings: PortalBookingDto[], now: Date): BookingTiming[] {
  const today = dayNumber(ukDay(now));
  return bookings
    .map((booking) => {
      const startDate = toIsoDay(booking.travel_date);
      // No recorded length: it counts as a one-day trip, so it stops being upcoming the day after it.
      const endDate = booking.return_date ? toIsoDay(booking.return_date) : startDate;
      return { booking, startDate, endDate, daysToGo: dayNumber(startDate) - today };
    })
    .filter((t) => dayNumber(t.endDate) >= today)
    .sort((a, b) => a.daysToGo - b.daysToGo);
}

/** The next holiday: the soonest booking that has not started yet (one away right now is not "next"). */
export function pickNextBooking(timings: BookingTiming[]): BookingTiming | null {
  return timings.find((t) => t.daysToGo >= 0) ?? null;
}

export function buildNextBooking(
  t: BookingTiming,
  facts: { board: string | null; adults: number; children: number; infants: number },
): PortalSummaryNextBooking {
  return {
    id: t.booking.id,
    title: t.booking.title,
    destination: t.booking.destination,
    startDate: t.startDate,
    endDate: t.booking.return_date ? t.endDate : null,
    nights: t.booking.nights,
    board: facts.board,
    adults: facts.adults,
    children: facts.children,
    infants: facts.infants,
    imageUrl: t.booking.image_url,
    daysToGo: t.daysToGo,
  };
}

/** Quotes the customer has not answered (neither "interested" nor "not interested"). */
export function undecidedQuotes(quotes: PortalQuoteListItem[]): PortalQuoteListItem[] {
  return quotes.filter((q) => q.decision.state === 'none');
}

/**
 * The undecided quote whose held price ends soonest. Only a real expiry still in the future counts: no expiry,
 * an unreadable one, one already past, and any quote the customer has answered are all ignored.
 */
export function pickPriceHeld(quotes: PortalQuoteListItem[], now: Date): PortalSummaryPriceHeld | null {
  const today = dayNumber(ukDay(now));
  let best: { quote: PortalQuoteListItem; at: number } | null = null;
  for (const q of undecidedQuotes(quotes)) {
    if (!q.expiry_date) continue;
    const at = new Date(q.expiry_date).getTime();
    if (Number.isNaN(at) || at <= now.getTime()) continue;
    if (!best || at < best.at) best = { quote: q, at };
  }
  if (!best) return null;
  const expiresAt = new Date(best.at);
  return {
    token: best.quote.token,
    title: best.quote.title,
    total: best.quote.price,
    expiresAt: expiresAt.toISOString(),
    expiresOn: ukDay(expiresAt),
    daysLeft: Math.max(0, dayNumber(ukDay(expiresAt)) - today),
  };
}
