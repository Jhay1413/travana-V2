import { Plus } from "lucide-react";
import type { InviteOrgRole } from "@/features/invite/api/invite.api";
import { MAX_ROWS, type BranchOption, type InviteRow, type RowErrors } from "../../lib/invite-rows";
import type { RowResult } from "../../state/use-invite-rows";
import { InviteRowView, ROW_GRID } from "./invite-row";

interface InviteRowsTableProps {
  rows: InviteRow[];
  errors: Record<string, RowErrors>;
  results: Record<string, RowResult>;
  branches: BranchOption[];
  allowedRoles: readonly InviteOrgRole[];
  lockedBranchId: string | null;
  disabled: boolean;
  onPatch: (id: string, patch: Partial<InviteRow>) => void;
  onRole: (row: InviteRow, role: InviteOrgRole) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
}

const HEAD = "text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted";

export function InviteRowsTable(p: InviteRowsTableProps) {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[760px]">
        <div className={`${ROW_GRID} mb-2`}>
          <span />
          <span className={HEAD}>First name</span>
          <span className={HEAD}>Last name</span>
          <span className={HEAD}>Email</span>
          <span className={HEAD}>Role</span>
          <span className={HEAD}>Branch</span>
          <span />
        </div>
        <div className="space-y-2">
          {p.rows.map((row, i) => (
            <InviteRowView
              key={row.id}
              row={row}
              index={i}
              errors={p.errors[row.id]}
              result={p.results[row.id]}
              branches={p.branches}
              allowedRoles={p.allowedRoles}
              lockedBranchId={p.lockedBranchId}
              disabled={p.disabled}
              onPatch={p.onPatch}
              onRole={p.onRole}
              onRemove={p.onRemove}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={p.onAdd}
          disabled={p.rows.length >= MAX_ROWS || p.disabled}
          className="mt-3 ml-9 inline-flex items-center gap-1 text-[13px] font-semibold text-social-orange-text hover:underline disabled:opacity-50"
          data-testid="button-add-row"
        >
          <Plus className="h-3.5 w-3.5" /> Add another person
        </button>
        {p.rows.length >= MAX_ROWS && <span className="ml-3 text-[12px] text-social-muted">Up to {MAX_ROWS} people at a time.</span>}
      </div>
    </div>
  );
}
