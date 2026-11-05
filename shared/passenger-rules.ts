/**
 * Client passenger rules, shared by the server (enforcement) and the client (inline errors) so they cannot drift.
 * Pure functions on YYYY-MM-DD strings; no Date or timezone maths.
 *
 * Owner rules: all six fields are mandatory; a passport number is exactly 9 digits unless the passenger is flagged
 * "Non-UK passport" (then 5-20 letters/digits); the passport must be valid for MORE than 6 months after the
 * client's next departure (today, UK day, when there is none).
 */

export type PassengerField = "title" | "firstName" | "surname" | "dateOfBirth" | "passportNumber" | "passportExpiry";

export interface PassengerRuleInput {
  title?: string | null;
  firstName?: string | null;
  surname?: string | null;
  dateOfBirth?: string | null;
  passportNumber?: string | null;
  passportExpiry?: string | null;
  passportNonUk?: boolean | null;
}

export type PassengerErrors = Partial<Record<PassengerField, string>>;

export const PASSPORT_MONTHS_VALID_AFTER_TRAVEL = 6;
export const UK_PASSPORT_LENGTH = 9;
export const NON_UK_PASSPORT_MIN = 5;
export const NON_UK_PASSPORT_MAX = 20;

export const PASSENGER_FIELD_LABELS: Record<PassengerField, string> = {
  title: "Title",
  firstName: "First name",
  surname: "Surname",
  dateOfBirth: "Date of birth",
  passportNumber: "Passport number",
  passportExpiry: "Passport expiry",
};

export const UK_PASSPORT_MESSAGE = "Passport number must be exactly 9 digits (tick Non-UK passport for other formats)";
export const NON_UK_PASSPORT_MESSAGE = "Non-UK passport number must be 5 to 20 letters or digits, with no spaces";

const pad = (n: number): string => String(n).padStart(2, "0");

/** YYYY-MM-DD plus whole calendar months, clamped to month end (31 Aug + 6 = 28/29 Feb). */
export function addMonthsYmd(ymd: string, months: number): string {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${pad(month)}-${pad(Math.min(d, lastDay))}`;
}

/** "2031-05-04" -> "04/05/2031". */
export function ymdToDmy(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Trim; Non-UK numbers are also upper-cased. Empty / null becomes "". */
export function normalisePassportNumber(value: string | null | undefined, nonUk: boolean): string {
  const t = (value ?? "").trim();
  return nonUk ? t.toUpperCase() : t;
}

/** Error text for a passport number (already trimmed/normalised or not), or null when acceptable. */
export function passportNumberError(value: string | null | undefined, nonUk: boolean): string | null {
  const v = normalisePassportNumber(value, nonUk);
  if (!v) return "Passport number is required";
  if (nonUk) {
    return v.length >= NON_UK_PASSPORT_MIN && v.length <= NON_UK_PASSPORT_MAX && /^[A-Z0-9]+$/.test(v) ? null : NON_UK_PASSPORT_MESSAGE;
  }
  return /^\d{9}$/.test(v) ? null : UK_PASSPORT_MESSAGE;
}

/** The day the passport must outlast: next departure, else today, plus 6 months. */
export function passportExpiryDeadline(nextDeparture: string | null | undefined, today: string): string {
  return addMonthsYmd((nextDeparture ?? today).slice(0, 10), PASSPORT_MONTHS_VALID_AFTER_TRAVEL);
}

export function passportExpiryDeadlineMessage(deadline: string): string {
  return `Passport must be valid for more than 6 months after travel (until after ${ymdToDmy(deadline)})`;
}

/** Error text for a passport expiry date, or null when it is more than 6 months after travel. */
export function passportExpiryError(expiry: string | null | undefined, nextDeparture: string | null | undefined, today: string): string | null {
  const e = (expiry ?? "").trim();
  if (!e) return "Passport expiry is required";
  const deadline = passportExpiryDeadline(nextDeparture, today);
  return e.slice(0, 10) > deadline ? null : passportExpiryDeadlineMessage(deadline);
}

export interface PassengerRuleContext {
  nextDeparture: string | null | undefined;
  /** Today's UK calendar day, YYYY-MM-DD. */
  today: string;
  /** Lead: name, title and date of birth come from the client record but are still required. */
  isLead?: boolean;
}

/** Validate every field; returns a map of field -> message (empty when the passenger is acceptable). */
export function validatePassenger(input: PassengerRuleInput, ctx: PassengerRuleContext): PassengerErrors {
  const errors: PassengerErrors = {};
  const blank = (v: string | null | undefined) => !(v ?? "").trim();
  if (blank(input.title)) errors.title = "Title is required";
  if (blank(input.firstName)) errors.firstName = "First name is required";
  if (blank(input.surname)) errors.surname = "Surname is required";
  if (blank(input.dateOfBirth)) errors.dateOfBirth = "Date of birth is required";
  const numberError = passportNumberError(input.passportNumber, !!input.passportNonUk);
  if (numberError) errors.passportNumber = numberError;
  const expiryError = passportExpiryError(input.passportExpiry, ctx.nextDeparture, ctx.today);
  if (expiryError) errors.passportExpiry = expiryError;
  return errors;
}

/** First message in a stable field order, or null. */
export function firstPassengerError(errors: PassengerErrors): string | null {
  const order: PassengerField[] = ["title", "firstName", "surname", "dateOfBirth", "passportNumber", "passportExpiry"];
  for (const f of order) if (errors[f]) return errors[f] ?? null;
  return null;
}

export const LEAD_IDENTITY_MESSAGE = "Add the client's title and date of birth on the client record before saving the lead passenger's passport";
