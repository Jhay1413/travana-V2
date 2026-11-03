import { Check, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { cn } from "@/lib/utils";
import { firstError, isBlankRow, type BranchOption, type InviteRow as Row, type RowErrors } from "../../lib/invite-rows";
import { roleLabel } from "../../lib/role-helpers";
import type { RowResult } from "../../state/use-invite-rows";
import { BranchSelect } from "../shared/branch-select";
import { RoleSelect } from "../shared/role-select";
import { TEAM_CONTROL } from "../shared/team-styles";

export const ROW_GRID = "grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1.25fr)_minmax(0,1.4fr)_36px] items-center gap-2";

interface InviteRowProps {
  row: Row;
  index: number;
  errors: RowErrors | undefined;
  result: RowResult | undefined;
  branches: BranchOption[];
  allowedRoles: readonly InviteOrgRole[];
  lockedBranchId: string | null;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<Row>) => void;
  onRole: (row: Row, role: InviteOrgRole) => void;
  onRemove: (id: string) => void;
}

export function InviteRowView({ row, index, errors, result, branches, allowedRoles, lockedBranchId, disabled, onPatch, onRole, onRemove }: InviteRowProps) {
  const n = index + 1;
  const sent = result?.status === "sent";
  const locked = disabled || sent;
  const homeworker = row.role === "homeworker";
  const roles = allowedRoles.map((value) => ({ value, label: roleLabel(value) }));
  const message = result?.status === "failed" ? result.message : firstError(errors);
  const input = (bad: boolean) => cn(TEAM_CONTROL, "h-10 min-w-0", bad && "border-status-failed-fg");

  return (
    <div data-testid={`invite-row-${n}`} className={cn(sent && "opacity-70")}>
      <div className={ROW_GRID} data-row={n}>
        <span className="text-center text-[12px] font-semibold text-social-muted">{n}</span>
        <Input value={row.first} onChange={(e) => onPatch(row.id, { first: e.target.value })} placeholder="First name" aria-label={`First name, row ${n}`} aria-invalid={!!errors?.first || undefined} disabled={locked} className={input(!!errors?.first)} />
        <Input value={row.last} onChange={(e) => onPatch(row.id, { last: e.target.value })} placeholder="Last name" aria-label={`Last name, row ${n}`} aria-invalid={!!errors?.last || undefined} disabled={locked} className={input(!!errors?.last)} />
        <Input type="email" value={row.email} onChange={(e) => onPatch(row.id, { email: e.target.value })} placeholder="Email address" aria-label={`Email, row ${n}`} aria-invalid={!!errors?.email || undefined} disabled={locked} className={input(!!errors?.email)} />
        <div className={cn("min-w-0 rounded-[10px]", errors?.role && "ring-1 ring-status-failed-fg")}>
          <RoleSelect label={`Role, row ${n}`} value={row.role} options={roles} onChange={(v) => onRole(row, v as InviteOrgRole)} disabled={locked} />
        </div>
        <div className="min-w-0">
          <BranchSelect
            label={`Branch, row ${n}`}
            value={homeworker ? "" : row.branchId}
            options={branches}
            onChange={(branchId) => onPatch(row.id, { branchId, branchText: "" })}
            disabled={locked || homeworker || !!lockedBranchId}
            emptyLabel={homeworker ? "Own branch" : row.branchText ? row.branchText : "Select branch"}
            invalid={!!errors?.branch}
          />
        </div>
        {isBlankRow(row) || sent ? (
          <span aria-hidden />
        ) : (
          <button
            type="button"
            onClick={() => onRemove(row.id)}
            disabled={disabled}
            className="grid h-9 w-9 place-items-center rounded-[8px] text-social-muted hover:bg-muted hover:text-stage-lost-fg disabled:opacity-40"
            aria-label={`Remove row ${n}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
      {sent && (
        <p className="ml-9 mt-1 flex items-center gap-1 text-[12px] font-semibold text-status-scheduled-fg" role="status">
          <Check className="h-3.5 w-3.5" strokeWidth={3} /> Sent
        </p>
      )}
      {message && !sent && (
        <p className="ml-9 mt-1 text-[12px] text-status-failed-fg" role="alert" data-testid={`invite-row-error-${n}`}>
          Row {n}: {message}
        </p>
      )}
    </div>
  );
}
