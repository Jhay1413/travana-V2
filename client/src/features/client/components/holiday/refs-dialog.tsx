import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useUpdateBooking } from "@/features/booking/api/use-booking-mutations";
import type { EnrichedBooking } from "@/features/quote/types";
import { validateRefs, type BookingRefsErrors, type BookingRefsInput } from "@/features/client/lib/booking-refs";
import { useToast } from "@/hooks/use-toast";
import { RefsFields } from "@/features/client/components/holiday/refs-form";
import { HOLIDAY_BTN, HOLIDAY_BTN_NAVY } from "@/features/client/components/holiday/holiday-styles";

/**
 * "Booking references" dialog: edits HAYS Ref and Supplier Ref and saves through the booking update.
 *
 * Props:
 * - open / onOpenChange: dialog visibility, owned by RefChips.
 * - booking: the booking detail response (current refs, id, operator name).
 * - bookedLine: "Booked {date} by {owner}" line, may be empty.
 */
export interface RefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: EnrichedBooking;
  bookedLine: string;
}

export function RefsDialog({ open, onOpenChange, booking, bookedLine }: RefsDialogProps) {
  const { toast } = useToast();
  const update = useUpdateBooking();
  const [values, setValues] = useState<BookingRefsInput>({
    haysRef: booking.hays_ref?.trim() ?? "",
    supplierRef: booking.supplier_ref?.trim() ?? "",
  });
  const [errors, setErrors] = useState<BookingRefsErrors>({});

  function submit(e: FormEvent) {
    e.preventDefault();
    // Older bookings use other HAYS formats: only enforce the format when the value changed.
    const result = validateRefs(values, booking.hays_ref ?? "");
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    update.mutate(
      { id: booking.id, data: { hays_ref: result.value.haysRef, supplier_ref: result.value.supplierRef } },
      {
        onSuccess: () => {
          onOpenChange(false);
          toast({ title: "References saved" });
        },
        onError: () => toast({ title: "Could not save the references", variant: "destructive" }),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] rounded-2xl p-6" data-testid="dialog-booking-refs">
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5" data-testid="holiday-refs-form">
          <div>
            <DialogTitle className="text-xl font-semibold">Booking references</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-qp-muted">{bookedLine || "Update the booking references."}</DialogDescription>
          </div>
          <RefsFields
            idPrefix="refs"
            values={values}
            onChange={setValues}
            errors={errors}
            operatorName={booking.main_tour_operator_name ?? null}
            autoFocusFirst
          />
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" className={HOLIDAY_BTN} onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" className={HOLIDAY_BTN_NAVY} disabled={update.isPending}>
              Save references
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
