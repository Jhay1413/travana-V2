import type { OrgMember } from "@/features/organization/api/organization.api";
import { Button } from "@/components/ui/button";
import { OUTLINE_ACTION } from "@/features/pipeline/shared/button-styles";
import { cn } from "@/lib/utils";
import type { DrawerTab } from "../../types";
import { isHomeworkerMember, isSelf, memberStatus } from "../../lib/member-status";
import { roleOptionsForMember } from "../../lib/role-helpers";
import { PERMISSION_COUNT, REFERRAL_NOTE, permissionCount } from "../../lib/role-permissions";
import { BranchPills } from "../shared/branch-pills";
import { MemberAvatar } from "../shared/member-avatar";
import { RoleSelect } from "../shared/role-select";
import { StatusPill } from "../shared/status-pill";
import { MemberRowMenu } from "./member-row-menu";

export interface MemberRowProps {
  member: OrgMember;
  currentUserId: string | null;
  isAdmin: boolean;
  canArchive: boolean;
  roleBusy: boolean;
  onRoleChange: (member: OrgMember, role: string) => void;
  onOpen: (member: OrgMember, tab: DrawerTab) => void;
  onSuspend: (member: OrgMember) => void;
  onReactivate: (member: OrgMember) => void;
  onRemove: (member: OrgMember) => void;
  onArchive: (member: OrgMember) => void;
}

const CELL = "px-4 py-3 align-middle";

export function MemberRow(p: MemberRowProps) {
  const m = p.member;
  const self = isSelf(m, p.currentUserId);
  const suspended = memberStatus(m) === "suspended";
  const homeworker = isHomeworkerMember(m);
  const roleLocked = !p.isAdmin || self || homeworker || suspended || p.roleBusy;
  const referral = m.user.orgRole === "referral_agent";

  return (
    <tr className="border-t border-social-border" data-testid={`row-member-${m.user.id}`}>
      <td className={CELL}>
        <div className="flex items-center gap-3">
          <MemberAvatar name={m.user.name} suspended={suspended} />
          <div className="min-w-0">
            <div className={cn("truncate text-[14px] font-semibold", suspended && "text-social-muted")}>
              {m.user.name}
              {self && <span className="ml-1 text-[12px] font-normal text-social-muted">(you)</span>}
            </div>
            <div className="truncate text-[12px] text-social-muted">{m.user.email}</div>
          </div>
        </div>
      </td>
      <td className={cn(CELL, "w-[220px]")}>
        <RoleSelect
          label={`Role for ${m.user.name}`}
          value={m.user.orgRole ?? "agent"}
          options={roleOptionsForMember(m.user.orgRole)}
          onChange={(role) => p.onRoleChange(m, role)}
          disabled={roleLocked}
          className="h-9"
          testId={`select-role-${m.user.id}`}
        />
      </td>
      <td className={CELL}>
        <BranchPills branches={m.branches} />
      </td>
      <td className={cn(CELL, "whitespace-nowrap text-[13px] font-medium")} data-testid={`perm-count-${m.user.id}`}>
        {referral ? (
          <span className="text-social-muted">{REFERRAL_NOTE}</span>
        ) : (
          `${permissionCount(m.user.orgRole)} of ${PERMISSION_COUNT}`
        )}
      </td>
      <td className={CELL}>
        <StatusPill status={suspended ? "suspended" : "active"} />
        {!suspended && !m.user.emailVerified && (
          <div className="mt-1 text-[11px] font-semibold text-ticket-amber-fg" data-testid={`unverified-${m.user.id}`}>
            Unverified email
          </div>
        )}
      </td>
      <td className={cn(CELL, "text-right")}>
        <div className="flex items-center justify-end gap-2">
          {suspended && p.isAdmin && !self ? (
            <Button
              type="button"
              variant="outline"
              className={cn(OUTLINE_ACTION, "h-8 px-3")}
              onClick={() => p.onReactivate(m)}
              data-testid={`button-reactivate-${m.user.id}`}
            >
              Reactivate
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className={cn(OUTLINE_ACTION, "h-8 px-3")}
              onClick={() => p.onOpen(m, "details")}
              aria-label={`${p.isAdmin ? "Edit" : "View"} ${m.user.name}`}
              data-testid={`button-edit-${m.user.id}`}
            >
              {p.isAdmin ? "Edit" : "View"}
            </Button>
          )}
          <MemberRowMenu
            name={m.user.name}
            userId={m.user.id}
            suspended={suspended}
            isSelf={self}
            isAdmin={p.isAdmin}
            isHomeworker={homeworker}
            canArchive={p.canArchive}
            onView={() => p.onOpen(m, "details")}
            onPermissions={() => p.onOpen(m, "permissions")}
            onSuspend={() => p.onSuspend(m)}
            onReactivate={() => p.onReactivate(m)}
            onRemove={() => p.onRemove(m)}
            onArchive={() => p.onArchive(m)}
          />
        </div>
      </td>
    </tr>
  );
}
