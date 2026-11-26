/**
 * Customer portal passports: the shapes shared by the server and the portal client.
 * The full passport number NEVER appears in anything the portal receives; only the last four characters.
 */

export const PORTAL_PASSPORT_SEXES = ["M", "F", "X"] as const;
export type PortalPassportSex = (typeof PORTAL_PASSPORT_SEXES)[number];

/** 'ok' = valid for the next trip, 'warning' = expires too soon, 'missing' = nothing saved (or no passport yet). */
export type PortalPassportCheckStatus = "ok" | "warning" | "missing";

export interface PortalPassportCheck {
  status: PortalPassportCheckStatus;
  /** One plain sentence for the customer. */
  text: string;
}

/** Sent in `id` for the lead passenger until a lead row exists; PUT /passengers/lead/passport creates it. */
export const PORTAL_LEAD_PASSENGER_ID = "lead";

export interface PortalPassenger {
  /** A passenger row id, or "lead" for the lead passenger who has no saved row yet. */
  id: string;
  isLead: boolean;
  firstName: string;
  surname: string;
  /** YYYY-MM-DD */
  dateOfBirth: string | null;
  nationality: string | null;
  sex: PortalPassportSex | null;
  /** Last four characters of the saved number, or null when there is none. */
  passportLast4: string | null;
  /** YYYY-MM-DD */
  passportExpiry: string | null;
  /** YYYY-MM-DD */
  passportIssueDate: string | null;
  hasPassport: boolean;
  check: PortalPassportCheck;
}

/** What the customer confirms after the photo is read (or types by hand). Dates are YYYY-MM-DD. */
export interface PortalPassportInput {
  /** Given names. */
  firstName: string;
  surname: string;
  dateOfBirth: string;
  nationality?: string | null;
  sex?: PortalPassportSex | null;
  /** 6-12 letters or digits; upper-cased by the server. */
  passportNumber: string;
  passportIssueDate?: string | null;
  passportExpiry: string;
}

/** The fields read from a photo, for the customer to check and correct. Nothing is saved by reading. */
export interface PortalPassportReadResult {
  surname: string | null;
  givenNames: string | null;
  nationality: string | null;
  dateOfBirth: string | null;
  sex: PortalPassportSex | null;
  passportNumber: string | null;
  dateOfIssue: string | null;
  expiryDate: string | null;
  /** True when a machine-readable zone was read and every check digit matched. */
  mrzVerified: boolean;
}

/** Upload limits for the read endpoint. */
export const PORTAL_PASSPORT_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
