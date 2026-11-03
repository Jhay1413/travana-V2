// Validation for the two booking references (HAYS Ref and Supplier Ref).
// The HAYS Ref must be "HAY-" plus 7 or 8 digits (input is forgiving: any case, spaces, no hyphen)
// and is returned in the canonical form, e.g. "hay1234567" -> "HAY-1234567". The Supplier Ref is
// free text, required and trimmed. Pass `originalHaysRef` when editing an existing booking: older
// bookings use other formats, so the HAYS format is only enforced when the value was changed.
import { HAYS_REF_MESSAGE, normaliseHaysRef } from "@shared/booking-refs";

export interface BookingRefsInput {
  haysRef: string;
  supplierRef: string;
}

export interface BookingRefsErrors {
  haysRef?: string;
  supplierRef?: string;
}

export type BookingRefsResult =
  | { ok: true; value: BookingRefsInput }
  | { ok: false; errors: BookingRefsErrors };

export function validateRefs(input: BookingRefsInput, originalHaysRef?: string): BookingRefsResult {
  const rawHays = input.haysRef.trim();
  const supplierRef = input.supplierRef.trim();
  const errors: BookingRefsErrors = {};
  let haysRef = rawHays;
  if (!rawHays) {
    errors.haysRef = "Enter the HAYS reference.";
  } else if (originalHaysRef === undefined || rawHays !== originalHaysRef.trim()) {
    const normalised = normaliseHaysRef(rawHays);
    if (normalised) haysRef = normalised;
    else errors.haysRef = HAYS_REF_MESSAGE;
  }
  if (!supplierRef) errors.supplierRef = "Enter the supplier reference.";
  if (errors.haysRef || errors.supplierRef) return { ok: false, errors };
  return { ok: true, value: { haysRef, supplierRef } };
}
