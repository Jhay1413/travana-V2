import { normaliseClockTime, timesIn } from './flight-legs.validate';
import type { ItineraryRow } from './itinerary-day-rows';

// Verifier for AI-extracted itinerary days (itinerary-extraction-ai.service.ts).
// PURE: no I/O, no AI. The model is trusted for STRUCTURE only: every port name
// and every time it returns must literally appear in the section text the agent
// picked, or the day is dropped. A wrong port on a quote is worse than a blank.

export interface AiItineraryDay {
  day: number;
  port: string;
  arrive: string; // "HH:MM" or ""
  depart: string; // "HH:MM" or ""
  at_sea: boolean;
}

export const MAX_ITINERARY_DAYS = 60;
const MIN_PORT_CHARS = 3;
const MIN_SURVIVING_DAYS = 2;
const MAX_FAILED_SHARE = 0.3;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 24-hour times the section states, including 12-hour forms ("5:00 pm" -> 17:00,
// "5pm" -> 17:00). Currency-guarded like the flights verifier ("£1.50" is not a time).
function sectionTimes(text: string): Set<string> {
  const out = timesIn(text);
  for (const m of text.matchAll(/(?<![\d:.]|[£$€]\s?)(\d{1,2})(?:[:.](\d{2}))?\s?([ap])\.?m\b/gi)) {
    let h = Number(m[1]);
    const min = m[2] ?? '00';
    if (h < 1 || h > 12) continue;
    const pm = m[3].toLowerCase() === 'p';
    if (pm && h < 12) h += 12;
    if (!pm && h === 12) h = 0;
    const t = normaliseClockTime(`${h}:${min}`);
    if (t) out.add(t);
  }
  return out;
}

function portAppears(flatLower: string, port: string): boolean {
  const name = port.trim().replace(/\s+/g, ' ').toLowerCase();
  if (name.length < MIN_PORT_CHARS) return false;
  return new RegExp(`(?<!\\p{L})${escapeRe(name)}(?!\\p{L})`, 'u').test(flatLower);
}

function subDescription(arrive: string, depart: string): string | undefined {
  const parts = [arrive ? `Arrive ${arrive}` : '', depart ? `Depart ${depart}` : ''].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * Keeps only the AI days whose every value is traceable to `sectionText` and maps
 * them to itinerary rows (sea days -> description "At sea").
 *
 * A day is dropped unless: its day number is a positive integer strictly greater
 * than the previous kept day; a port day names a port (3+ chars) that appears as
 * a whole word/phrase in the section; a sea day is allowed only when the section
 * mentions "sea"; each non-empty time is valid and appears in the section. The
 * WHOLE result is discarded (returns []) when more than 60 days came back, fewer
 * than 2 days survive, or more than ~30% of the returned days failed.
 */
export function verifyAiItinerary(days: readonly AiItineraryDay[], sectionText: string): ItineraryRow[] {
  if (days.length === 0 || days.length > MAX_ITINERARY_DAYS) return [];
  const flatLower = sectionText.replace(/\s+/g, ' ').toLowerCase();
  const times = sectionTimes(sectionText);
  const mentionsSea = /\bsea\b/i.test(sectionText);

  const rows: ItineraryRow[] = [];
  let lastDay = 0;
  let failed = 0;
  for (const d of days) {
    const arrive = d.arrive.trim() ? normaliseClockTime(d.arrive) : '';
    const depart = d.depart.trim() ? normaliseClockTime(d.depart) : '';
    const timesOk = (!d.arrive.trim() || (arrive && times.has(arrive))) && (!d.depart.trim() || (depart && times.has(depart)));
    const placeOk = d.at_sea ? mentionsSea : portAppears(flatLower, d.port);
    if (!Number.isInteger(d.day) || d.day <= lastDay || !timesOk || !placeOk) {
      failed++;
      continue;
    }
    lastDay = d.day;
    const sub = subDescription(arrive, depart);
    rows.push({ day: d.day, description: d.at_sea ? 'At sea' : d.port.trim(), ...(sub ? { sub_description: sub } : {}) });
  }

  if (rows.length < MIN_SURVIVING_DAYS || failed > days.length * MAX_FAILED_SHARE) return [];
  return rows;
}
