import { useEffect, useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useQuoteConvert } from "@/features/quote/components/hooks";
import { formatUKDate } from "@/features/quote/components/quote-types";
import { validateRefs, type BookingRefsErrors } from "@/features/client/lib/booking-refs";
import { gbp2 } from "@/features/client/lib/holiday-format";
import { RefsFields } from "@/features/client/components/holiday/refs-form";
import { HOLIDAY_BTN, HOLIDAY_BTN_PRIMARY } from "@/features/client/components/holiday/holiday-styles";

/**
 * "Convert to booking" dialog: asks for the HAYS Ref and Supplier Ref, then converts the quote
 * (useQuoteConvert), toasts "{title} is booked. HAYS Ref {X}" and navigates to ?holiday=booking:<id>.
 *
 * Props:
 * - open / onOpenChange: dialog visibility, owned by the page (TopBar's onConvert opens it).
 * - quoteId / clientId: passed to useQuoteConvert.
 * - title: quote title, used in the intro line and the success toast.
 * - travelDate: ISO date string of the travel date (formatted dd/mm/yyyy), may be empty.
 * - total: customer total in pounds, shown with two decimals.
 * - operatorName: shown in the Supplier Ref label, may be null.
 */
export interface ConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  clientId: string;
  title: string;
  travelDate: string | null | undefined;
  total: number;
  operatorName: string | null;
}

export function ConvertDialog({ open, onOpenChange, quoteId, clientId, title, travelDate, total, operatorName }: ConvertDialogProps) {
  const convert = useQuoteConvert(quoteId, clientId, {
    successToast: (haysRef) => `${title} is booked. HAYS Ref ${haysRef}`,
  });
  const { convertHaysRef, convertTourRef, setConvertHaysRef, setConvertTourRef, confirmConvert, convertToBookingMutation } = convert;
  const [errors, setErrors] = useState<BookingRefsErrors>({});
  // The hook reads its ref state when confirming, so store the trimmed values first and confirm on the next render.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    setConfirming(false);
    confirmConvert();
  }, [confirming, confirmConvert]);

  const converted = convertToBookingMutation.isSuccess;
  useEffect(() => {
    if (converted) onOpenChange(false);
  }, [converted, onOpenChange]);

  function close(next: boolean) {
    if (!next) {
      setErrors({});
      setConvertHaysRef("");
      setConvertTourRef("");
    }
    onOpenChange(next);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateRefs({ haysRef: convertHaysRef, supplierRef: convertTourRef });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setConvertHaysRef(result.value.haysRef);
    setConvertTourRef(result.value.supplierRef);
    setConfirming(true);
  }

  const intro = [title, travelDate ? formatUKDate(travelDate) : null, gbp2(total)].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-[520px] rounded-2xl p-6" data-testid="dialog-convert-booking">
        <form onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <div>
            <DialogTitle className="text-xl font-semibold">Convert to booking</DialogTitle>
            <DialogDescription className="mt-1 text-[13px] text-qp-muted">
              {intro}. Add the two references from the booking confirmation.
            </DialogDescription>
          </div>
          <RefsFields
            idPrefix="convert"
            values={{ haysRef: convertHaysRef, supplierRef: convertTourRef }}
            onChange={(values) => {
              setConvertHaysRef(values.haysRef);
              setConvertTourRef(values.supplierRef);
            }}
            errors={errors}
            operatorName={operatorName}
            autoFocusFirst
            placeholders
          />
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" className={HOLIDAY_BTN} onClick={() => close(false)}>
              Cancel
            </button>
            <button type="submit" className={HOLIDAY_BTN_PRIMARY} disabled={convertToBookingMutation.isPending}>
              {convertToBookingMutation.isPending ? <Spinner className="size-4" /> : <Check className="size-4" />}
              Confirm booking
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
