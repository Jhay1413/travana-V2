import { useEffect, useMemo, useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useBranches } from "@/hooks/queries/use-branch-queries";
import { useSendInvite } from "@/hooks/mutations/use-invite-mutations";
import { ASSIGNABLE_ROLES } from "../utils/role-helpers";
import type { InviteOrgRole } from "@/api/endpoints/invite.api";

const ALL_INVITABLE_ROLES: InviteOrgRole[] = ["branch_manager", "agent", "homeworker", "referral_agent"];

export function InvitePanel({
  brandColor,
  lockedBranchId,
  availableRoles,
}: {
  brandColor: string | null | undefined;
  lockedBranchId?: string | null;
  availableRoles?: InviteOrgRole[];
}) {
  const { toast } = useToast();
  const { data: branches } = useBranches();
  const sendInvite = useSendInvite();

  const activeBranches = (branches ?? []).filter((b) => b.isActive);
  const branchPickList = useMemo(() => {
    if (lockedBranchId) return activeBranches.filter((b) => b.id === lockedBranchId);
    return activeBranches;
  }, [activeBranches, lockedBranchId]);
  const defaultBranchId = lockedBranchId ?? branchPickList.find((b) => b.isDefault)?.id ?? branchPickList[0]?.id ?? "";

  const roleOptions = useMemo(() => {
    const allowed = (availableRoles ?? ALL_INVITABLE_ROLES) as readonly string[];
    return ASSIGNABLE_ROLES.filter((r) => allowed.includes(r.value));
  }, [availableRoles]);

  const [email, setEmail] = useState("");
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [orgRole, setOrgRole] = useState<InviteOrgRole>(
    (roleOptions[0]?.value as InviteOrgRole | undefined) ?? "agent",
  );

  useEffect(() => {
    if (lockedBranchId) {
      setBranchId(lockedBranchId);
    } else if (!branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [lockedBranchId, branchId, defaultBranchId]);

  useEffect(() => {
    if (!roleOptions.some((r) => r.value === orgRole) && roleOptions[0]) {
      setOrgRole(roleOptions[0].value as InviteOrgRole);
    }
  }, [roleOptions, orgRole]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !branchId) return;
    sendInvite.mutate(
      { email: email.trim(), branchId, orgRole },
      {
        onSuccess: () => {
          toast({ title: "Invite sent", description: `${email} will receive an email shortly.` });
          setEmail("");
        },
        onError: (err: any) =>
          toast({
            title: "Couldn't send invite",
            description: err?.message ?? "Something went wrong",
            variant: "destructive",
          }),
      },
    );
  };

  const noBranches = branchPickList.length === 0;
  const branchLocked = !!lockedBranchId;

  return (
    <form
      onSubmit={submit}
      className="rounded-3xl border border-black/10 bg-white p-6 dark:border-white/10 dark:bg-white/5"
    >
      <h3 className="mb-4 text-sm font-semibold">Invite a teammate</h3>
      {noBranches && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-700">
          {branchLocked
            ? "Your branch is no longer active — ask an admin to reactivate it before inviting."
            : "You need at least one active branch before inviting members."}
        </div>
      )}
      <div className="grid gap-2 md:grid-cols-[1fr_180px_180px_auto]">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@company.com"
          disabled={noBranches || sendInvite.isPending}
          required
          data-testid="input-invite-email"
        />
        <select
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          disabled={noBranches || sendInvite.isPending || branchLocked}
          title={branchLocked ? "You can only invite to your own branch" : undefined}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm disabled:opacity-70 dark:border-white/10 dark:bg-white/5"
          data-testid="select-invite-branch"
        >
          {branchPickList.length === 0 && <option value="">No branches</option>}
          {branchPickList.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}{b.isDefault ? " (default)" : ""}
            </option>
          ))}
        </select>
        <select
          value={orgRole}
          onChange={(e) => setOrgRole(e.target.value as InviteOrgRole)}
          disabled={noBranches || sendInvite.isPending}
          className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
          data-testid="select-invite-role"
        >
          {roleOptions.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <Button
          type="submit"
          disabled={noBranches || sendInvite.isPending || !email.trim() || !branchId}
          style={{ background: brandColor ?? undefined }}
          data-testid="button-send-invite"
        >
          {sendInvite.isPending ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Mail className="mr-1 h-4 w-4" />
          )}
          Send invite
        </Button>
      </div>
      <div className="mt-2 text-xs text-black/50 dark:text-white/50">
        They'll get an email with a 7-day link to set their password and finish their profile.
      </div>
    </form>
  );
}
