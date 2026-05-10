import { useMemo, useState } from "react";
import { PauseCircle, Shield, Users } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useCurrentOrganization, useOrgMembers } from "@/hooks/queries/use-organization-queries";
import {
  useUpdateMemberRole,
  useSetMemberSuspended,
} from "@/hooks/mutations/use-organization-mutations";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { OwnerOnlyGate } from "./components/OwnerOnlyGate";
import { PageLoading } from "./components/PageLoading";
import { StatCard } from "./components/StatCard";
import { InvitePanel } from "./components/InvitePanel";
import { MemberRow } from "./components/MemberRow";
import { PendingInvitesList } from "./components/PendingInvitesList";
import { isMemberSuspended, roleLabel } from "./utils/role-helpers";
import type { OrgMember } from "@/api/endpoints/organization.api";
import type { InviteOrgRole } from "@/api/endpoints/invite.api";

export default function AgencyTeamPage() {
  const { orgRole, can } = useRole();
  const { data: org } = useCurrentOrganization();
  const { data: members, isLoading } = useOrgMembers();
  const { data: currentUser } = useCurrentUser();
  const updateRole = useUpdateMemberRole();
  const setSuspended = useSetMemberSuspended();
  const { toast } = useToast();
  const isOrgAdmin = can("admin", "team");
  const isBranchManager = orgRole === "branch_manager";
  const allowed = isOrgAdmin || isBranchManager;

  const [filter, setFilter] = useState("");

  const list = members ?? [];
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) =>
      m.user.name.toLowerCase().includes(q) ||
      m.user.email.toLowerCase().includes(q) ||
      m.branches.some((b) => b.branchName.toLowerCase().includes(q)),
    );
  }, [list, filter]);

  const activeCount = useMemo(() => list.filter((m) => !isMemberSuspended(m)).length, [list]);
  const seatLimit = org?.seatLimit ?? 0;
  const atLimit = seatLimit > 0 && activeCount >= seatLimit;

  const myBranchId = useMemo(() => {
    if (!currentUser?.id || !isBranchManager) return null;
    const me = list.find((m) => m.user.id === currentUser.id);
    return me?.branches.find((b) => b.isActive)?.branchId ?? null;
  }, [list, currentUser, isBranchManager]);

  const invitableRoles: InviteOrgRole[] | undefined = isBranchManager
    ? ["agent", "homeworker"]
    : undefined;

  const handleRoleChange = (member: OrgMember, newRole: string) => {
    if (newRole === member.user.orgRole) return;
    updateRole.mutate(
      { userId: member.user.id, orgRole: newRole },
      {
        onSuccess: () => toast({ title: "Role updated", description: `${member.user.name} is now ${roleLabel(newRole)}.` }),
        onError: (err: any) =>
          toast({ title: "Couldn't update role", description: err?.message ?? "Something went wrong", variant: "destructive" }),
      },
    );
  };

  const handleToggleSuspend = (member: OrgMember) => {
    const suspended = !isMemberSuspended(member);
    setSuspended.mutate(
      { userId: member.user.id, suspended },
      {
        onSuccess: () =>
          toast({ title: suspended ? "Member suspended" : "Member reactivated", description: member.user.name }),
        onError: (err: any) =>
          toast({ title: "Couldn't update", description: err?.message ?? "Something went wrong", variant: "destructive" }),
      },
    );
  };

  if (!allowed) {
    return <OwnerOnlyGate description="Only the Agency Owner can manage the team." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard icon={<Users className="h-4 w-4" />} label="Active members" value={String(activeCount)} />
        <StatCard
          icon={<PauseCircle className="h-4 w-4" />}
          label="Suspended"
          value={String(list.filter(isMemberSuspended).length)}
        />
        <StatCard
          icon={<Shield className="h-4 w-4" />}
          label="Seats used"
          value={seatLimit > 0 ? `${activeCount} / ${seatLimit}` : String(activeCount)}
          accent={atLimit ? "warn" : "ok"}
        />
      </div>

      <InvitePanel
        brandColor={org?.brandColor}
        lockedBranchId={myBranchId}
        availableRoles={invitableRoles}
      />

      <PendingInvitesList />

      <div className="overflow-hidden rounded-3xl border border-black/10 bg-white dark:border-white/10 dark:bg-white/5">
        <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name, email or branch"
            className="max-w-xs"
            data-testid="input-team-filter"
          />
          <span className="text-xs text-black/50 dark:text-white/50">{filtered.length} of {list.length}</span>
        </div>

        {isLoading ? (
          <PageLoading size="small" />
        ) : filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-black/50 dark:text-white/50">
            No team members match.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-black/5 bg-black/[0.02] text-xs uppercase tracking-wider text-black/50 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/50">
              <tr>
                <th className="px-4 py-3 text-left">Member</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Branches</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <MemberRow
                  key={m.user.id}
                  member={m}
                  isCurrentUser={m.user.id === currentUser?.id}
                  isMutating={updateRole.isPending || setSuspended.isPending}
                  isReadOnly={!isOrgAdmin}
                  onRoleChange={(newRole) => handleRoleChange(m, newRole)}
                  onToggleSuspend={() => handleToggleSuspend(m)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
