import { useCallback, useMemo, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { useSetMemberSuspended, useUpdateMemberRole } from "@/features/organization/api/use-organization-mutations";
import { teamErrorMessage } from "../lib/error-message";
import { roleLabel } from "../lib/role-helpers";
import type { DrawerTab } from "../types";

interface DrawerState {
  userId: string;
  tab: DrawerTab;
}

interface RoleChange {
  userId: string;
  role: string;
}

/** Which dialog or drawer is open, and the mutations the table, drawer and dialogs share. */
export function useTeamActions(members: OrgMember[]) {
  const { toast } = useToast();
  const updateRole = useUpdateMemberRole();
  const setSuspended = useSetMemberSuspended();

  const [drawer, setDrawer] = useState<DrawerState | null>(null);
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [roleChange, setRoleChange] = useState<RoleChange | null>(null);
  const [adding, setAdding] = useState(false);
  const [matrix, setMatrix] = useState(false);

  const find = useCallback((id: string | null) => (id ? members.find((m) => m.user.id === id) ?? null : null), [members]);

  const requestRoleChange = useCallback((member: OrgMember, role: string) => {
    if (role !== member.user.orgRole) setRoleChange({ userId: member.user.id, role });
  }, []);

  const confirmRoleChange = useCallback(() => {
    if (!roleChange) return;
    const target = find(roleChange.userId);
    updateRole.mutate(
      { userId: roleChange.userId, orgRole: roleChange.role },
      {
        onSuccess: () => {
          toast({ title: "Role updated", description: `${target?.user.name ?? "They"} is now ${roleLabel(roleChange.role)}.` });
          setRoleChange(null);
        },
        onError: (err: unknown) => {
          toast({ title: "Couldn't update role", description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" });
          setRoleChange(null);
        },
      },
    );
  }, [roleChange, find, updateRole, toast]);

  const reactivate = useCallback(
    (member: OrgMember) =>
      setSuspended.mutate(
        { userId: member.user.id, suspended: false },
        {
          onSuccess: () => toast({ title: `${member.user.name} reactivated` }),
          onError: (err: unknown) =>
            toast({ title: "Couldn't reactivate", description: teamErrorMessage(err, "Something went wrong"), variant: "destructive" }),
        },
      ),
    [setSuspended, toast],
  );

  return useMemo(
    () => ({
      drawer,
      drawerMember: find(drawer?.userId ?? null),
      suspendMember: find(suspendId),
      removeMember: find(removeId),
      archiveUserId: archiveId,
      roleChange,
      roleChangeMember: find(roleChange?.userId ?? null),
      adding,
      matrix,
      busy: updateRole.isPending || setSuspended.isPending,
      rolePending: updateRole.isPending,
      openDrawer: (m: OrgMember, tab: DrawerTab) => setDrawer({ userId: m.user.id, tab }),
      setDrawerTab: (tab: DrawerTab) => setDrawer((d) => (d ? { ...d, tab } : d)),
      closeDrawer: () => setDrawer(null),
      openSuspend: (m: OrgMember) => {
        setDrawer(null);
        setSuspendId(m.user.id);
      },
      closeSuspend: () => setSuspendId(null),
      openRemove: (m: OrgMember) => {
        setDrawer(null);
        setRemoveId(m.user.id);
      },
      closeRemove: () => setRemoveId(null),
      openArchive: (m: OrgMember) => setArchiveId(m.user.id),
      closeArchive: () => setArchiveId(null),
      requestRoleChange,
      confirmRoleChange,
      cancelRoleChange: () => setRoleChange(null),
      reactivate,
      setAdding,
      setMatrix,
    }),
    [drawer, find, suspendId, removeId, archiveId, roleChange, adding, matrix, updateRole.isPending, setSuspended.isPending, requestRoleChange, confirmRoleChange, reactivate],
  );
}

export type TeamActions = ReturnType<typeof useTeamActions>;
