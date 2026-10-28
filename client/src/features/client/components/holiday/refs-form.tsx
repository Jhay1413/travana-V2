import type { BookingRefsErrors, BookingRefsInput } from "@/features/client/lib/booking-refs";
import { HOLIDAY_INPUT } from "@/features/client/components/holiday/holiday-styles";

/**
 * The two reference inputs (HAYS Ref, Supplier Ref) with inline errors.
 * Shared by RefsDialog (booking hero) and ConvertDialog.
 *
 * Props:
 * - idPrefix: makes input ids unique when two forms can be on screen.
 * - values / onChange: controlled { haysRef, supplierRef }.
 * - errors: inline messages from validateRefs.
 * - operatorName: shown in the Supplier Ref label, e.g. "Supplier Ref (TUI)".
 * - autoFocusFirst: focus the HAYS input on mount.
 * - placeholders: show the example placeholders (used by the convert dialog).
 */
export interface RefsFieldsProps {
  idPrefix: string;
  values: BookingRefsInput;
  onChange: (values: BookingRefsInput) => void;
  errors: BookingRefsErrors;
  operatorName?: string | null;
  autoFocusFirst?: boolean;
  placeholders?: boolean;
}

export function RefsFields({ idPrefix, values, onChange, errors, operatorName, autoFocusFirst, placeholders }: RefsFieldsProps) {
  const supplierLabel = operatorName ? `Supplier Ref (${operatorName})` : "Supplier Ref";
  return (
    <>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-hays`} className="text-[13px] font-semibold">
          HAYS Ref
        </label>
        <input
          id={`${idPrefix}-hays`}
          value={values.haysRef}
          onChange={(e) => onChange({ ...values, haysRef: e.target.value })}
          placeholder={placeholders ? "e.g. HAY105391" : undefined}
          aria-invalid={Boolean(errors.haysRef)}
          aria-describedby={errors.haysRef ? `${idPrefix}-hays-err` : undefined}
          autoFocus={autoFocusFirst}
          className={HOLIDAY_INPUT}
        />
        {errors.haysRef && (
          <span id={`${idPrefix}-hays-err`} className="text-[12.5px] font-medium text-status-failed-fg">
            {errors.haysRef}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <label htmlFor={`${idPrefix}-supplier`} className="text-[13px] font-semibold">
          {supplierLabel}
        </label>
        <input
          id={`${idPrefix}-supplier`}
          value={values.supplierRef}
          onChange={(e) => onChange({ ...values, supplierRef: e.target.value })}
          placeholder={placeholders ? "e.g. TUI 78451236" : undefined}
          aria-invalid={Boolean(errors.supplierRef)}
          aria-describedby={errors.supplierRef ? `${idPrefix}-supplier-err` : undefined}
          className={HOLIDAY_INPUT}
        />
        {errors.supplierRef && (
          <span id={`${idPrefix}-supplier-err`} className="text-[12.5px] font-medium text-status-failed-fg">
            {errors.supplierRef}
          </span>
        )}
      </div>
    </>
  );
}
