import { useMemo } from "react";
import { useRole } from "@/hooks/use-role";
import { useCurrentUser } from "@/hooks/queries";
import { useOrgMembers } from "@/features/organization/api/use-organization-queries";
import { useBranches } from "@/features/organization/api/use-branch-queries";
import { usePendingInvites } from "@/features/invite/api/use-invite-queries";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { INVITABLE_ROLES, type BranchOption, type ValidationContext } from "../lib/invite-rows";

/** Who is looking at the page, what they may invite, and the data the invite forms validate against. */
export function useTeamAccess() {
  const { orgRole, can } = useRole();
  const { data: currentUser } = useCurrentUser();
  const { data: members = [], isLoading: membersLoading } = useOrgMembers();
  const { data: branches = [] } = useBranches();
  const { data: pending = [] } = usePendingInvites();

  const isAdmin = can("admin", "team");
  const isBranchManager = orgRole === "branch_manager";
  const allowed = isAdmin || isBranchManager;

  const branchOptions: BranchOption[] = useMemo(
    () => branches.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, isDefault: b.isDefault })),
    [branches],
  );

  // A branch manager invites agents into their own branch only.
  const lockedBranchId = useMemo(() => {
    if (!isBranchManager || !currentUser?.id) return null;
    const me = members.find((m) => m.user.id === currentUser.id);
    return me?.branches.find((b) => b.isActive)?.branchId ?? null;
  }, [isBranchManager, currentUser?.id, members]);

  const allowedRoles: InviteOrgRole[] = useMemo(
    () => (isBranchManager ? ["agent"] : INVITABLE_ROLES),
    [isBranchManager],
  );

  const takenEmails = useMemo(() => {
    const set = new Set<string>();
    for (const m of members) set.add(m.user.email.toLowerCase());
    for (const p of pending) set.add(p.email.toLowerCase());
    return set;
  }, [members, pending]);

  const validation: ValidationContext = useMemo(
    () => ({ branches: branchOptions, takenEmails, allowedRoles, lockedBranchId }),
    [branchOptions, takenEmails, allowedRoles, lockedBranchId],
  );

  return {
    currentUserId: currentUser?.id ?? null,
    isAdmin,
    isBranchManager,
    allowed,
    members,
    membersLoading,
    branchOptions,
    lockedBranchId,
    allowedRoles,
    validation,
  };
}
