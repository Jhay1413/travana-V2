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
import { useToast } from "@/hooks/use-toast";
import { useArchiveHomeworker } from "../api/use-homeworker-mutations";
import type { HomeworkerListItem } from "../types";

export function ArchiveConfirm({
  homeworker,
  onClose,
}: {
  homeworker: HomeworkerListItem | null;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const archive = useArchiveHomeworker();

  const confirm = () => {
    if (!homeworker) return;
    archive.mutate(homeworker.branchId, {
      onSuccess: () => {
        toast({ title: "Homeworker archived", description: homeworker.name });
        onClose();
      },
      onError: (err: unknown) => {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        toast({ title: "Couldn't archive", description: message ?? "Something went wrong", variant: "destructive" });
      },
    });
  };

  return (
    <AlertDialog open={!!homeworker} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {homeworker?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            They lose access immediately. Their clients and deals stay on the homeworker branch and remain in reports.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={archive.isPending} data-testid="button-confirm-archive-homeworker">
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
