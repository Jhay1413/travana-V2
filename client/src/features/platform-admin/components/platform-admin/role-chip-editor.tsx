import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { useAdminUserRoles } from "@/hooks/queries";
import { useAddUserRole, useRemoveUserRole } from "@/hooks/mutations";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { HOMEWORKER_INVITE_ONLY_HINT, addableRoles, isHomeworkerLocked } from "@/features/platform-admin/lib/role-options";
import type { AssignableOrgRole } from "@/features/platform-admin/api/platform-admin.api";

const ALL_ROLES: AssignableOrgRole[] = [
  "org_admin",
  "branch_manager",
  "agent",
  "homeworker",
  "referral_agent",
  "social_media_manager",
];

const INTERNAL_ROLES = new Set<AssignableOrgRole>([
  "org_admin",
  "branch_manager",
  "agent",
  "homeworker",
  "social_media_manager",
]);

const ROLE_LABEL: Record<AssignableOrgRole, string> = {
  org_admin:            "Org admin",
  branch_manager:       "Branch manager",
  agent:                "Agent",
  homeworker:           "Homeworker",
  referral_agent:       "Referral agent",
  social_media_manager: "Social media manager",
};

/**
 * Inline chip-style multi-role editor. Shows the user's current roles as chips
 * (click X to remove); pick from a dropdown to add another. Enforces the
 * referral_agent exclusion rule client-side for snappier UX — the server
 * enforces it too.
 */
export function RoleChipEditor({
  orgId,
  userId,
  disabled,
}: {
  orgId: string;
  userId: string;
  disabled?: boolean;
}) {
  const { data: roles = [], isLoading } = useAdminUserRoles(orgId, userId);
  const addRole    = useAddUserRole();
  const removeRole = useRemoveUserRole();
  const [picker, setPicker] = useState<AssignableOrgRole | "">("");

  const addable = useMemo(() => addableRoles(roles as AssignableOrgRole[], ALL_ROLES, INTERNAL_ROLES), [roles]);
  const homeworkerLocked = isHomeworkerLocked(roles);

  const lastRole = roles.length <= 1;
  const busy     = addRole.isPending || removeRole.isPending;

  if (isLoading) {
    return <Loader2 className="h-4 w-4 animate-spin text-black/40" />;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {roles.map((r) => (
        <Chip
          key={r}
          label={ROLE_LABEL[r as AssignableOrgRole] ?? r}
          onRemove={
            disabled || lastRole || homeworkerLocked
              ? undefined
              : () => removeRole.mutate({ orgId, userId, role: r as AssignableOrgRole })
          }
          removing={removeRole.isPending && removeRole.variables?.role === r}
          testId={`chip-role-${r}-${userId}`}
        />
      ))}
      {homeworkerLocked && (
        <span className="text-xs text-black/40 dark:text-white/40" title={HOMEWORKER_INVITE_ONLY_HINT} data-testid={`hint-homeworker-locked-${userId}`}>
          Invite-only
        </span>
      )}
      {!disabled && !homeworkerLocked && addable.length > 0 && (
        <Select
          value={picker}
          onValueChange={(v) => {
            const role = v as AssignableOrgRole;
            setPicker("");
            addRole.mutate({ orgId, userId, role });
          }}
          disabled={busy}
        >
          <SelectTrigger
            className="h-6 w-auto gap-1 border-dashed px-2 text-xs"
            data-testid={`select-add-role-${userId}`}
          >
            <Plus className="h-3 w-3" />
            <SelectValue placeholder="Add" />
          </SelectTrigger>
          <SelectContent>
            {addable.map((r) => (
              <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function Chip({
  label,
  onRemove,
  removing,
  testId,
}: {
  label: string;
  onRemove?: () => void;
  removing?: boolean;
  testId?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10",
        removing && "opacity-50",
      )}
      data-testid={testId}
    >
      {label}
      {onRemove && (
        <button
          onClick={onRemove}
          disabled={removing}
          className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/20"
          aria-label={`Remove ${label}`}
        >
          {removing ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <X className="h-2.5 w-2.5" />}
        </button>
      )}
    </span>
  );
}
