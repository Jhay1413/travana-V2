import { Loader2, RotateCw, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePendingInvites } from "@/features/invite/api/use-invite-queries";
import { useResendInvite, useRevokeInvite } from "@/features/invite/api/use-invite-mutations";
import { roleLabel } from "../utils/role-helpers";

function formatRelative(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date).getTime();
  const diffMs = d - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (diffDays > 1) return `expires in ${diffDays} days`;
  if (diffDays === 1) return "expires in 1 day";
  if (diffDays === 0) return "expires today";
  return "expired";
}

export function PendingInvitesList() {
  const { toast } = useToast();
  const { data: invites, isLoading } = usePendingInvites();
  const resend = useResendInvite();
  const revoke = useRevokeInvite();

  const list = invites ?? [];

  if (isLoading) {
    return (
      <div className="grid h-24 place-items-center rounded-3xl border border-black/10 dark:border-white/10">
        <Loader2 className="h-5 w-5 animate-spin text-black/40 dark:text-white/40" />
      </div>
    );
  }

  if (list.length === 0) return null;

  const handleResend = (userId: string, email: string) => {
    resend.mutate(userId, {
      onSuccess: () => toast({ title: "Invite re-sent", description: email }),
      onError: (err: any) =>
        toast({ title: "Couldn't resend", description: err?.message, variant: "destructive" }),
    });
  };

  const handleRevoke = (userId: string, email: string) => {
    revoke.mutate(userId, {
      onSuccess: () => toast({ title: "Invite revoked", description: email }),
      onError: (err: any) =>
        toast({ title: "Couldn't revoke", description: err?.message, variant: "destructive" }),
    });
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/10">
        <div className="text-sm font-semibold">Pending invites</div>
        <span className="text-xs text-black/50 dark:text-white/50">{list.length}</span>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:bg-white/[0.02] dark:text-white/50">
          <tr>
            <th className="px-4 py-2 text-left">Email</th>
            <th className="px-4 py-2 text-left">Branch</th>
            <th className="px-4 py-2 text-left">Role</th>
            <th className="px-4 py-2 text-left">Status</th>
            <th className="px-4 py-2 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {list.map((inv) => (
            <tr
              key={inv.userId}
              className="border-t border-black/5 dark:border-white/10"
              data-testid={`row-invite-${inv.userId}`}
            >
              <td className="px-4 py-2 font-medium">{inv.email}</td>
              <td className="px-4 py-2 text-black/65 dark:text-white/65">{inv.branchName ?? "—"}</td>
              <td className="px-4 py-2 text-black/65 dark:text-white/65">{roleLabel(inv.orgRole)}</td>
              <td className="px-4 py-2">
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                  Invited · {formatRelative(inv.inviteTokenExpiry)}
                </span>
              </td>
              <td className="px-4 py-2 text-right">
                <button
                  onClick={() => handleResend(inv.userId, inv.email)}
                  disabled={resend.isPending}
                  className="mr-2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-black/60 hover:bg-black/5 disabled:opacity-40 dark:text-white/60 dark:hover:bg-white/10"
                  data-testid={`button-resend-${inv.userId}`}
                  title="Resend email"
                >
                  <RotateCw className="h-3.5 w-3.5" /> Resend
                </button>
                <button
                  onClick={() => handleRevoke(inv.userId, inv.email)}
                  disabled={revoke.isPending}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-40"
                  data-testid={`button-revoke-${inv.userId}`}
                  title="Revoke invite"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
