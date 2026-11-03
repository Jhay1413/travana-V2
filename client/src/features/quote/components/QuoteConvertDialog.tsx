import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { validateRefs, type BookingRefsErrors } from "@/features/client/lib/booking-refs";

interface QuoteConvertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  haysRef: string;
  onHaysRefChange: (value: string) => void;
  tourRef: string;
  onTourRefChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function QuoteConvertDialog({
  open,
  onOpenChange,
  haysRef,
  onHaysRefChange,
  tourRef,
  onTourRefChange,
  isPending,
  onConfirm,
}: QuoteConvertDialogProps) {
  const [errors, setErrors] = useState<BookingRefsErrors>({});
  // onConfirm reads the ref state of the render it belongs to, so store the normalised values
  // first and confirm on the next render.
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!confirming) return;
    setConfirming(false);
    onConfirm();
  }, [confirming, onConfirm]);

  function handleOpenChange(next: boolean) {
    if (!next) setErrors({});
    onOpenChange(next);
  }

  function submit() {
    const result = validateRefs({ haysRef, supplierRef: tourRef });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onHaysRefChange(result.value.haysRef);
    onTourRefChange(result.value.supplierRef);
    setConfirming(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl"
        data-testid="dialog-convert-booking"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Enter the booking references to convert this quote.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
            <Input
              value={haysRef}
              onChange={(e) => onHaysRefChange(e.target.value)}
              placeholder="e.g. HAY-1234567"
              aria-invalid={Boolean(errors.haysRef)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid="input-convert-hays-ref"
            />
            {errors.haysRef && (
              <p className="text-xs font-medium text-red-600" data-testid="error-convert-hays-ref">{errors.haysRef}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Supplier Ref</Label>
            <Input
              value={tourRef}
              onChange={(e) => onTourRefChange(e.target.value)}
              placeholder="e.g. TUI 78451236"
              aria-invalid={Boolean(errors.supplierRef)}
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid="input-convert-tour-ref"
            />
            {errors.supplierRef && (
              <p className="text-xs font-medium text-red-600" data-testid="error-convert-tour-ref">{errors.supplierRef}</p>
            )}
          </div>
          <Button
            className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
            data-testid="button-confirm-convert"
            onClick={submit}
            disabled={isPending}
          >
            {isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
