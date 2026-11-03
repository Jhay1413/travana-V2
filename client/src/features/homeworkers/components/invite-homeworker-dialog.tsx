import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useInviteHomeworker } from "../api/use-homeworker-mutations";
import { HomeworkerInviteFields, useShareInput } from "./homeworker-invite-fields";

export function InviteHomeworkerDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const invite = useInviteHomeworker();
  const share = useShareInput();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");

  const reset = () => {
    setEmail("");
    setFirstName("");
    setLastName("");
    setDisplayName("");
    share.reset();
  };

  const handleCancel = () => {
    reset();
    onClose();
  };

  const submit = () => {
    invite.mutate(
      {
        email: email.trim(),
        ...(firstName.trim() ? { firstName: firstName.trim() } : {}),
        ...(lastName.trim() ? { lastName: lastName.trim() } : {}),
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        profitSharePercent: share.value.trim(),
      },
      {
        onSuccess: () => {
          toast({ title: "Invite sent", description: `${email.trim()} will receive an email shortly.` });
          reset();
          onClose();
        },
        onError: (err: unknown) => {
          const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
          toast({ title: "Invite failed", description: message ?? "Could not send invitation.", variant: "destructive" });
        },
      },
    );
  };

  // An empty share is invalid too: the form always submits an explicit share.
  const shareInvalid = share.error !== null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a homeworker</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              data-testid="input-homeworker-email"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>First name (optional)</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} data-testid="input-homeworker-first-name" />
            </div>
            <div className="space-y-1.5">
              <Label>Last name (optional)</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} data-testid="input-homeworker-last-name" />
            </div>
          </div>
          <HomeworkerInviteFields
            share={share.value}
            onShareChange={share.setValue}
            shareError={share.error}
            displayName={displayName}
            onDisplayNameChange={setDisplayName}
            disabled={invite.isPending}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={!email.trim() || shareInvalid || invite.isPending}
            data-testid="button-send-homeworker-invite"
          >
            {invite.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
