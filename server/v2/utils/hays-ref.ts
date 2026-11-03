import { HAYS_REF_MESSAGE, normaliseHaysRef } from "@shared/booking-refs";
import { AppError } from "./error-handler";

/** Returns the canonical HAYS Ref or throws a 400 AppError when the format is wrong. */
export function requireHaysRef(value: string): string {
  const normalised = normaliseHaysRef(value);
  if (!normalised) throw new AppError(HAYS_REF_MESSAGE, 400);
  return normalised;
}

/**
 * For creating a booking: a blank / missing ref is allowed and returned as is (undefined),
 * a non-empty ref must be valid and comes back in canonical form.
 */
export function normaliseNewHaysRef(raw: unknown): string | undefined {
  const trimmed = typeof raw === "string" ? raw.trim() : "";
  return trimmed ? requireHaysRef(trimmed) : undefined;
}
