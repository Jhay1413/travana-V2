import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface QuoteShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string | null;
  shareCopied: boolean;
  shareLoading: boolean;
  onCopy: () => void;
}

export function QuoteShareDialog({
  open,
  onOpenChange,
  shareToken,
  shareCopied,
  shareLoading,
  onCopy,
}: QuoteShareDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl"
        data-testid="dialog-share-quote"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Share Quote</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Copy the link below and send it to your customer.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {shareLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-black/40" />
            </div>
          ) : shareToken ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={`${window.location.origin}/view-quote/${shareToken}`}
                className="flex-1 rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2 text-xs text-black/70 outline-none"
                data-testid="input-share-link"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <Button
                size="sm"
                className="h-9 rounded-xl px-4"
                data-testid="button-copy-share-link"
                onClick={onCopy}
              >
                {shareCopied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                {shareCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-black/50">Failed to generate link. Please close and try again.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
