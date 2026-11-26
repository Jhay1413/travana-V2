import {
  PORTAL_PASSPORT_SEXES,
  type PortalPassenger,
  type PortalPassportCheck,
  type PortalPassportInput,
  type PortalPassportReadResult,
  type PortalPassportSex,
} from "@shared/portal-passengers";
import { addMonthsIso, formatLongPassportDate, formatPassportDate, parsePassportDate } from "./passport-dates";

/** What the review form holds: every field as text, exactly as the customer sees and edits it. */
export interface PassportFormValues {
  surname: string;
  givenNames: string;
  nationality: string;
  dateOfBirth: string;
  sex: string;
  passportNumber: string;
  dateOfIssue: string;
  expiryDate: string;
}

export type PassportFormField = keyof PassportFormValues;
export type PassportFormErrors = Partial<Record<PassportFormField, string>>;

/** The design's eight fields, in its order, with its labels. */
export const PASSPORT_FIELDS: ReadonlyArray<{ key: PassportFormField; label: string }> = [
  { key: "surname", label: "Surname" },
  { key: "givenNames", label: "Given names" },
  { key: "nationality", label: "Nationality" },
  { key: "dateOfBirth", label: "Date of birth" },
  { key: "sex", label: "Sex" },
  { key: "passportNumber", label: "Passport number" },
  { key: "dateOfIssue", label: "Date of issue" },
  { key: "expiryDate", label: "Expiry date" },
];

export const EMPTY_PASSPORT_FORM: PassportFormValues = {
  surname: "",
  givenNames: "",
  nationality: "",
  dateOfBirth: "",
  sex: "",
  passportNumber: "",
  dateOfIssue: "",
  expiryDate: "",
};

/** The form as the server's read answer fills it: names and country as read, dates as "22 Oct 2032", number upper-cased. */
export function formFromReadResult(read: PortalPassportReadResult): PassportFormValues {
  return {
    surname: read.surname ?? "",
    givenNames: read.givenNames ?? "",
    nationality: read.nationality ?? "",
    dateOfBirth: formatPassportDate(read.dateOfBirth),
    sex: read.sex ?? "",
    passportNumber: (read.passportNumber ?? "").toUpperCase(),
    dateOfIssue: formatPassportDate(read.dateOfIssue),
    expiryDate: formatPassportDate(read.expiryDate),
  };
}

/** The form pre-filled from a traveller already on the list (for "Update passport"); the number is never known here. */
export function formFromPassenger(p: PortalPassenger | null): PassportFormValues {
  if (!p) return EMPTY_PASSPORT_FORM;
  return {
    surname: p.surname,
    givenNames: p.firstName,
    nationality: p.nationality ?? "",
    dateOfBirth: formatPassportDate(p.dateOfBirth),
    sex: p.sex ?? "",
    passportNumber: "",
    dateOfIssue: formatPassportDate(p.passportIssueDate),
    expiryDate: formatPassportDate(p.passportExpiry),
  };
}

/** M, F or X from what was typed ("m", "Female"), "" for blank, null when it is none of them. */
export function normaliseSex(value: string): PortalPassportSex | "" | null {
  const v = value.trim().toUpperCase();
  if (!v) return "";
  if ((PORTAL_PASSPORT_SEXES as readonly string[]).includes(v)) return v as PortalPassportSex;
  if (v === "MALE") return "M";
  if (v === "FEMALE") return "F";
  return null;
}

const NUMBER_PATTERN = /^[A-Z0-9]{6,12}$/;

export const DATE_HINT = "Write the date like 22 Oct 2032.";
/** The design's wording for the trip-check box when the expiry date can't be read. */
export const DATES_CHECK_HINT = "Write the dates like 22 Oct 2032 so we can check them.";

export type PassportFormResult = { ok: true; input: PortalPassportInput } | { ok: false; errors: PassportFormErrors };

/**
 * Checks the review form and builds what the server takes. Rules match the server's: names, date of birth, a 6-12
 * letter-or-digit number and an expiry date are required; nationality, sex and issue date are optional. Dates may be
 * typed as the customer likes and are sent as YYYY-MM-DD; one that cannot be read gets a field error, never a guess.
 * `today` is a YYYY-MM-DD, passed in so the check can be tested.
 */
export function validatePassportForm(values: PassportFormValues, today: string): PassportFormResult {
  const errors: PassportFormErrors = {};
  const surname = values.surname.trim();
  const given = values.givenNames.trim();
  if (!surname) errors.surname = "Enter the surname.";
  if (!given) errors.givenNames = "Enter the given names.";

  const dob = parsePassportDate(values.dateOfBirth);
  if (!values.dateOfBirth.trim()) errors.dateOfBirth = "Enter the date of birth.";
  else if (!dob) errors.dateOfBirth = DATE_HINT;
  else if (dob > today) errors.dateOfBirth = "The date of birth can't be in the future.";

  const number = values.passportNumber.replace(/\s+/g, "").toUpperCase();
  if (!number) errors.passportNumber = "Enter the passport number.";
  else if (!NUMBER_PATTERN.test(number)) errors.passportNumber = "Use 6 to 12 letters or numbers, with no spaces or dashes.";

  const sex = normaliseSex(values.sex);
  if (sex === null) errors.sex = "Choose M, F or X.";

  let issued: string | null = null;
  if (values.dateOfIssue.trim()) {
    issued = parsePassportDate(values.dateOfIssue);
    if (!issued) errors.dateOfIssue = DATE_HINT;
  }

  const expiry = parsePassportDate(values.expiryDate);
  if (!values.expiryDate.trim()) errors.expiryDate = "Enter the expiry date.";
  else if (!expiry) errors.expiryDate = DATE_HINT;
  else if (issued && issued > expiry) errors.expiryDate = "The expiry date is before the date of issue. Check both.";

  if (Object.keys(errors).length > 0 || !dob || !expiry) return { ok: false, errors };

  const nationality = values.nationality.trim();
  return {
    ok: true,
    input: {
      firstName: given,
      surname,
      dateOfBirth: dob,
      nationality: nationality || null,
      sex: sex || null,
      passportNumber: number,
      passportIssueDate: issued,
      passportExpiry: expiry,
    },
  };
}

/** The trip a passport is measured against on this screen: the booking being shown, when it has not started. */
export interface PreviewTrip {
  destination: string;
  /** YYYY-MM-DD */
  departure: string;
}

/**
 * The server's sentence for a passport, worked out in the browser before saving, using the server's rule (six months or
 * less left at departure, or from today with no trip) and wording. It is a preview: after saving, the server's own
 * `check.text` replaces it. Null while the expiry date is not a readable date.
 */
export function previewPassportCheck(expiryText: string, trip: PreviewTrip | null, agent: string, today: string): PortalPassportCheck | null {
  const expiry = parsePassportDate(expiryText);
  if (!expiry) return null;
  const contact = `${agent || "Your agent"} will be in touch.`;
  const warns = expiry <= addMonthsIso(trip?.departure ?? today, 6);
  if (!warns) {
    return {
      status: "ok",
      text: trip ? `Valid for your trip to ${trip.destination} on ${formatLongPassportDate(trip.departure)}.` : `Valid until ${formatLongPassportDate(expiry)}.`,
    };
  }
  if (trip) {
    const when = formatLongPassportDate(trip.departure);
    return {
      status: "warning",
      text: expiry < trip.departure ? `This passport expires before you travel on ${when}. ${contact}` : `This passport has less than 6 months left when you travel on ${when}. ${contact}`,
    };
  }
  return {
    status: "warning",
    text:
      expiry < today
        ? `This passport expired on ${formatLongPassportDate(expiry)}. ${contact}`
        : `This passport has less than 6 months left (it expires on ${formatLongPassportDate(expiry)}). ${contact}`,
  };
}

/** The design's colours for the trip-check box: white with a sand line when fine, soft red when not. */
export function checkBoxTone(status: PortalPassportCheck["status"]): { background: string; borderColor: string; prefix: string } {
  return status === "ok"
    ? { background: "#FFFFFF", borderColor: "#D9C7B1", prefix: "✓ " }
    : { background: "#FDECEA", borderColor: "#E7B4AD", prefix: "" };
}

// ---- Rows on the bookings screen ----

export type PassengerStatusTone = "added" | "check" | "needed";

/** The word beside a traveller: "Added" (ok), "Check" (the check warns), "Needed" (no passport). The design shows them in capitals. */
export function passengerStatus(p: Pick<PortalPassenger, "hasPassport" | "check">): { label: string; tone: PassengerStatusTone } {
  if (!p.hasPassport) return { label: "Needed", tone: "needed" };
  if (p.check.status === "ok") return { label: "✓ Added", tone: "added" };
  return { label: "Check", tone: "check" };
}

/** "Lead passenger" for the first, "Traveller 2" for the next, and so on. */
export function travellerLabel(index: number): string {
  return index === 0 ? "Lead passenger" : `Traveller ${index + 1}`;
}

/** "Jimmy Bouy", with the design's title-casing for names that were read in capitals. */
export function titleCaseName(value: string): string {
  return value.toLowerCase().replace(/(^|[\s'-])[a-z]/g, (c) => c.toUpperCase());
}

export function passengerName(p: Pick<PortalPassenger, "firstName" | "surname">, index: number): string {
  const name = [titleCaseName(p.firstName.trim()), titleCaseName(p.surname.trim())].filter(Boolean).join(" ");
  return name || travellerLabel(index);
}

/** The four items under a saved passport, as the design lists them. */
export function passportRows(p: PortalPassenger): Array<{ label: string; value: string }> {
  return [
    { label: "Passport no.", value: p.passportLast4 ? `•••••${p.passportLast4}` : "" },
    { label: "Expires", value: formatPassportDate(p.passportExpiry) },
    { label: "Nationality", value: p.nationality ? titleCaseName(p.nationality) : "" },
    { label: "Date of birth", value: formatPassportDate(p.dateOfBirth) },
  ];
}

/** "1 of 2 added" for the Home card and the checklist. */
export function passportCountText(passengers: ReadonlyArray<Pick<PortalPassenger, "hasPassport">>): string {
  return `${passengers.filter((p) => p.hasPassport).length} of ${passengers.length} added`;
}
