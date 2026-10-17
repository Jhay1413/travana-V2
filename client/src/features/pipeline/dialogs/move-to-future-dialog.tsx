import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  // Local date parts: toISOString() would shift the day for users ahead of / behind UTC.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
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

  useEffect(() => {
    if (open) setDate(tomorrowIso());
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-social-border bg-card">
        <DialogHeader>
          <DialogTitle className="text-[16px] font-semibold">Move to Future</DialogTitle>
          <DialogDescription className="text-[13px] text-social-muted">Choose the date this deal should return to the pipeline.</DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-[12px] font-medium text-social-muted">Return date</Label>
            <Input
              type="date"
              min={min}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-10 rounded-[10px] border-social-border bg-card text-[13px]"
              data-testid="input-future-deal-date"
            />
          </div>
          <Button className={PRIMARY_ACTION} disabled={!date || isSubmitting} onClick={() => onConfirm(date)} data-testid="button-confirm-future-date">
            {isSubmitting ? <Spinner className="h-3.5 w-3.5" /> : "Move to Future"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
