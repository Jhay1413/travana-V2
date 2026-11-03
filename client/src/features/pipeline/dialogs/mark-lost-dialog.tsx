import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Confirmation shown before any deal is marked as lost. */
export function MarkLostDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <AlertDialogContent className="max-w-sm rounded-2xl border-social-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[16px] font-semibold">Mark as lost?</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px] text-social-muted">
            The deal moves to Lost Deals. You can reopen it from there at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-10 rounded-[10px] border-social-border text-[13px] font-semibold" data-testid="button-keep-deal">
            Keep deal
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-10 rounded-[10px] bg-destructive text-[13px] font-semibold text-destructive-foreground hover:bg-destructive/90"
            onClick={onConfirm}
            data-testid="button-confirm-mark-lost"
          >
            Mark as lost
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
