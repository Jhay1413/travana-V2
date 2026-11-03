import { useEffect, useState } from "react";
import { Loader2, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSetMemberSuspended } from "@/features/organization/api/use-organization-mutations";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { teamErrorMessage } from "../../lib/error-message";
import { DialogIconTile } from "./confirm-dialog";

/** Suspend: signed out straight away, nothing deleted, optional email to the person. */
export function SuspendDialog({ member, onClose }: { member: OrgMember | null; onClose: () => void }) {
  const { toast } = useToast();
  const suspend = useSetMemberSuspended();
  const [notify, setNotify] = useState(true);
  const name = member?.user.name ?? "";

  // Each time the dialog opens for someone, start with the email ticked.
  useEffect(() => {
    if (member) setNotify(true);
  }, [member]);

  const submit = () => {
    if (!member) return;
    suspend.mutate(
      { userId: member.user.id, suspended: true, notify },
      {
        onSuccess: () => {
          toast({ title: `${name} suspended`, description: notify ? "We'll email them." : undefined });
          onClose();
        },
        onError: (err: unknown) =>
          toast({ title: "Couldn't suspend", description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && !suspend.isPending && onClose()}>
      <DialogContent className="max-w-[480px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="suspend-dialog">
        <DialogIconTile tone="amber">
          <Pause className="h-5 w-5" />
        </DialogIconTile>
        <DialogTitle className="text-[18px] font-semibold">Suspend {name}?</DialogTitle>
        <DialogDescription className="text-[14px] leading-relaxed text-social-muted">
          They&apos;ll be signed out straight away and won&apos;t be able to log in. Their clients, deals and tasks stay as they are, and nothing is deleted. You can reactivate them whenever you like.
        </DialogDescription>
        <label className="mt-1 flex cursor-pointer items-center gap-2.5 text-[13px]">
          <Checkbox checked={notify} onCheckedChange={(v) => setNotify(v === true)} data-testid="check-notify" />
          Send them an email to let them know
        </label>
        <div className="mt-3 flex justify-end gap-2.5">
          <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={onClose} disabled={suspend.isPending}>
            Cancel
          </Button>
          <Button type="button" className={PRIMARY_ACTION} onClick={submit} disabled={suspend.isPending} data-testid="button-confirm-suspend">
            {suspend.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Suspend user
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
