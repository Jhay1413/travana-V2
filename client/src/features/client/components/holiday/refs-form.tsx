import { useState, type FormEvent } from "react";
import { validateRefs, type BookingRefsErrors, type BookingRefsInput } from "@/features/client/lib/booking-refs";
import { HOLIDAY_BTN, HOLIDAY_BTN_NAVY, HOLIDAY_INPUT } from "@/features/client/components/holiday/holiday-styles";

/**
 * The two reference inputs (HAYS Ref, Supplier Ref) with inline errors.
 * Shared by RefsForm (booking card) and ConvertDialog.
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

/**
 * Edit form inside the booking references card.
 *
 * Props:
 * - initial: starting values (the booking's current refs).
 * - operatorName: for the Supplier Ref label.
 * - pending: disables Save while the update is in flight.
 * - onCancel: leave edit mode without saving.
 * - onSave: called with the trimmed, validated values only.
 */
export interface RefsFormProps {
  initial: BookingRefsInput;
  operatorName?: string | null;
  pending?: boolean;
  onCancel: () => void;
  onSave: (value: BookingRefsInput) => void;
}

export function RefsForm({ initial, operatorName, pending, onCancel, onSave }: RefsFormProps) {
  const [values, setValues] = useState<BookingRefsInput>(initial);
  const [errors, setErrors] = useState<BookingRefsErrors>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateRefs(values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSave(result.value);
  }

  return (
    <form onSubmit={submit} noValidate className="grid grid-cols-2 gap-3.5 max-[620px]:grid-cols-1" data-testid="holiday-refs-form">
      <RefsFields idPrefix="refs" values={values} onChange={setValues} errors={errors} operatorName={operatorName} autoFocusFirst />
      <div className="col-span-full flex justify-end gap-2">
        <button type="button" className={HOLIDAY_BTN} onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className={HOLIDAY_BTN_NAVY} disabled={pending}>
          Save references
        </button>
      </div>
    </form>
  );
}
