import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline";

interface DiscardDialogProps {
  open: boolean;
  title?: string;
  children: ReactNode;
  keepLabel?: string;
  discardLabel?: string;
  onKeep: () => void;
  onDiscard: () => void;
  /** Optional third choice, such as "Save draft". */
  extra?: ReactNode;
}

/** "You have unsaved changes" confirmation shared by the drawers and the wizard. */
export function DiscardDialog({ open, title = "Discard your changes?", children, keepLabel = "Keep editing", discardLabel = "Discard changes", onKeep, onDiscard, extra }: DiscardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onKeep()}>
      <DialogContent className="max-w-[460px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="discard-dialog">
        <DialogTitle className="text-[18px] font-semibold">{title}</DialogTitle>
        <DialogDescription className="text-[14px] leading-relaxed text-social-muted">{children}</DialogDescription>
        <div className="mt-2 flex flex-wrap justify-end gap-2.5">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onKeep}>
            {keepLabel}
          </Button>
          <Button type="button" variant="outline" className={extra ? OUTLINE_ACTION : PRIMARY_ACTION} onClick={onDiscard} data-testid="button-discard">
            {discardLabel}
          </Button>
          {extra}
        </div>
      </DialogContent>
    </Dialog>
  );
}
