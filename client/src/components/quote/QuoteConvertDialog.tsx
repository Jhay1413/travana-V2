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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
              placeholder="e.g. HAYS-12345"
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid="input-convert-hays-ref"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
            <Input
              value={tourRef}
              onChange={(e) => onTourRefChange(e.target.value)}
              placeholder="e.g. TOUR-67890"
              className="h-9 rounded-xl border-black/10 bg-white/70"
              data-testid="input-convert-tour-ref"
            />
          </div>
          <Button
            className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
            data-testid="button-confirm-convert"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
