import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { Spinner } from "@/components/ui/spinner";

interface QuoteExpiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expiryDate: string;
  onExpiryDateChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function QuoteExpiryDialog({
  open,
  onOpenChange,
  expiryDate,
  onExpiryDateChange,
  isPending,
  onConfirm,
}: QuoteExpiryDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl"
        data-testid="dialog-update-expiry"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Update Expiry Date</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Set a new expiry date for this quote.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Expiry Date</Label>
            <DatePicker
              value={expiryDate}
              onChange={onExpiryDateChange}
              className="h-9"
              data-testid="input-expiry-date"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9 flex-1 rounded-xl border-black/10"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="h-9 flex-1 rounded-xl bg-gray-900 text-white hover:bg-gray-800"
              disabled={!expiryDate || isPending}
              data-testid="button-confirm-expiry"
              onClick={onConfirm}
            >
              {isPending ? <Spinner className="h-3.5 w-3.5" /> : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
