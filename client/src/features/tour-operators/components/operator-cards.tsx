import type { ReactNode } from "react";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { balanceLabel, commissionLabel } from "../lib/format";
import { formFromRow } from "../lib/form-validation";
import type { OrgOperatorRow } from "../types";
import { Copyable, PasswordCell } from "./copyable";
import { OperatorForm } from "./operator-form";
import { WebLink } from "./operator-row";
import { RowActions } from "./row-actions";
import type { RowContext } from "./row-context";

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-social-muted">{label}</dt>
      <dd className="min-w-0 [overflow-wrap:anywhere]">{children}</dd>
    </>
  );
}

function OperatorCard({ row, ctx }: { row: OrgOperatorRow; ctx: RowContext }) {
  if (ctx.editLinkId === row.linkId) {
    return (
      <li className="rounded-xl border border-social-border bg-stage-inplay-bg/40 p-3.5" data-testid={`operator-card-${row.linkId}`}>
        <OperatorForm
          mode="edit"
          stacked
          idPrefix={`toc-${row.linkId}`}
          initial={formFromRow(row)}
          existing={ctx.existing}
          editingLinkId={row.linkId}
          busy={ctx.busy}
          onSubmit={(values) => ctx.onSave(row, values)}
          onCancel={() => ctx.onEdit(null)}
        />
      </li>
    );
  }
  return (
    <li className={cn("flex flex-col gap-2.5 rounded-xl border border-social-border bg-card p-3.5", !row.is_active && "text-social-muted")} data-testid={`operator-card-${row.linkId}`}>
      <div className="flex items-center justify-between gap-2">
        <b className="text-[15px] font-semibold">{row.name}</b>
        <span className="flex items-center gap-2">
          {!row.is_active && <StatusPill tone="plain">Inactive</StatusPill>}
          <StatusPill tone="good">{commissionLabel(row.commission_percentage)}</StatusPill>
        </span>
      </div>
      <dl className="grid grid-cols-[90px_1fr] gap-x-2.5 gap-y-1.5 text-[14px]">
        <Pair label="Phone">
          <Copyable label="Phone" value={row.phone} copy={ctx.copy} />
        </Pair>
        <Pair label="Weblink">
          <WebLink url={row.website} />
        </Pair>
        <Pair label="Username">
          <Copyable label="Username" value={row.username} copy={ctx.copy} />
        </Pair>
        <Pair label="Password">
          <PasswordCell row={row} canSeePasswords={ctx.canSeePasswords} copy={ctx.copy} copyLater={ctx.copyLater} />
        </Pair>
        <Pair label="Commission">{commissionLabel(row.commission_percentage)}</Pair>
        <Pair label="Balance due">{balanceLabel(row.balance_due_weeks)} before departure</Pair>
      </dl>
      {ctx.canWrite && (
        <RowActions
          row={row}
          busy={ctx.busy}
          confirming={ctx.confirmLinkId === row.linkId}
          onEdit={() => ctx.onEdit(row.linkId)}
          onAskDelete={() => ctx.onAskDelete(row.linkId)}
          onCancelDelete={() => ctx.onAskDelete(null)}
          onConfirmDelete={() => ctx.onDelete(row)}
        />
      )}
    </li>
  );
}

/** Phone layout (900px or narrower). */
export function OperatorCards({ rows, ctx }: { rows: OrgOperatorRow[]; ctx: RowContext }) {
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <OperatorCard key={row.linkId} row={row} ctx={ctx} />
      ))}
    </ul>
  );
}
