import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useRole } from "@/hooks/use-role";
import { useBranches } from "@/hooks/queries";
import { useInviteEmployee } from "@/hooks/mutations";
import { type InvitableRole } from "@/features/hr/api/hr.api";
import { INVITE_ROLES } from "./helpers";

export function InviteEmployeeDialog({
  open, onClose,
}: { open: boolean; onClose: (invitedEmail: string | null) => void }) {
  const { orgRole } = useRole();
  const { toast } = useToast();
  const isBranchManager = orgRole === "branch_manager";

  const [email, setEmail]       = useState("");
  const [branchId, setBranchId] = useState<string>("");
  const [role, setRole]         = useState<InvitableRole>("agent");

  const branches = useBranches();
  const send = useInviteEmployee();

  const handleSend = () => {
    send.mutate(
      { email: email.trim(), branchId, orgRole: role },
      {
        onSuccess: () => {
          const sent = email.trim();
          setEmail(""); setBranchId(""); setRole("agent");
          onClose(sent);
        },
        onError: (err: any) => {
          toast({
            title: "Invite failed",
            description: err?.response?.data?.message ?? "Could not send invitation.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const roleOptions = isBranchManager
    ? INVITE_ROLES.filter((r) => r.value === "agent" || r.value === "homeworker")
    : INVITE_ROLES;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite an employee</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="name@agency.com" data-testid="input-invite-email" />
          </div>
          <div className="space-y-1.5">
            <Label>Branch</Label>
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              data-testid="select-invite-branch">
              <option value="">Select a branch…</option>
              {(branches.data ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <select value={role} onChange={(e) => setRole(e.target.value as InvitableRole)}
              className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              data-testid="select-invite-role">
              {roleOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {isBranchManager && (
              <p className="text-xs text-slate-500">Branch managers can invite agents or homeworkers.</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onClose(null)}>Cancel</Button>
          <Button onClick={handleSend}
            disabled={!email.trim() || !branchId || send.isPending}
            data-testid="button-send-invite">
            {send.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            Send invite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
