import { addMonths, format, isValid, parse } from "date-fns";
import {
  LEAD_IDENTITY_MESSAGE,
  normalisePassportNumber,
  passportExpiryDeadline,
  validatePassenger,
  ymdToDmy,
  type PassengerErrors,
} from "@shared/passenger-rules";
import { londonDayKey } from "@/lib/london-day";
import type { ClientPassenger } from "@/features/client/api/client-passenger.api";

export type RightCardTab = "details" | "portal" | "referrals";

export const RIGHT_CARD_TABS: ReadonlyArray<{ value: RightCardTab; label: string }> = [
  { value: "details", label: "Client details" },
  { value: "portal", label: "Portal access" },
  { value: "referrals", label: "Referral network" },
];

export const PASSENGER_TITLES = ["Mr.", "Mrs", "Ms", "Miss"] as const;

function parseYmd(value: string): Date | null {
  const d = parse(value, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : null;
}

/** "2031-05-04" -> "04/05/2031"; "—" when empty or unreadable. */
export function formatPassengerDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = parseYmd(value.slice(0, 10));
  return d ? format(d, "dd/MM/yyyy") : "—";
}

/** Value shown for an optional text field. */
export function orDash(value: string | null | undefined): string {
  const v = value?.trim();
  return v ? v : "—";
}

/** Card label: the lead first, then "PASSENGER 2", "PASSENGER 3"… by list position. */
export function passengerLabel(passenger: Pick<ClientPassenger, "isLead">, index: number): string {
  return passenger.isLead ? "LEAD PASSENGER" : `PASSENGER ${index + 1}`;
}

/** "Mr Jimmy Bouy" - title is optional. */
export function passengerFullName(passenger: Pick<ClientPassenger, "title" | "firstName" | "surname">): string {
  return [passenger.title, passenger.firstName, passenger.surname]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(" ");
}

export function passengerCountLabel(count: number): string {
  return `${count} ${count === 1 ? "passenger" : "passengers"}`;
}

export function passportFootnote(nextDeparture: string | null): string {
  const d = nextDeparture ? parseYmd(nextDeparture.slice(0, 10)) : null;
  if (!d) return "No upcoming bookings yet, so passport expiry is checked against today. Many countries need 6 months left.";
  return `Passport expiry is checked against the next departure, ${format(d, "EEE d MMM yyyy")}. Many countries need 6 months left.`;
}

export interface PassengerDraft {
  title: string;
  firstName: string;
  surname: string;
  dateOfBirth: string;
  passportNumber: string;
  passportExpiry: string;
  passportNonUk: boolean;
}

export const EMPTY_PASSENGER_DRAFT: PassengerDraft = {
  title: "",
  firstName: "",
  surname: "",
  dateOfBirth: "",
  passportNumber: "",
  passportExpiry: "",
  passportNonUk: false,
};

export function draftFromPassenger(p: ClientPassenger | null): PassengerDraft {
  if (!p) return EMPTY_PASSENGER_DRAFT;
  return {
    title: p.title ?? "",
    firstName: p.firstName,
    surname: p.surname,
    dateOfBirth: p.dateOfBirth ?? "",
    passportNumber: p.passportNumber ?? "",
    passportExpiry: p.passportExpiry ?? "",
    passportNonUk: p.passportNonUk,
  };
}

/**
 * Inline errors for a draft, from the shared rules (the server enforces the same ones). For the lead, name, title and
 * date of birth come from the client record, so a gap there is reported as one message on `title`.
 */
export function passengerDraftErrors(
  draft: PassengerDraft,
  opts: { nextDeparture: string | null; isLead?: boolean; today?: string },
): PassengerErrors {
  const errors = validatePassenger(draft, { nextDeparture: opts.nextDeparture, today: opts.today ?? londonDayKey(new Date()), isLead: opts.isLead });
  if (opts.isLead && (errors.title || errors.firstName || errors.surname || errors.dateOfBirth)) {
    return { title: LEAD_IDENTITY_MESSAGE, passportNumber: errors.passportNumber, passportExpiry: errors.passportExpiry };
  }
  return errors;
}

/** Why Save is disabled: the first error in field order, or null when the draft can be saved. */
export function passengerSaveBlockedReason(errors: PassengerErrors): string | null {
  return errors.title ?? errors.firstName ?? errors.surname ?? errors.dateOfBirth ?? errors.passportNumber ?? errors.passportExpiry ?? null;
}

/** "04/05/2027": the last day the passport is NOT acceptable (it must expire after this). */
export function passportExpiryDeadlineLabel(nextDeparture: string | null, today: string = londonDayKey(new Date())): string {
  return ymdToDmy(passportExpiryDeadline(nextDeparture, today));
}

/** Badge wording: measured at travel when there is a next departure, otherwise from today. */
export function passportExpiryFlagLabel(nextDeparture: string | null): string {
  return nextDeparture ? "6 months or less at travel" : "6 months or less left";
}

/**
 * True when the passport has 6 months or less left (expired and exactly-6-months included),
 * measured from the next departure, or from `today` (a London YYYY-MM-DD day, as the server's ukTodayYmd) when there is none. Mirrors the server rule.
 */
export function passportExpiryFlag(expiry: string, nextDeparture: string | null, today: string = londonDayKey(new Date())): boolean {
  const exp = expiry ? parseYmd(expiry.slice(0, 10)) : null;
  if (!exp) return false;
  const dep = nextDeparture ? parseYmd(nextDeparture.slice(0, 10)) : null;
  const base = dep ?? parseYmd(today);
  if (!base) return false;
  const limit = addMonths(base, 6);
  return format(exp, "yyyy-MM-dd") <= format(limit, "yyyy-MM-dd");
}

/** Empty strings become null so the server clears the field. */
export function draftToInput(draft: PassengerDraft) {
  const blank = (v: string) => v.trim() || null;
  return {
    title: blank(draft.title),
    firstName: draft.firstName.trim(),
    surname: draft.surname.trim(),
    dateOfBirth: blank(draft.dateOfBirth),
    passportNumber: blank(normalisePassportNumber(draft.passportNumber, draft.passportNonUk)),
    passportExpiry: blank(draft.passportExpiry),
    passportNonUk: draft.passportNonUk,
  };
}
