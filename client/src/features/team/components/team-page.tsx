import { useRef } from "react";
import { useLocation } from "wouter";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useOrgSeats } from "@/features/organization/api/use-organization-queries";
import { usePendingInvites } from "@/features/invite/api/use-invite-queries";
import { filterInvites, branchChoices } from "../lib/member-filters";
import { memberStatus } from "../lib/member-status";
import { lockRowsToBranch } from "../lib/invite-rows";
import { readInviteFile } from "../lib/parse-sheet";
import { PERMISSION_COUNT, permissionCount, roleDisplay } from "../lib/role-permissions";
import { roleLabel } from "../lib/role-helpers";
import { teamErrorMessage } from "../lib/error-message";
import { useInviteDraftStore } from "../state/invite-draft-store";
import { useTeamActions } from "../state/use-team-actions";
import { useTeamAccess } from "../state/use-team-access";
import { useTeamFilters } from "../state/use-team-filters";
import { UserDrawer } from "./drawer/user-drawer";
import { AddUserDialog } from "./dialogs/add-user-dialog";
import { ArchiveHost } from "./dialogs/archive-host";
import { ConfirmDialog } from "./dialogs/confirm-dialog";
import { RemoveMemberDialog } from "./dialogs/remove-member-dialog";
import { RoleMatrixDialog } from "./dialogs/role-matrix-dialog";
import { SuspendDialog } from "./dialogs/suspend-dialog";
import { TeamHeader } from "./header/team-header";
import { TeamStatTiles } from "./header/team-stat-tiles";
import { INVITE_PAGE_PATH, QuickInviteCard } from "./invite/quick-invite-card";
import { MemberTableCard } from "./table/member-table-card";

/** /agency/team: header, stat tiles, quick invite and the member table with its drawer and dialogs. */
export function TeamPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const access = useTeamAccess();
  const { data: seats } = useOrgSeats({ enabled: access.allowed });
  const { data: invites = [] } = usePendingInvites({ enabled: access.allowed });
  const view = useTeamFilters(access.members);
  const actions = useTeamActions(access.members);
  const fileInput = useRef<HTMLInputElement>(null);

  const shownInvites = filterInvites(invites, view.filters);
  // Only homeworkers who are not already archived or suspended; archived ones read as Suspended here.
  const homeworkerIds = new Set(
    access.members.filter((m) => m.user.orgRole === "homeworker" && memberStatus(m) === "active").map((m) => m.user.id),
  );
  const archivable = access.isAdmin ? homeworkerIds : new Set<string>();
  const change = actions.roleChangeMember;
  const nextRole = actions.roleChange?.role;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const rows = lockRowsToBranch(await readInviteFile(file, access.branchOptions), access.lockedBranchId);
      useInviteDraftStore.getState().setDraft({ rows, fileName: file.name });
      navigate(INVITE_PAGE_PATH);
    } catch (err) {
      toast({ title: "Couldn't read that file", description: teamErrorMessage(err, "Upload a .csv file."), variant: "destructive" });
    }
  };

  return (
    <div className="min-w-0 space-y-5 text-[14px] leading-[1.5]" data-testid="section-team">
      <TeamHeader
        onUpload={() => fileInput.current?.click()}
        onAdd={() => actions.setAdding(true)}
        onMatrix={() => actions.setMatrix(true)}
        uploadDisabled={access.branchOptions.length === 0}
      />
      <input
        ref={fileInput}
        type="file"
        hidden
        accept=".csv,.tsv,.txt,text/csv"
        aria-label="Upload a spreadsheet of people"
        data-testid="team-upload"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          void onFile(file);
        }}
      />

      <TeamStatTiles active={view.roster.active} suspended={view.roster.suspended} seats={seats} />

      <QuickInviteCard ctx={access.validation} branchOptions={access.branchOptions} allowedRoles={access.allowedRoles} />

      <MemberTableCard
        members={view.visible}
        invites={shownInvites}
        filters={view.filters}
        onFilters={view.patch}
        onClear={view.clear}
        filtered={view.filtered}
        counts={view.counts}
        branches={branchChoices(access.members)}
        isAdmin={access.isAdmin}
        isLoading={access.membersLoading}
        currentUserId={access.currentUserId}
        archivable={archivable}
        roleBusy={actions.busy}
        onRoleChange={actions.requestRoleChange}
        onOpen={actions.openDrawer}
        onSuspend={actions.openSuspend}
        onReactivate={actions.reactivate}
        onRemove={actions.openRemove}
        onArchive={actions.openArchive}
      />

      <UserDrawer
        member={actions.drawerMember}
        tab={actions.drawer?.tab ?? "details"}
        onTab={actions.setDrawerTab}
        onClose={actions.closeDrawer}
        isAdmin={access.isAdmin}
        currentUserId={access.currentUserId}
        onRoleChange={actions.requestRoleChange}
        onSuspend={actions.openSuspend}
        onReactivate={(m) => {
          actions.reactivate(m);
          actions.closeDrawer();
        }}
        onRemove={actions.openRemove}
      />

      <AddUserDialog
        open={actions.adding}
        onClose={() => actions.setAdding(false)}
        onMore={() => navigate(INVITE_PAGE_PATH)}
        onUpload={() => {
          actions.setAdding(false);
          fileInput.current?.click();
        }}
        ctx={access.validation}
        branchOptions={access.branchOptions}
        allowedRoles={access.allowedRoles}
      />
      <SuspendDialog member={actions.suspendMember} onClose={actions.closeSuspend} />
      <RemoveMemberDialog
        member={actions.removeMember}
        members={access.members}
        onClose={actions.closeRemove}
        onSuspendInstead={actions.openSuspend}
      />
      {actions.archiveUserId && <ArchiveHost userId={actions.archiveUserId} onClose={actions.closeArchive} />}
      <RoleMatrixDialog open={actions.matrix} onClose={() => actions.setMatrix(false)} />
      <ConfirmDialog
        open={!!change && !!nextRole}
        title={change && nextRole ? `Change ${change.user.name} to ${roleLabel(nextRole)}?` : "Change role?"}
        confirmLabel="Change role"
        pending={actions.rolePending}
        onConfirm={actions.confirmRoleChange}
        onClose={actions.cancelRoleChange}
        icon={<Users className="h-5 w-5" />}
        testId="role-change-dialog"
      >
        {nextRole === "referral_agent"
          ? "They will only use the referral hub."
          : `Access follows the role, so they will get the ${roleDisplay(nextRole).label} defaults: ${permissionCount(nextRole)} of ${PERMISSION_COUNT} permissions.`}{" "}
        The change applies straight away.
      </ConfirmDialog>
    </div>
  );
}
