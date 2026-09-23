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
import { cn } from "@/lib/utils";
import { currency, formatUKDate } from "@/features/quote/components/quote-types";
import type { QuoteDeleteSibling } from "@/features/quote/components/hooks/use-quote-delete";

interface QuoteDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageLabel: string;
  reason: string;
  onReasonChange: (value: string) => void;
  isPending: boolean;
  onConfirm: () => void;
  /** When the quote being deleted is the transaction's primary quote and has
   *  live siblings, one MUST be chosen here to promote before the delete can
   *  proceed. Omitted (or empty) callers — e.g. booking deletes — see the
   *  dialog exactly as it looked before this was added. */
  siblings?: QuoteDeleteSibling[];
  newPrimaryQuoteId?: string;
  onNewPrimaryQuoteIdChange?: (id: string) => void;
}

export function QuoteDeleteDialog({
  open,
  onOpenChange,
  pageLabel,
  reason,
  onReasonChange,
  isPending,
  onConfirm,
  siblings,
  newPrimaryQuoteId,
  onNewPrimaryQuoteIdChange,
}: QuoteDeleteDialogProps) {
  const requiresNewPrimary = !!siblings && siblings.length > 0;
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
          {requiresNewPrimary && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">
                This is the main quote — choose which copy becomes the new main quote
              </Label>
              <div
                className="grid max-h-40 gap-1.5 overflow-y-auto rounded-xl border border-black/10 p-1.5 dark:border-white/10"
                data-testid="list-delete-new-primary-options"
              >
                {siblings!.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => onNewPrimaryQuoteIdChange?.(s.id)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-xs transition",
                      newPrimaryQuoteId === s.id
                        ? "border-red-500/40 bg-red-500/5 dark:border-red-400/40 dark:bg-red-400/10"
                        : "border-black/10 bg-white/70 hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-white/[0.06]",
                    )}
                    data-testid={`button-new-primary-${s.id}`}
                  >
                    <span className="min-w-0 truncate font-medium">{s.title || "Untitled quote"}</span>
                    <span className="shrink-0 text-black/45 dark:text-white/45">
                      {s.salesPrice ? currency.format(parseFloat(s.salesPrice)) : ""}
                      {s.travelDate ? ` · ${formatUKDate(s.travelDate)}` : ""}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
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
              disabled={!reason.trim() || isPending || (requiresNewPrimary && !newPrimaryQuoteId)}
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
