/**
 * Machine-readable zone (ICAO 9303 TD3: two lines of 44 characters, the format of a passport booklet).
 * Pure functions: the check digits are verified here, in code, never trusted from the model.
 */

const WEIGHTS = [7, 3, 1] as const;

function charValue(ch: string): number | null {
  if (ch === '<') return 0;
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48;
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55;
  return null;
}

/** ICAO 9303 check digit (weights 7, 3, 1) of a string of A-Z, 0-9 and "<"; null when it holds anything else. */
export function mrzCheckDigit(field: string): number | null {
  let sum = 0;
  for (let i = 0; i < field.length; i += 1) {
    const v = charValue(field[i]!);
    if (v === null) return null;
    sum += v * WEIGHTS[i % 3]!;
  }
  return sum % 10;
}

/** True when `digit` (a single character, or "<" for an empty optional field) is the check digit of `field`. */
export function mrzDigitMatches(field: string, digit: string): boolean {
  if (digit === '<') return /^<*$/.test(field);
  if (!/^\d$/.test(digit)) return false;
  return mrzCheckDigit(field) === Number(digit);
}

export interface ParsedMrz {
  issuingCountry: string;
  surname: string;
  givenNames: string;
  /** Document number with the filler removed. */
  passportNumber: string;
  /** Three-letter nationality code, e.g. "GBR". */
  nationalityCode: string;
  /** YYYY-MM-DD, or null when the date in the zone is not a real date. */
  dateOfBirth: string | null;
  sex: 'M' | 'F' | 'X' | null;
  expiryDate: string | null;
  checks: { number: boolean; dateOfBirth: boolean; expiry: boolean; personalNumber: boolean; composite: boolean };
  /** Every check digit matched. */
  valid: boolean;
}

/** Cleans one line the way a reader would: upper-case, no spaces, look-alike « as "<". */
export function cleanMrzLine(line: string): string {
  return line.toUpperCase().replace(/\s+/g, '').replace(/[«‹＜]/g, '<');
}

function realYmd(y: number, m: number, d: number): string | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** YYMMDD to a full date. A birth date is in the past, so a two-digit year later than this year's is last century. */
export function mrzDate(yymmdd: string, kind: 'birth' | 'expiry', now: Date = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null;
  const yy = Number(yymmdd.slice(0, 2));
  const m = Number(yymmdd.slice(2, 4));
  const d = Number(yymmdd.slice(4, 6));
  const thisYear = now.getUTCFullYear();
  const century = Math.floor(thisYear / 100) * 100;
  const year = kind === 'birth' ? (century + yy > thisYear ? century - 100 + yy : century + yy) : 2000 + yy;
  return realYmd(year, m, d);
}

function readName(field: string): { surname: string; givenNames: string } {
  const [surname = '', ...rest] = field.split('<<');
  const clean = (s: string) => s.replace(/</g, ' ').replace(/\s+/g, ' ').trim();
  return { surname: clean(surname), givenNames: clean(rest.join(' ')) };
}

/** Parses two TD3 lines. Returns null unless both are exactly 44 valid MRZ characters and line 1 starts with "P". */
export function parseTd3(line1: string, line2: string, now: Date = new Date()): ParsedMrz | null {
  const l1 = cleanMrzLine(line1);
  const l2 = cleanMrzLine(line2);
  if (l1.length !== 44 || l2.length !== 44) return null;
  if (!/^[A-Z0-9<]+$/.test(l1) || !/^[A-Z0-9<]+$/.test(l2)) return null;
  if (l1[0] !== 'P') return null;

  const numberField = l2.slice(0, 9);
  const dobField = l2.slice(13, 19);
  const expiryField = l2.slice(21, 27);
  const personalField = l2.slice(28, 42);
  const sexChar = l2[20]!;

  const checks = {
    number: mrzDigitMatches(numberField, l2[9]!),
    dateOfBirth: mrzDigitMatches(dobField, l2[19]!),
    expiry: mrzDigitMatches(expiryField, l2[27]!),
    personalNumber: mrzDigitMatches(personalField, l2[42]!),
    composite: mrzDigitMatches(l2.slice(0, 10) + l2.slice(13, 20) + l2.slice(21, 43), l2[43]!),
  };
  const { surname, givenNames } = readName(l1.slice(5));

  return {
    issuingCountry: l1.slice(2, 5).replace(/</g, ''),
    surname,
    givenNames,
    passportNumber: numberField.replace(/</g, ''),
    nationalityCode: l2.slice(10, 13).replace(/</g, ''),
    dateOfBirth: mrzDate(dobField, 'birth', now),
    sex: sexChar === 'M' || sexChar === 'F' ? sexChar : sexChar === 'X' || sexChar === '<' ? 'X' : null,
    expiryDate: mrzDate(expiryField, 'expiry', now),
    checks,
    valid: checks.number && checks.dateOfBirth && checks.expiry && checks.personalNumber && checks.composite,
  };
}
