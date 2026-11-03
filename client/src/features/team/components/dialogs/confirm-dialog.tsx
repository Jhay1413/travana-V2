import type { ReactNode } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DANGER_GHOST, OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";

export type DialogTone = "amber" | "red";

export const TONE_TILE: Record<DialogTone, string> = {
  amber: "bg-ticket-amber-bg text-ticket-amber-fg",
  red: "bg-stage-lost-bg text-stage-lost-fg",
};

/** The round icon tile at the top of a small confirmation dialog. */
export function DialogIconTile({ tone, children }: { tone: DialogTone; children: ReactNode }) {
  return <div className={cn("mb-3 grid h-11 w-11 place-items-center rounded-xl", TONE_TILE[tone])}>{children}</div>;
}

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  tone?: DialogTone;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  icon?: ReactNode;
  testId?: string;
}

/** Small yes/no dialog (role changes, discarding edits). */
export function ConfirmDialog({ open, title, children, confirmLabel, tone = "amber", pending, onConfirm, onClose, icon, testId }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-[460px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid={testId ?? "confirm-dialog"}>
        <DialogIconTile tone={tone}>{icon ?? <AlertTriangle className="h-5 w-5" />}</DialogIconTile>
        <DialogTitle className="text-[18px] font-semibold">{title}</DialogTitle>
        <DialogDescription asChild>
          <div className="text-[14px] leading-relaxed text-social-muted">{children}</div>
        </DialogDescription>
        <div className="mt-2 flex justify-end gap-2.5">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            className={tone === "red" ? cn(DANGER_GHOST, "bg-stage-lost-bg") : PRIMARY_ACTION}
            onClick={onConfirm}
            disabled={pending}
            data-testid="button-confirm"
          >
            {pending && <Loader2 className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
