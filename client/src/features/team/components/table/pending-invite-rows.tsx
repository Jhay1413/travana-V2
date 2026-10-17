import { RotateCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import type { PendingInvite } from "@/features/invite/api/invite.api";
import { useResendInvite, useRevokeInvite } from "@/features/invite/api/use-invite-mutations";
import { DANGER_TEXT_ACTION } from "../shared/team-styles";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { teamErrorMessage } from "../../lib/error-message";
import { inviteExpiryText } from "../../lib/invite-expiry";
import { PERMISSION_COUNT, REFERRAL_NOTE, permissionCount } from "../../lib/role-permissions";
import { MemberAvatar } from "../shared/member-avatar";
import { RolePill } from "../shared/role-pill";
import { StatusPill } from "../shared/status-pill";

const CELL = "px-4 py-3 align-middle";

/** Pending invites as extra rows under the active members, with Resend and Revoke. */
export function PendingInviteRows({ invites }: { invites: PendingInvite[] }) {
  const { toast } = useToast();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const fail = (title: string) => (err: unknown) =>
    toast({ title, description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" });

  return (
    <>
      {invites.map((inv) => (
        <tr key={inv.userId} className="border-t border-social-border" data-testid={`row-invite-${inv.userId}`}>
          <td className={CELL}>
            <div className="flex items-center gap-3">
              <MemberAvatar name={inv.email} />
              <div className="min-w-0">
                <div className="truncate text-[14px] font-semibold">{inv.email}</div>
                <div className="text-[12px] text-social-muted">Hasn&apos;t set a password yet</div>
              </div>
            </div>
          </td>
          <td className={CELL}>
            <RolePill role={inv.orgRole} />
          </td>
          <td className={cn(CELL, "text-[13px] text-social-muted")}>{inv.branchName ?? "Own branch"}</td>
          <td className={cn(CELL, "whitespace-nowrap text-[13px] font-medium")}>
            {inv.orgRole === "referral_agent" ? (
              <span className="text-social-muted">{REFERRAL_NOTE}</span>
            ) : (
              `${permissionCount(inv.orgRole)} of ${PERMISSION_COUNT}`
            )}
          </td>
          <td className={CELL}>
            <StatusPill status="invited" detail={inviteExpiryText(inv.inviteTokenExpiry)} />
          </td>
          <td className={cn(CELL, "text-right")}>
            <div className="flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className={cn(OUTLINE_ACTION, "h-8 px-3")}
                disabled={resend.isPending}
                onClick={() =>
                  resend.mutate(inv.userId, {
                    onSuccess: () => toast({ title: "Invite sent again", description: inv.email }),
                    onError: fail("Couldn't resend"),
                  })
                }
                data-testid={`button-resend-${inv.userId}`}
              >
                <RotateCw className="h-3.5 w-3.5" /> Resend
              </Button>
              <Button
                type="button"
                variant="ghost"
                className={DANGER_TEXT_ACTION}
                disabled={revoke.isPending}
                onClick={() =>
                  revoke.mutate(inv.userId, {
                    onSuccess: () => toast({ title: "Invite revoked", description: inv.email }),
                    onError: fail("Couldn't revoke"),
                  })
                }
                data-testid={`button-revoke-${inv.userId}`}
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </Button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
