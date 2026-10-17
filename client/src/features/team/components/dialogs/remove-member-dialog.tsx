import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { DANGER_GHOST, OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { useRemoveMember } from "../../api/use-team-mutations";
import { useMemberWorkload } from "../../api/use-team-queries";
import { teamErrorMessage } from "../../lib/error-message";
import { memberStatus } from "../../lib/member-status";
import { roleLabel } from "../../lib/role-helpers";
import {
  defaultNewOwner,
  eligibleNewOwners,
  isRemoveConfirmed,
  needsNewOwner,
  workloadSummary,
} from "../../lib/remove-owner";
import { DialogIconTile } from "./confirm-dialog";
import { TEAM_CONTROL, TEAM_LABEL } from "../shared/team-styles";

interface RemoveMemberDialogProps {
  member: OrgMember | null;
  members: OrgMember[];
  onClose: () => void;
  onSuspendInstead: (member: OrgMember) => void;
}

function Chip({ n, label }: { n: number; label: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-[10px] bg-muted/60 px-3 py-2.5" data-testid={`workload-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="text-[18px] font-semibold leading-tight">{n}</div>
      <div className="truncate text-[12px] text-social-muted">{label}</div>
    </div>
  );
}

/** Remove = hand over open work to a new owner, then deactivate. History is kept. */
export function RemoveMemberDialog({ member, members, onClose, onSuspendInstead }: RemoveMemberDialogProps) {
  const { toast } = useToast();
  const remove = useRemoveMember();
  const workload = useMemberWorkload(member?.user.id ?? null);
  const [pick, setPick] = useState("");
  const [typed, setTyped] = useState("");

  const name = member?.user.name ?? "";
  const w = workload.data;
  const owners = member ? eligibleNewOwners(members, member.user.id) : [];
  const needsOwner = w ? needsNewOwner(w) : false;
  const newOwnerId = pick || (member ? defaultNewOwner(members, member) : "");
  const ownerMissing = needsOwner && owners.length === 0;
  const canSubmit = !!member && !!w && isRemoveConfirmed(typed) && (!needsOwner || !!newOwnerId) && !remove.isPending;

  const close = () => {
    setPick("");
    setTyped("");
    onClose();
  };

  const submit = () => {
    if (!member || !w) return;
    remove.mutate(
      { userId: member.user.id, confirm: "REMOVE", ...(needsOwner ? { newOwnerId } : {}) },
      {
        onSuccess: () => {
          const target = owners.find((o) => o.user.id === newOwnerId);
          toast({
            title: `${name} removed`,
            description: needsOwner && target ? `Their work moved to ${target.user.name}.` : "Their seat is free again.",
          });
          close();
        },
        onError: (err: unknown) =>
          toast({ title: "Couldn't remove", description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" }),
      },
    );
  };

  return (
    <Dialog open={!!member} onOpenChange={(o) => !o && !remove.isPending && close()}>
      <DialogContent className="max-w-[540px] rounded-2xl border-social-border p-6 sm:rounded-2xl" data-testid="remove-dialog">
        <DialogIconTile tone="red">
          <Trash2 className="h-5 w-5" />
        </DialogIconTile>
        <DialogTitle className="text-[18px] font-semibold">Remove {name}?</DialogTitle>
        <DialogDescription className="text-[14px] leading-relaxed text-social-muted">
          {needsOwner
            ? "They will no longer be able to sign in, and their seat is freed. Choose who takes over their open work so nothing is left without an owner. Booked deals and all history stay as they are."
            : "They will no longer be able to sign in, and their seat is freed. They have nothing open, so there is nothing to hand over. History stays as it is."}
        </DialogDescription>

        {workload.isLoading && <Loader2 className="mx-auto my-3 h-5 w-5 animate-spin text-social-muted" aria-label="Loading their work" />}
        {workload.isError && (
          <p className="text-[13px] text-status-failed-fg" role="alert">
            {teamErrorMessage(workload.error, "Couldn't load their open work. Close this and try again.")}
          </p>
        )}
        {w && (
          <div className="flex gap-2.5">
            <Chip n={w.openDeals} label="Open deals" />
            <Chip n={w.openTasks} label="Open tasks" />
            <Chip n={w.openTickets} label="Open tickets" />
            <Chip n={w.clients} label="Clients" />
          </div>
        )}
        {w && needsOwner && (
          <div>
            <div className={TEAM_LABEL}>Hand over {workloadSummary(w)} to</div>
            <Select value={newOwnerId || undefined} onValueChange={setPick} disabled={ownerMissing}>
              <SelectTrigger aria-label="New owner" className={cn(TEAM_CONTROL, "h-11 w-full")} data-testid="select-new-owner">
                <SelectValue placeholder={ownerMissing ? "No one available" : "Choose a person"} />
              </SelectTrigger>
              <SelectContent>
                {owners.map((o) => (
                  <SelectItem key={o.user.id} value={o.user.id}>
                    {o.user.name} ({roleLabel(o.user.orgRole)})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {ownerMissing && (
              <p className="mt-1.5 text-[12px] text-status-failed-fg">
                There is no active admin, branch manager or agent to take over. Add or reactivate someone first.
              </p>
            )}
          </div>
        )}
        <div>
          <div className={TEAM_LABEL}>Type REMOVE to confirm</div>
          <Input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="REMOVE"
            aria-label="Type REMOVE to confirm"
            autoComplete="off"
            className={cn(TEAM_CONTROL, "h-11")}
            data-testid="input-remove-confirm"
          />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          {member && memberStatus(member) === "active" ? (
            <button
              type="button"
              onClick={() => {
                const m = member;
                close();
                onSuspendInstead(m);
              }}
              className="text-[13px] font-semibold text-social-orange-text hover:underline"
              data-testid="link-suspend-instead"
            >
              Suspend instead
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2.5">
            <Button type="button" variant="outline" className={OUTLINE_ACTION} onClick={close} disabled={remove.isPending}>
              Cancel
            </Button>
            <Button
              type="button"
              className={cn(DANGER_GHOST, "bg-stage-lost-bg")}
              onClick={submit}
              disabled={!canSubmit}
              data-testid="button-confirm-remove"
            >
              {remove.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Remove user
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
