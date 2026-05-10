import { PauseCircle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrgMember } from "@/api/endpoints/organization.api";
import { ASSIGNABLE_ROLES, isMemberSuspended } from "../utils/role-helpers";

export function MemberRow({
  member,
  isCurrentUser,
  isMutating,
  isReadOnly,
  onRoleChange,
  onToggleSuspend,
}: {
  member: OrgMember;
  isCurrentUser: boolean;
  isMutating: boolean;
  isReadOnly?: boolean;
  onRoleChange: (newRole: string) => void;
  onToggleSuspend: () => void;
}) {
  const suspended = isMemberSuspended(member);
  const controlsDisabled = isCurrentUser || isMutating || isReadOnly;
  return (
    <tr
      className="border-b border-black/5 last:border-0 dark:border-white/10"
      data-testid={`row-member-${member.user.id}`}
    >
      <td className="px-4 py-3">
        <div className="font-medium">
          {member.user.name}{" "}
          {isCurrentUser && <span className="ml-1 text-xs text-black/40 dark:text-white/40">(you)</span>}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">{member.user.email}</div>
      </td>
      <td className="px-4 py-3">
        <select
          value={member.user.orgRole ?? "agent"}
          onChange={(e) => onRoleChange(e.target.value)}
          disabled={controlsDisabled}
          title={isReadOnly ? "Only the agency owner can change roles" : undefined}
          className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs disabled:opacity-50 dark:border-white/10 dark:bg-white/5"
          data-testid={`select-role-${member.user.id}`}
        >
          {ASSIGNABLE_ROLES.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {member.branches.length === 0 ? (
            <span className="text-xs text-black/40 dark:text-white/40">No branch</span>
          ) : (
            member.branches.map((b) => (
              <span
                key={b.branchId}
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                  b.isActive
                    ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                    : "bg-black/5 text-black/40 line-through dark:bg-white/5 dark:text-white/40",
                )}
                title={b.isActive ? "Active in this branch" : "Suspended in this branch"}
              >
                {b.branchName}
              </span>
            ))
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
            suspended
              ? "bg-red-500/10 text-red-700 dark:text-red-300"
              : !member.user.emailVerified
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {suspended ? "Suspended" : !member.user.emailVerified ? "Unverified" : "Active"}
        </span>
      </td>
      <td className="px-4 py-3 text-right">
        {isReadOnly ? (
          <span className="text-xs text-black/40 dark:text-white/40">—</span>
        ) : (
        <button
          onClick={onToggleSuspend}
          disabled={controlsDisabled}
          className="text-xs font-medium text-black/60 hover:text-black disabled:opacity-40 dark:text-white/60 dark:hover:text-white"
          data-testid={`button-toggle-${member.user.id}`}
        >
          {suspended ? (
            <span className="inline-flex items-center gap-1">
              <PlayCircle className="h-3.5 w-3.5" /> Reactivate
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <PauseCircle className="h-3.5 w-3.5" /> Suspend
            </span>
          )}
        </button>
        )}
      </td>
    </tr>
  );
}
