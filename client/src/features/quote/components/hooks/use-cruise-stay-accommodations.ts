import { useEffect, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";

// Minimal shape of an extra-accommodation form row. Kept local (and loosely
// typed via useFormContext) so this hook works for both the quote and booking
// forms, whose form-value types differ but share this field array.
type ExtraAccom = {
  bookingRef: string;
  tourOperatorId: string;
  accommodationId: string;
  boardBasisId: string;
  roomType: string;
  checkInDate: string;
  checkInTime: string;
  noOfNights: number;
  cost: number;
  commission: number;
  isIncludedInPackage: boolean;
  // Set on rows auto-created from pre/post-cruise stay.
  cruiseStay?: "pre" | "post";
};

function emptyExtraAccom(): ExtraAccom {
  return {
    bookingRef: "",
    tourOperatorId: "",
    accommodationId: "",
    boardBasisId: "",
    roomType: "",
    checkInDate: "",
    checkInTime: "",
    noOfNights: 0,
    cost: 0,
    commission: 0,
    isIncludedInPackage: true,
  };
}

/**
 * Keeps the extra-accommodation field array in sync with the cruise pre/post
 * stay inputs:
 *
 *  - pre-cruise stay > 0  → one managed "pre" hotel row
 *  - post-cruise stay > 0 → one managed "post" hotel row
 *
 * Managed rows are reconciled (created/updated/removed) without ever touching
 * manually-added accommodations. When the cruise date changes, every extra
 * accommodation's check-in date is defaulted to that date.
 *
 * Used by both the quote and booking extras section. Must be called from a
 * component rendered inside the form's <FormProvider>, and must be given the
 * SAME field-array `replace` that renders the extra-accommodation cards —
 * otherwise the rendered list won't reflect the managed rows (two useFieldArray
 * instances on the same name don't share their rendered `fields`).
 */
export function useCruiseStayAccommodations({
  isCruise,
  replace,
}: {
  isCruise: boolean;
  // The `replace` from the extra-accommodation useFieldArray that renders cards.
  replace: (items: any[]) => void;
}) {
  const { control, getValues } = useFormContext();
  const preCruiseStay = useWatch({ control, name: "preCruiseStay" });
  const postCruiseStay = useWatch({ control, name: "postCruiseStay" });
  const cruiseDate = useWatch({ control, name: "cruiseDate" });

  // Skip the initial mount of each effect: on edit/copy load the form is
  // hydrated with saved values, and we must not clobber saved check-in dates or
  // append managed rows for accommodations that already exist (the cruiseStay
  // marker is form-state only and isn't persisted, so it can't be recovered on
  // load). The effects only act on genuine post-mount user edits.
  const reconcileMounted = useRef(false);
  const dateSyncMounted = useRef(false);

  // Reconcile the managed pre/post hotels whenever the stay counts (or cruise
  // mode) change. Re-uses any existing managed row so user-entered details
  // (accommodation, board basis, etc.) survive a stay-count edit.
  useEffect(() => {
    if (!reconcileMounted.current) {
      reconcileMounted.current = true;
      return;
    }
    const current = (getValues("extraAccommodations") as ExtraAccom[]) ?? [];
    const manual = current.filter((a) => a.cruiseStay !== "pre" && a.cruiseStay !== "post");
    const existingPre = current.find((a) => a.cruiseStay === "pre");
    const existingPost = current.find((a) => a.cruiseStay === "post");
    const date = (getValues("cruiseDate") as string) || "";

    const wantPre = isCruise && Number(preCruiseStay) > 0;
    const wantPost = isCruise && Number(postCruiseStay) > 0;

    const next: ExtraAccom[] = [...manual];
    if (wantPre) {
      const base = existingPre ?? emptyExtraAccom();
      next.push({ ...base, cruiseStay: "pre", noOfNights: Number(preCruiseStay) || 0, checkInDate: base.checkInDate || date });
    }
    if (wantPost) {
      const base = existingPost ?? emptyExtraAccom();
      next.push({ ...base, cruiseStay: "post", noOfNights: Number(postCruiseStay) || 0, checkInDate: base.checkInDate || date });
    }

    if (JSON.stringify(next) !== JSON.stringify(current)) {
      replace(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCruise, preCruiseStay, postCruiseStay]);

  // Default every extra accommodation's check-in date to the cruise date when
  // the cruise date changes.
  useEffect(() => {
    if (!dateSyncMounted.current) {
      dateSyncMounted.current = true;
      return;
    }
    if (!cruiseDate) return;
    const current = (getValues("extraAccommodations") as ExtraAccom[]) ?? [];
    if (current.length === 0) return;
    const next = current.map((a) => ({ ...a, checkInDate: cruiseDate as string }));
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      replace(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cruiseDate]);
}
