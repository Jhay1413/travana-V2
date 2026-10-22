import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { balanceLabel, commissionLabel, displayWeb, hrefFor, updatedLabel } from "../lib/format";
import { formFromRow } from "../lib/form-validation";
import type { OrgOperatorRow } from "../types";
import { TD } from "./classes";
import { Copyable, Dash, PasswordCell } from "./copyable";
import { OperatorForm } from "./operator-form";
import type { RowContext } from "./row-context";
import { RowActions } from "./row-actions";

export function WebLink({ url }: { url: string | null }) {
  if (!url) return <Dash />;
  return (
    <a href={hrefFor(url)} target="_blank" rel="noreferrer noopener" title={url} className="inline-block max-w-[130px] truncate align-bottom text-blue-600 hover:underline dark:text-blue-400">
      {displayWeb(url)}
    </a>
  );
}

export function RateText({ value, className }: { value: string | null; className?: string }) {
  return <b className={cn("font-semibold tabular-nums text-stage-enquiry-fg", className)}>{commissionLabel(value)}</b>;
}

/** One table row, or the inline edit form that replaces it. */
export function OperatorRow({ row, ctx }: { row: OrgOperatorRow; ctx: RowContext }) {
  const colSpan = ctx.canWrite ? 8 : 7;
  if (ctx.editLinkId === row.linkId) {
    return (
      <tr className="bg-stage-inplay-bg/40" data-testid={`operator-row-${row.linkId}`}>
        <td colSpan={colSpan} className="px-3 py-3">
          <OperatorForm
            mode="edit"
            idPrefix={`to-${row.linkId}`}
            initial={formFromRow(row)}
            existing={ctx.existing}
            editingLinkId={row.linkId}
            busy={ctx.busy}
            onSubmit={(values) => ctx.onSave(row, values)}
            onCancel={() => ctx.onEdit(null)}
          />
        </td>
      </tr>
    );
  }
  const updated = updatedLabel(row.updated_at);
  return (
    <tr className={cn("border-t border-social-border", !row.is_active && "text-social-muted")} data-testid={`operator-row-${row.linkId}`}>
      <td className={cn(TD, "min-w-[140px] whitespace-normal")}>
        <div className="flex flex-wrap items-center gap-2">
          <b className="font-semibold">{row.name}</b>
          {!row.is_active && <StatusPill tone="plain">Inactive</StatusPill>}
        </div>
        {updated && <span className="block text-[12px] text-social-muted">{updated}</span>}
      </td>
      <td className={cn(TD, "tabular-nums")}>
        <Copyable label="Phone" value={row.phone} copy={ctx.copy} />
      </td>
      <td className={TD}>
        <WebLink url={row.website} />
      </td>
      <td className={TD}>
        <Copyable label="Username" value={row.username} copy={ctx.copy} />
      </td>
      <td className={TD}>
        <PasswordCell row={row} canSeePasswords={ctx.canSeePasswords} copy={ctx.copy} copyLater={ctx.copyLater} />
      </td>
      <td className={cn(TD, "text-right")}>
        <RateText value={row.commission_percentage} className="text-[15px]" />
      </td>
      <td className={cn(TD, "text-right")}>
        <b className="font-semibold">{balanceLabel(row.balance_due_weeks)}</b>
        <div className="text-[12px] text-social-muted">before travel</div>
      </td>
      {ctx.canWrite && (
        <td className={TD}>
          <RowActions
            row={row}
            busy={ctx.busy}
            confirming={ctx.confirmLinkId === row.linkId}
            onEdit={() => ctx.onEdit(row.linkId)}
            onAskDelete={() => ctx.onAskDelete(row.linkId)}
            onCancelDelete={() => ctx.onAskDelete(null)}
            onConfirmDelete={() => ctx.onDelete(row)}
          />
        </td>
      )}
    </tr>
  );
}
