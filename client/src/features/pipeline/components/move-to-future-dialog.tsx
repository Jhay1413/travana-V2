import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Small dialog collecting the return date when a deal is moved to the
 *  Future Deals column (drag-and-drop or the card's overflow menu). */
export function MoveToFutureDialog({
  open,
  onOpenChange,
  onConfirm,
  isSubmitting,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (futureDealDate: string) => void;
  isSubmitting?: boolean;
}) {
  const min = tomorrowIso();
  const [date, setDate] = useState(min);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-gray-200 bg-white">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Move to Future</DialogTitle>
          <DialogDescription className="text-xs text-gray-500">Choose the date this deal should return to the pipeline.</DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-gray-600">Return date</Label>
            <Input
              type="date"
              min={min}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9 rounded-xl border-gray-200 bg-gray-50"
              data-testid="input-future-deal-date"
            />
          </div>
          <Button
            className="h-9 w-full rounded-xl bg-[#2196c4] text-white hover:bg-[#2196c4]/90"
            disabled={!date || isSubmitting}
            onClick={() => onConfirm(date)}
            data-testid="button-confirm-future-date"
          >
            {isSubmitting ? <Spinner className="h-3.5 w-3.5" /> : "Move to Future"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
