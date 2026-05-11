import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";

interface QuoteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageLabel: string;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
}

export function QuoteDeleteDialog({
  open,
  onOpenChange,
  pageLabel,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
}: QuoteDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-sm rounded-2xl border-red-200 bg-white/95 backdrop-blur-xl"
        data-testid="dialog-admin-delete-quote"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold text-red-600">Delete {pageLabel}</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            This action cannot be undone. Please provide a reason for deleting this {pageLabel.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Reason for deletion</Label>
            <textarea
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Enter the reason for deleting this record..."
              className="min-h-[80px] w-full resize-none rounded-xl border border-black/10 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30"
              data-testid="textarea-delete-reason"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9 flex-1 rounded-xl border-black/10"
              onClick={() => onOpenChange(false)}
              data-testid="button-cancel-delete"
            >
              Cancel
            </Button>
            <Button
              className="h-9 flex-1 rounded-xl bg-red-600 text-white hover:bg-red-700"
              data-testid="button-confirm-delete"
              disabled={!reason.trim() || isPending}
              onClick={onConfirm}
            >
              {isPending ? <Spinner className="h-3.5 w-3.5" /> : "Delete"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
