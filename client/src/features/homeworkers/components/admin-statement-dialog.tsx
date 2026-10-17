import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useFinaliseStatement, useHomeworkerStatement } from "../api/use-statement-queries";
import { currentMonth, finaliseEnabled, monthLabel, monthPeriod, type MonthRef } from "../lib/statement";
import type { HomeworkerListItem } from "../types";
import { MonthPicker, StatementBody } from "./statement-view";

/** Admin statement for one homeworker. Month-based: finalise freezes a whole calendar month once it has ended. */
export function AdminStatementDialog({ homeworker, onClose }: { homeworker: HomeworkerListItem | null; onClose: () => void }) {
  return homeworker ? <Inner key={homeworker.branchId} homeworker={homeworker} onClose={onClose} /> : null;
}

function Inner({ homeworker, onClose }: { homeworker: HomeworkerListItem; onClose: () => void }) {
  const { toast } = useToast();
  const [month, setMonth] = useState<MonthRef>(() => currentMonth());
  const [confirming, setConfirming] = useState(false);
  const { from, to } = monthPeriod(month);
  const statement = useHomeworkerStatement(homeworker.branchId, from, to);
  const finalise = useFinaliseStatement();

  const canFinalise = finaliseEnabled(statement.data, finalise.isPending);

  const doFinalise = () => {
    finalise.mutate(
      { branchId: homeworker.branchId, from, to },
      {
        onSuccess: () => {
          toast({ title: "Statement finalised", description: `${homeworker.name} - ${monthLabel(month)}` });
          setConfirming(false);
        },
        onError: (err: unknown) => {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast({ title: "Couldn't finalise", description: message ?? "Something went wrong", variant: "destructive" });
          setConfirming(false);
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Statement - {homeworker.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <MonthPicker month={month} onChange={setMonth} />
          <Button
            onClick={() => setConfirming(true)}
            disabled={!canFinalise}
            title={!canFinalise && !statement.data?.finalised ? "Available once the month has ended" : undefined}
            data-testid="button-finalise-statement"
          >
            {finalise.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Finalise
          </Button>
        </div>
        <StatementBody result={statement.data} isLoading={statement.isLoading} isError={statement.isError} />

        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Finalise {monthLabel(month)}?</AlertDialogTitle>
              <AlertDialogDescription>
                This freezes the figures for {homeworker.name}. They will no longer follow later changes to bookings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={doFinalise} data-testid="button-confirm-finalise">Finalise</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}
