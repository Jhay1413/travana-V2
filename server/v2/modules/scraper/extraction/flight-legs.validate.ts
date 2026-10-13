import type { ScrapedFlightJson } from '../../easyjet/easyjet.types';

// Verifier for AI-extracted flight legs (flight-extraction-ai.service.ts). PURE:
// no I/O, no AI. The model is only trusted for STRUCTURE — every value it
// returns must literally appear in the section text the agent picked (or, for a
// date, be explained by the deal's own dates). A leg with any value that cannot
// be traced back to the text is dropped whole, never repaired: a wrong flight
// time on a quote is worse than a blank one the agent types in.

export type FlightDirection = 'outbound' | 'return';

export interface AiFlightLeg {
  direction: FlightDirection;
  flight_number: string;
  departing_airport: string;
  departing_airport_name: string;
  departure_date: string;
  departure_time: string;
  arrival_airport: string;
  arrival_airport_name: string;
  arrival_date: string;
  arrival_time: string;
}

export interface FlightVerifyContext {
  travelDate?: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
}

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS: readonly (readonly string[])[] = [
  ['jan', 'january'],
  ['feb', 'february'],
  ['mar', 'march'],
  ['apr', 'april'],
  ['may'],
  ['jun', 'june'],
  ['jul', 'july'],
  ['aug', 'august'],
  ['sep', 'sept', 'september'],
  ['oct', 'october'],
  ['nov', 'november'],
  ['dec', 'december'],
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** ISO date + n days (UTC arithmetic, so no DST drift); '' when the input isn't an ISO date. */
export function addDaysIso(iso: string, days: number): string {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) return '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** "9:40" / "09.40" / "09:40" -> "09:40"; '' when it isn't a valid clock time. */
export function normaliseClockTime(raw: string): string {
  const m = /^\s*(\d{1,2})[:.](\d{2})\s*$/.exec(raw);
  if (!m) return '';
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return '';
  return `${pad2(h)}:${pad2(min)}`;
}

export function timesIn(text: string): Set<string> {
  const out = new Set<string>();
  // Not glued to other digits/separators and not a price ("£1.50" is not 01:50).
  for (const m of text.matchAll(/(?<![\d:.]|[£$€]\s?)(\d{1,2})[:.](\d{2})(?!\d)/g)) {
    const t = normaliseClockTime(`${m[1]}:${m[2]}`);
    if (t) out.add(t);
  }
  return out;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when the (whitespace-collapsed) text states this calendar date in any
// common UK form: ISO, 12/05/2027, 12 May 2027, Wed 12 May, 12th May, May 12.
// A day+month match that has a 4-digit year right after it must carry THIS
// leg's year ("12 May 2026" does not vouch for 2027-05-12); a year-less
// "Wed 12 May" is accepted.
function dateAppearsIn(flat: string, iso: string): boolean {
  const m = ISO_DATE_RE.exec(iso);
  if (!m) return false;
  const year = m[1];
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (flat.includes(iso)) return true;

  const d = `0?${day}`;
  if (new RegExp(`\\b${d}[/.-]0?${month}[/.-](?:${year}|${year.slice(2)})\\b`).test(flat)) return true;

  const monthNames = (MONTHS[month - 1] ?? []).map(escapeRe).join('|');
  const named = [
    new RegExp(`\\b${d}(?:st|nd|rd|th)?\\s+(?:${monthNames})\\b`, 'gi'),
    new RegExp(`\\b(?:${monthNames})\\.?\\s+${d}(?:st|nd|rd|th)?\\b`, 'gi'),
  ];
  for (const re of named) {
    for (const hit of flat.matchAll(re)) {
      const after = flat.slice((hit.index ?? 0) + hit[0].length, (hit.index ?? 0) + hit[0].length + 15);
      const nearYear = /\b(?:19|20)\d{2}\b/.exec(after)?.[0];
      if (!nearYear || nearYear === year) return true;
    }
  }
  return false;
}

function compact(s: string): string {
  return s.replace(/\s+/g, '').toUpperCase();
}

const FLIGHT_NUMBER_RE = /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/;

// "BA2490" must be printed as its own token, with or without a space between the
// carrier and the digits ("BA 2490").
function flightNumberAppears(text: string, compactNumber: string): boolean {
  const carrier = escapeRe(compactNumber.slice(0, 2));
  const rest = escapeRe(compactNumber.slice(2));
  return new RegExp(`(?<![A-Za-z0-9])${carrier}\\s?${rest}(?![A-Za-z0-9])`, 'i').test(text);
}

function nameAppears(flatLower: string, name: string): boolean {
  const n = name.trim().replace(/\s+/g, ' ').toLowerCase();
  if (n.length < 4) return false;
  return new RegExp(`(?<![a-z])${escapeRe(n)}(?![a-z])`).test(flatLower);
}

/**
 * Keeps only the AI legs whose every value is traceable to `sectionText`, maps
 * them to ScrapedFlightJson and orders outbound legs before return legs
 * (original order kept within each direction).
 *
 * A leg is dropped unless: both times appear in the text (H:MM / HH:MM / HH.MM,
 * never a price); a non-empty flight number is well-formed and appears as its
 * own token; each non-empty airport code appears as a whole word; each non-empty
 * airport name (4+ chars) appears as a whole word/phrase; and each date is
 * stated in the text (with a matching year when one is printed beside it), or
 * equals the deal's travel/return date or the day after either. Also dropped:
 * same departure and arrival airport, arrival at or before departure. An
 * arrival time earlier than the departure time with no arrival date is read as
 * the next day. A leg with NO date falls back to the deal date for its
 * direction, but only for the FIRST leg of each direction; later undated legs
 * are dropped rather than guessed.
 */
export function verifyAiFlightLegs(
  legs: readonly AiFlightLeg[],
  sectionText: string,
  context: FlightVerifyContext,
): ScrapedFlightJson[] {
  const flat = sectionText.replace(/\s+/g, ' ');
  const flatLower = flat.toLowerCase();
  const times = timesIn(sectionText);
  const allowedDates = new Set<string>();
  for (const base of [context.travelDate, context.returnDate]) {
    if (!base || !ISO_DATE_RE.test(base)) continue;
    allowedDates.add(base);
    const next = addDaysIso(base, 1);
    if (next) allowedDates.add(next);
  }

  const dateOk = (iso: string): boolean => dateAppearsIn(flat, iso) || allowedDates.has(iso);
  const codeOk = (code: string): boolean => {
    const c = code.trim().toUpperCase();
    return !c || (/^[A-Z0-9]{2,4}$/.test(c) && new RegExp(`(?<![A-Za-z0-9])${escapeRe(c)}(?![A-Za-z0-9])`).test(sectionText));
  };

  const seenDirection = { outbound: 0, return: 0 };
  const survivors: ScrapedFlightJson[] = [];
  for (const leg of legs) {
    const legIndexInDirection = seenDirection[leg.direction]++;

    const depTime = normaliseClockTime(leg.departure_time);
    const arrTime = normaliseClockTime(leg.arrival_time);
    if (!depTime || !arrTime || !times.has(depTime) || !times.has(arrTime)) continue;

    const number = compact(leg.flight_number);
    if (number && (!FLIGHT_NUMBER_RE.test(number) || !flightNumberAppears(sectionText, number))) continue;
    if (![leg.departing_airport, leg.arrival_airport].every(codeOk)) continue;
    const depCode = leg.departing_airport.trim().toUpperCase();
    const arrCode = leg.arrival_airport.trim().toUpperCase();
    if (depCode && depCode === arrCode) continue;
    const names = [leg.departing_airport_name, leg.arrival_airport_name].filter((n) => n.trim());
    if (!names.every((n) => nameAppears(flatLower, n))) continue;
    if (names.length === 2 && names[0].trim().toLowerCase() === names[1].trim().toLowerCase()) continue;

    const depDate = leg.departure_date.trim();
    const arrDate = leg.arrival_date.trim();
    if ((depDate && !dateOk(depDate)) || (arrDate && !dateOk(arrDate))) continue;

    let departureDate = depDate;
    if (!departureDate) {
      if (legIndexInDirection > 0) continue;
      departureDate = (leg.direction === 'return' ? context.returnDate : context.travelDate) ?? '';
    }
    if (!ISO_DATE_RE.test(departureDate)) continue;
    let arrivalDate = arrDate || departureDate;
    if (!arrDate && arrTime < depTime) arrivalDate = addDaysIso(departureDate, 1);
    if (!ISO_DATE_RE.test(arrivalDate)) continue;

    const departure = `${departureDate}T${depTime}`;
    const arrival = `${arrivalDate}T${arrTime}`;
    if (arrival <= departure) continue; // lands before (or the moment) it leaves

    survivors.push({
      flight_number: leg.flight_number.trim(),
      flight_type: leg.direction,
      departing_airport: depCode,
      departing_airport_name: leg.departing_airport_name.trim(),
      departure_date_time: departure,
      arrival_airport: arrCode,
      arrival_airport_name: leg.arrival_airport_name.trim(),
      arrival_date_time: arrival,
    });
  }

  return [...survivors.filter((l) => l.flight_type === 'outbound'), ...survivors.filter((l) => l.flight_type === 'return')];
}
