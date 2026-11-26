import { z } from 'zod';
import type { PortalPassportReadResult, PortalPassportSex } from '@shared/portal-passengers';
import { parseTd3 } from './portal-passport-mrz';

/**
 * The ONLY shape a model answer is ever parsed as. Anything else (extra keys, prose, instructions that were
 * printed on the photo) is dropped or fails the parse; nothing here can change what the server does.
 */
const text = (max: number) => z.string().max(max).nullable().optional();

export const passportModelOutputSchema = z.object({
  isPassport: z.boolean(),
  surname: text(100),
  givenNames: text(150),
  nationality: text(100),
  dateOfBirth: text(40),
  sex: text(10),
  passportNumber: text(40),
  dateOfIssue: text(40),
  expiryDate: text(40),
  mrzLine1: text(60),
  mrzLine2: text(60),
});

export type PassportModelOutput = z.infer<typeof passportModelOutputSchema>;

/** The JSON schema sent to the model (strict structured output); it mirrors `passportModelOutputSchema`. */
export const PASSPORT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['isPassport', 'surname', 'givenNames', 'nationality', 'dateOfBirth', 'sex', 'passportNumber', 'dateOfIssue', 'expiryDate', 'mrzLine1', 'mrzLine2'],
  properties: {
    isPassport: { type: 'boolean' },
    surname: { type: ['string', 'null'] },
    givenNames: { type: ['string', 'null'] },
    nationality: { type: ['string', 'null'] },
    dateOfBirth: { type: ['string', 'null'] },
    sex: { type: ['string', 'null'] },
    passportNumber: { type: ['string', 'null'] },
    dateOfIssue: { type: ['string', 'null'] },
    expiryDate: { type: ['string', 'null'] },
    mrzLine1: { type: ['string', 'null'] },
    mrzLine2: { type: ['string', 'null'] },
  },
} as const;

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function realYmd(y: number, m: number, d: number): string | null {
  if (y < 1000 || y > 9999) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** "2031-05-04", "04/05/2031", "04.05.2031" or "04 MAY 2031" as an ISO date; null when it is none of these or not a real day. */
export function toIsoDate(value: string | null | undefined): string | null {
  const v = (value ?? '').trim().toUpperCase();
  if (!v) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return realYmd(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{1,2})[/.\- ](\d{1,2})[/.\- ](\d{4})$/.exec(v);
  if (m) return realYmd(Number(m[3]), Number(m[2]), Number(m[1]));
  m = /^(\d{1,2})[ \-/]?([A-Z]{3})[A-Z]*[ \-/]?(\d{4})$/.exec(v);
  if (m) {
    const month = MONTHS.indexOf(m[2]!);
    return month === -1 ? null : realYmd(Number(m[3]), month + 1, Number(m[1]));
  }
  return null;
}

/** Passport number: letters and digits only, upper-cased, 6 to 12 long; null otherwise. */
export function toPassportNumber(value: string | null | undefined): string | null {
  const v = (value ?? '').toUpperCase().replace(/[\s<\-]/g, '');
  return /^[A-Z0-9]{6,12}$/.test(v) ? v : null;
}

export function toSex(value: string | null | undefined): PortalPassportSex | null {
  const v = (value ?? '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'M';
  if (v === 'F' || v === 'FEMALE') return 'F';
  if (v === 'X' || v === '<') return 'X';
  return null;
}

/** Names are shown in plain capitals-then-lower case when the passport printed them all in capitals. */
export function toNameText(value: string | null | undefined, max = 100): string | null {
  const v = (value ?? '').replace(/\s+/g, ' ').replace(/[^\p{L}\p{M}'’\- .]/gu, '').trim().slice(0, max);
  if (!v) return null;
  if (v !== v.toUpperCase()) return v;
  return v.toLowerCase().replace(/(^|[\s'’\-.])(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

function toNationality(value: string | null | undefined): string | null {
  const v = (value ?? '').replace(/\s+/g, ' ').replace(/[^\p{L}\p{M}'’\- .]/gu, '').trim().slice(0, 100);
  if (!v) return null;
  return v === v.toUpperCase() && v.length > 3 ? toNameText(v) : v;
}

const TRANSLITERATIONS: Record<string, string> = { Ä: 'AE', Ö: 'OE', Ü: 'UE', ß: 'SS', ẞ: 'SS', Ø: 'OE', Æ: 'AE', Å: 'AA', Œ: 'OE', Þ: 'TH', Ð: 'D', Đ: 'D', Ł: 'L' };

/** Upper-case letters only, with accents turned into the zone's A-Z the way ICAO 9303 allows (both "Ü" -> "UE" and "Ü" -> "U"). */
function mrzForms(name: string): string[] {
  const upper = name.toUpperCase();
  const expanded = [...upper].map((c) => TRANSLITERATIONS[c] ?? c).join('');
  const plain = [...upper].map((c) => (c === 'Ø' ? 'O' : c === 'Ł' ? 'L' : c === 'Ð' || c === 'Đ' ? 'D' : c)).join('');
  const strip = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').replace(/[^A-Z]/g, '');
  return [strip(expanded), strip(plain)];
}

/** True when the printed name is the zone's name with its accents and transliterations restored (MÜLLER / MUELLER, STRØM / STROEM, STRASSE / STRAßE). */
export function sameNameIgnoringAccents(visual: string | null | undefined, mrzName: string | null | undefined): boolean {
  if (!visual || !mrzName) return false;
  const target = mrzName.toUpperCase().replace(/[^A-Z]/g, '');
  if (!target) return false;
  return mrzForms(visual).includes(target);
}

export interface PlausibleDates {
  dateOfBirth: string | null;
  dateOfIssue: string | null;
  expiryDate: string | null;
}

/** Drops dates that cannot be right (birth in the future or before 1900, issue in the future, expiry absurdly far away, expiry not after issue). */
export function plausibleDates(dates: PlausibleDates, today: string): PlausibleDates {
  const year = Number(today.slice(0, 4));
  const dob = dates.dateOfBirth && dates.dateOfBirth >= '1900-01-01' && dates.dateOfBirth < today ? dates.dateOfBirth : null;
  let issue = dates.dateOfIssue && dates.dateOfIssue >= '1950-01-01' && dates.dateOfIssue <= today ? dates.dateOfIssue : null;
  const expiry = dates.expiryDate && dates.expiryDate >= '1990-01-01' && dates.expiryDate <= `${year + 20}-12-31` ? dates.expiryDate : null;
  if (issue && expiry && expiry <= issue) issue = null;
  if (dob && issue && issue <= dob) issue = null;
  return { dateOfBirth: dob, dateOfIssue: issue, expiryDate: expiry };
}

/** How many of the identifying fields were usable; fewer than two means "not a passport / unreadable". */
const MIN_USABLE_FIELDS = 2;

/**
 * Turns the parsed model answer into the fields shown to the customer. When the machine-readable zone was read
 * and its check digits are correct in code, its values win; a field whose own check digit fails is never taken
 * from the zone. Returns null when this is not a passport or too little could be read.
 */
export function normalisePassportRead(output: PassportModelOutput, now: Date = new Date()): PortalPassportReadResult | null {
  if (!output.isPassport) return null;
  const today = now.toISOString().slice(0, 10);

  const mrz = output.mrzLine1 && output.mrzLine2 ? parseTd3(output.mrzLine1, output.mrzLine2, now) : null;
  const fromMrz = mrz?.valid === true;

  const number = (mrz?.checks.number ? toPassportNumber(mrz.passportNumber) : null) ?? toPassportNumber(output.passportNumber);
  const dob = (mrz?.checks.dateOfBirth ? mrz.dateOfBirth : null) ?? toIsoDate(output.dateOfBirth);
  const expiry = (mrz?.checks.expiry ? mrz.expiryDate : null) ?? toIsoDate(output.expiryDate);
  // Names: the zone's spelling, unless the printed name is the same name with its accents (then the printed one is kept).
  const pickName = (visual: string | null | undefined, zone: string | undefined, max: number): string | null => {
    if (fromMrz && zone) return toNameText(sameNameIgnoringAccents(visual, zone) ? visual : zone, max);
    return toNameText(visual, max);
  };
  const surname = pickName(output.surname, mrz?.surname, 100);
  const givenNames = pickName(output.givenNames, mrz?.givenNames, 150);
  const sex = (fromMrz ? mrz?.sex ?? null : null) ?? toSex(output.sex);
  const nationality = toNationality(output.nationality) ?? (fromMrz && mrz?.nationalityCode ? mrz.nationalityCode : null);

  const dates = plausibleDates({ dateOfBirth: dob, dateOfIssue: toIsoDate(output.dateOfIssue), expiryDate: expiry }, today);

  const usable = [surname, number, dates.dateOfBirth, dates.expiryDate].filter((v) => v !== null).length;
  if (usable < MIN_USABLE_FIELDS) return null;

  return {
    surname,
    givenNames,
    nationality,
    dateOfBirth: dates.dateOfBirth,
    sex,
    passportNumber: number,
    dateOfIssue: dates.dateOfIssue,
    expiryDate: dates.expiryDate,
    mrzVerified: fromMrz,
  };
}
