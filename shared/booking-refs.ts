/**
 * HAYS Ref format shared by client and server: "HAY-" followed by 7 or 8 digits.
 * Input is forgiving (any case, surrounding spaces, hyphen or space or nothing after HAY)
 * and is normalised to the canonical upper-case form, e.g. "hay 1234567" -> "HAY-1234567".
 */
export const HAYS_REF_MESSAGE = "Enter the HAYS Ref as HAY- followed by 7 or 8 numbers, e.g. HAY-1234567.";

const HAYS_REF_PATTERN = /^HAY[\s-]*(\d{7,8})$/i;

/** Returns the canonical HAYS Ref, or null when the value is not in the accepted format. */
export function normaliseHaysRef(raw: string): string | null {
  const match = HAYS_REF_PATTERN.exec(raw.trim());
  return match ? `HAY-${match[1]}` : null;
}

export function isValidHaysRef(raw: string): boolean {
  return normaliseHaysRef(raw) !== null;
}
