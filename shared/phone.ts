// One phone-number rule for the client and server: only dial characters,
// 7-15 digits (E.164 max). Opaque ids (UUIDs, hex, long numeric platform ids)
// fail one of the two checks.
const PHONE_SHAPE = /^\+?[\d\s().-]+$/;

export const PHONE_MIN_DIGITS = 7;
export const PHONE_MAX_DIGITS = 15;
/** Longest raw input a phone field accepts (digits plus spacing/punctuation). */
export const PHONE_INPUT_MAX_LENGTH = 20;
export const PHONE_ERROR_MESSAGE = `Enter a valid phone number (${PHONE_MIN_DIGITS}–${PHONE_MAX_DIGITS} digits)`;

/** True when the string looks like a real phone number rather than an opaque id. */
export function isValidPhoneNumber(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!PHONE_SHAPE.test(v)) return false;
  const digits = v.replace(/\D/g, "").length;
  return digits >= PHONE_MIN_DIGITS && digits <= PHONE_MAX_DIGITS;
}

/** Copy of a client payload with phoneNumber trimmed (untouched when absent). */
export function withTrimmedPhone<T extends { phoneNumber?: string | null }>(data: T): T {
  return typeof data.phoneNumber === "string" ? { ...data, phoneNumber: data.phoneNumber.trim() } : data;
}
