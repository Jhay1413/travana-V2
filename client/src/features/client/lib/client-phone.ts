import { isValidPhoneNumber, PHONE_ERROR_MESSAGE } from "@shared/phone";

/**
 * Inline error for a client phone field, or null when there is nothing to show.
 * An empty value is left to the form's required-field check. When `original`
 * (the stored number) is given, an unchanged value is never flagged, so a
 * client with a legacy bad number can still be edited in other fields.
 */
export function getClientPhoneError(value: string, original?: string | null): string | null {
  const v = value.trim();
  if (!v) return null;
  if (original !== undefined && v === (original ?? "").trim()) return null;
  return isValidPhoneNumber(v) ? null : PHONE_ERROR_MESSAGE;
}

/** The server's message from a rejected request (the axios interceptor rejects with an Error), else the fallback. */
export function getRequestErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
