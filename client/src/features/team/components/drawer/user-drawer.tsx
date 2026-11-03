import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { UnderlineTabs } from "@/components/shared/underline-tabs";
import type { OrgMember } from "@/features/organization/api/organization.api";
import { ICON_BUTTON, OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import { isHomeworkerMember, isSelf, memberStatus } from "../../lib/member-status";
import { useProfileDraft } from "../../state/use-profile-draft";
import { ConfirmDialog } from "../dialogs/confirm-dialog";
import { MemberAvatar } from "../shared/member-avatar";
import { RolePill } from "../shared/role-pill";
import { StatusPill } from "../shared/status-pill";
import { AMBER_ACTION, DANGER_TEXT_ACTION } from "../shared/team-styles";
import type { DrawerTab } from "../../types";
import { DetailsTab } from "./details-tab";
import { PermissionsTab } from "./permissions-tab";

export interface UserDrawerProps {
  member: OrgMember | null;
  tab: DrawerTab;
  onTab: (tab: DrawerTab) => void;
  onClose: () => void;
  isAdmin: boolean;
  currentUserId: string | null;
  onRoleChange: (member: OrgMember, role: string) => void;
  onSuspend: (member: OrgMember) => void;
  onReactivate: (member: OrgMember) => void;
  onRemove: (member: OrgMember) => void;
}

const TABS: Array<{ value: DrawerTab; label: string }> = [
  { value: "details", label: "Details" },
  { value: "permissions", label: "Permissions" },
];

export function UserDrawer(props: UserDrawerProps) {
  const { member, onClose } = props;
  return (
    <Sheet open={!!member} onOpenChange={(open) => !open && onClose()}>
      {member && <DrawerBody key={member.user.id} {...props} member={member} />}
    </Sheet>
  );
}

function DrawerBody({ member, tab, onTab, onClose, isAdmin, currentUserId, onRoleChange, onSuspend, onReactivate, onRemove }: UserDrawerProps & { member: OrgMember }) {
  const profile = useProfileDraft(member);
  const [discard, setDiscard] = useState(false);
  // What to do once the person agrees to lose their edits (close, or open another dialog).
  const [afterDiscard, setAfterDiscard] = useState<(() => void) | null>(null);
  const self = isSelf(member, currentUserId);
  const suspended = memberStatus(member) === "suspended";
  const manage = isAdmin && !self;
  const canRemove = manage && !isHomeworkerMember(member);
  const guard = (action: () => void) => () => {
    if (profile.dirty) {
      setAfterDiscard(() => action);
      setDiscard(true);
    } else action();
  };
  const requestClose = guard(onClose);

  const save = async () => {
    const result = await profile.save();
    if (result.ok) onClose();
    else if (result.invalid) onTab("details");
  };

  return (
    <>
      <SheetContent
        side="right"
        hideClose
        onInteractOutside={(e) => {
          if (profile.dirty) {
            e.preventDefault();
            requestClose();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (profile.dirty) {
            e.preventDefault();
            requestClose();
          }
        }}
        className="flex w-full flex-col gap-0 border-social-border p-0 sm:max-w-[520px]"
        data-testid="user-drawer"
      >
        <div className="relative flex-none border-b border-social-border px-6 pb-0 pt-6">
          <button type="button" onClick={requestClose} className={cn(ICON_BUTTON, "absolute right-5 top-5")} aria-label="Close" data-testid="button-close-drawer">
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-4 pr-10">
            <MemberAvatar name={member.user.name} suspended={suspended} size={56} />
            <div className="min-w-0">
              <SheetTitle className="truncate text-[20px] font-semibold leading-tight">
                {member.user.name}
                {self && <span className="ml-1.5 text-[12px] font-normal text-social-muted">(you)</span>}
              </SheetTitle>
              <SheetDescription className="truncate text-[12px] text-social-muted">{member.user.email}</SheetDescription>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <RolePill role={member.user.orgRole} />
                <StatusPill status={suspended ? "suspended" : "active"} />
              </div>
            </div>
          </div>
          <UnderlineTabs tabs={TABS} value={tab} onChange={onTab} label="Member sections" testIdPrefix="drawer-tab" className="mt-5 border-b-0" />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === "details" ? (
            <DetailsTab member={member} profile={profile} isAdmin={isAdmin} currentUserId={currentUserId} onRoleChange={onRoleChange} />
          ) : (
            <PermissionsTab role={member.user.orgRole} />
          )}
        </div>

        <div className="flex flex-none flex-wrap items-center justify-between gap-2 border-t border-social-border px-6 py-3.5">
          <div className="flex gap-1.5">
            {manage && !suspended && (
              <Button type="button" variant="outline" className={AMBER_ACTION} onClick={guard(() => onSuspend(member))} data-testid="button-drawer-suspend">
                Suspend
              </Button>
            )}
            {manage && suspended && (
              <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={guard(() => onReactivate(member))} data-testid="button-drawer-reactivate">
                Reactivate
              </Button>
            )}
            {canRemove && (
              <Button type="button" variant="ghost" className={DANGER_TEXT_ACTION} onClick={guard(() => onRemove(member))} data-testid="button-drawer-remove">
                Remove
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" className={cn(OUTLINE_ACTION, "h-8 px-3")} onClick={requestClose}>
              {isAdmin ? "Cancel" : "Close"}
            </Button>
            {isAdmin && !self && (
              <Button type="button" className={cn(PRIMARY_ACTION, "h-8 px-4")} onClick={save} disabled={!profile.dirty || profile.saving} data-testid="button-drawer-save">
                {profile.saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
      <ConfirmDialog open={discard} title="Discard your changes?" confirmLabel="Discard changes" onClose={() => setDiscard(false)} onConfirm={() => { setDiscard(false); (afterDiscard ?? onClose)(); }}>
        You have unsaved changes to {member.user.name}. If you close now they will be lost.
      </ConfirmDialog>
    </>
  );
}
