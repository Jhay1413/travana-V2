import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useUpdateHomeworker } from "../api/use-homeworker-mutations";
import { isValidName, MAX_NAME_LENGTH } from "../lib/invite-body";
import { validateProfitShare } from "../lib/profit-share";
import type { HomeworkerListItem, UpdateHomeworkerPayload } from "../types";

export function EditHomeworkerDialog({
  homeworker,
  onClose,
}: {
  homeworker: HomeworkerListItem | null;
  onClose: () => void;
}) {
  // Remount per homeworker so local state always starts from the row's values.
  return homeworker ? <EditForm key={homeworker.branchId} homeworker={homeworker} onClose={onClose} /> : null;
}

function EditForm({ homeworker, onClose }: { homeworker: HomeworkerListItem; onClose: () => void }) {
  const { toast } = useToast();
  const update = useUpdateHomeworker();
  const [name, setName] = useState(homeworker.name);
  const [share, setShare] = useState(homeworker.profitSharePercent ?? "");

  const shareError = validateProfitShare(share);
  const nameTrimmed = name.trim();
  const nameValid = isValidName(name);

  const submit = () => {
    const payload: UpdateHomeworkerPayload = {};
    if (nameTrimmed !== homeworker.name) payload.name = nameTrimmed;
    if (share.trim() !== (homeworker.profitSharePercent ?? "")) payload.profitSharePercent = share.trim();
    if (Object.keys(payload).length === 0) {
      onClose();
      return;
    }
    update.mutate(
      { branchId: homeworker.branchId, payload },
      {
        onSuccess: () => {
          toast({ title: "Homeworker updated", description: nameTrimmed });
          onClose();
        },
        onError: (err: unknown) => {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast({ title: "Couldn't update", description: message ?? "Something went wrong", variant: "destructive" });
        },
      },
    );
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit homeworker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Branch name</Label>
            <Input value={name} maxLength={MAX_NAME_LENGTH} onChange={(e) => setName(e.target.value)} data-testid="input-edit-homeworker-name" />
          </div>
          <div className="space-y-1.5">
            <Label>Profit share %</Label>
            <Input
              inputMode="decimal"
              value={share}
              onChange={(e) => setShare(e.target.value)}
              data-testid="input-edit-homeworker-share"
            />
            {shareError && <p className="text-xs text-rose-600">{shareError}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!nameValid || shareError !== null || update.isPending}
            data-testid="button-save-homeworker"
          >
            {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
