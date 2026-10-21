// Validation for the two booking references (HAYS Ref and Supplier Ref).
// Both are free text, required, and trimmed before they are saved.

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

export function validateRefs(input: BookingRefsInput): BookingRefsResult {
  const haysRef = input.haysRef.trim();
  const supplierRef = input.supplierRef.trim();
  const errors: BookingRefsErrors = {};
  if (!haysRef) errors.haysRef = "Enter the HAYS reference.";
  if (!supplierRef) errors.supplierRef = "Enter the supplier reference.";
  if (errors.haysRef || errors.supplierRef) return { ok: false, errors };
  return { ok: true, value: { haysRef, supplierRef } };
}
