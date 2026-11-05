// Client phone rule (client and server): a UK number of exactly 11 digits once
// spaces, hyphens, dots and brackets are removed. +44 / 0044 is converted to the
// leading-0 form; any other country code is rejected. The stored form is the
// 11 digits with no spacing, e.g. "07123456789".
const PHONE_SHAPE = /^\+?[\d\s().-]+$/;
const UK_DIGITS = 11;

/** Longest raw input a phone field accepts (digits plus spacing/punctuation). */
export const PHONE_INPUT_MAX_LENGTH = 20;
export const PHONE_ERROR_MESSAGE = "Enter an 11-digit UK number, e.g. 07123 456789";

/** The stored 11-digit form of a UK phone number, or null when the input breaks the rule. */
export function normalizePhoneNumber(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!PHONE_SHAPE.test(v)) return null;
  if (v.indexOf("+") > 0) return null;
  let digits = v.replace(/\D/g, "");
  if (v.startsWith("+")) {
    if (!digits.startsWith("44")) return null;
    digits = "0" + digits.slice(2).replace(/^0/, "");
  } else if (digits.startsWith("0044")) {
    digits = "0" + digits.slice(4).replace(/^0/, "");
  }
  return digits.length === UK_DIGITS && digits.startsWith("0") ? digits : null;
}

/** True when the value is an acceptable client phone number under the UK rule. */
export function isValidPhoneNumber(value: string | null | undefined): boolean {
  return normalizePhoneNumber(value) !== null;
}

/**
 * Loose "looks like a phone, not an opaque id" check for DISPLAY only (inbox
 * handles can be foreign WhatsApp numbers): dial characters, 7-15 digits.
 */
export function looksLikePhoneHandle(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!PHONE_SHAPE.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15;
}

/** Copy of a client payload with phoneNumber trimmed (untouched when absent). */
export function withTrimmedPhone<T extends { phoneNumber?: string | null }>(data: T): T {
  return typeof data.phoneNumber === "string" ? { ...data, phoneNumber: data.phoneNumber.trim() } : data;
}

/** Copy of a client payload with phoneNumber in stored form when it is valid, else just trimmed. */
export function withNormalizedPhone<T extends { phoneNumber?: string | null }>(data: T): T {
  if (typeof data.phoneNumber !== "string") return data;
  return { ...data, phoneNumber: normalizePhoneNumber(data.phoneNumber) ?? data.phoneNumber.trim() };
}

/**
 * True when an edit must have its phone checked: it is present and differs from
 * the stored number (so legacy-format numbers can stay when the phone is untouched).
 */
export function isPhoneChanged(next: string | null | undefined, stored: string | null | undefined): boolean {
  if (typeof next !== "string") return false;
  return next.trim() !== (stored ?? "").trim();
}
