import { useMemo, useState } from "react";
import { PauseCircle, Shield, Users } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useCurrentOrganization, useOrgMembers } from "@/features/organization/api/use-organization-queries";
import {
  useUpdateMemberRole,
  useSetMemberSuspended,
} from "@/features/organization/api/use-organization-mutations";
import { useCurrentUser } from "@/hooks/queries";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { OwnerOnlyGate } from "@/features/organization/components/agency/OwnerOnlyGate";
import { PageLoading } from "@/features/organization/components/agency/PageLoading";
import { StatCard } from "@/features/organization/components/agency/StatCard";
import { InvitePanel } from "@/features/organization/components/agency/InvitePanel";
import { MemberRow } from "@/features/organization/components/agency/MemberRow";
import { PendingInvitesList } from "@/features/organization/components/agency/PendingInvitesList";
import { isMemberSuspended, roleLabel } from "./utils/role-helpers";
import type { OrgMember } from "@/features/organization/api/organization.api";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";

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
  const [tab, setTab] = useState<"active" | "suspended">("active");

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

  // Suspended members get their own tab so they stop cluttering the working
  // roster, while staying reachable for reactivation. The search box applies to
  // whichever tab is open.
  const activeMembers = useMemo(() => filtered.filter((m) => !isMemberSuspended(m)), [filtered]);
  const suspendedMembers = useMemo(() => filtered.filter(isMemberSuspended), [filtered]);
  const visibleMembers = tab === "active" ? activeMembers : suspendedMembers;
  const suspendedTotal = useMemo(() => list.filter(isMemberSuspended).length, [list]);

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
          value={String(suspendedTotal)}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black/5 px-4 py-3 dark:border-white/10">
          <div className="flex items-center gap-1 rounded-xl border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]">
            {([
              { key: "active" as const, label: "Active", count: activeMembers.length },
              { key: "suspended" as const, label: "Suspended", count: suspendedMembers.length },
            ]).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
                  tab === t.key
                    ? "bg-white text-black shadow-sm dark:bg-white/15 dark:text-white"
                    : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white",
                )}
                data-testid={`tab-team-${t.key}`}
              >
                {t.label}
                <span className="ml-1.5 text-[11px] font-medium tabular-nums opacity-60">{t.count}</span>
              </button>
            ))}
          </div>
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name, email or branch"
            className="max-w-xs"
            data-testid="input-team-filter"
          />
        </div>

        {isLoading ? (
          <PageLoading size="small" />
        ) : visibleMembers.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-black/50 dark:text-white/50">
            {tab === "suspended"
              ? filter.trim()
                ? "No suspended members match."
                : "No suspended members."
              : filter.trim()
                ? "No team members match."
                : "No active team members."}
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
              {visibleMembers.map((m) => (
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
