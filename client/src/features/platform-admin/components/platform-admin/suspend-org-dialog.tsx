import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSuspendOrg } from "@/hooks/mutations";

interface Props {
  orgId:   string | null;
  orgName: string;
  open:    boolean;
  onOpenChange: (open: boolean) => void;
}

export function SuspendOrgDialog({ orgId, orgName, open, onOpenChange }: Props) {
  const [reason, setReason] = useState("");
  const [error, setError]   = useState<string | null>(null);
  const suspend = useSuspendOrg();

  const handleSuspend = async () => {
    if (!orgId) return;
    if (reason.trim().length < 3) {
      setError("Reason must be at least 3 characters.");
      return;
    }
    setError(null);
    try {
      await suspend.mutateAsync({ orgId, reason: reason.trim() });
      setReason("");
      onOpenChange(false);
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to suspend organization");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="dialog-suspend-org">
        <DialogHeader>
          <DialogTitle>Suspend {orgName}</DialogTitle>
          <DialogDescription>
            Members of this organization will lose access until it's reactivated. This action is recorded in the admin audit log.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-sm font-medium">Reason</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Non-payment, terms violation, owner request…"
            rows={4}
            data-testid="input-suspend-reason"
          />
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={suspend.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSuspend}
            disabled={suspend.isPending}
            data-testid="button-confirm-suspend"
          >
            {suspend.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Suspend
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
