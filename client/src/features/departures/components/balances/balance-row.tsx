import { Checkbox } from "@/components/ui/checkbox";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import { paidPill } from "../../lib/balance-rows";
import type { DepartureCheckKey, DepartureRow } from "../../types";
import { LastChange, TD, TD_CENTER, WhenCell } from "../shared/list-bits";
import { TICK_BOX, Tick } from "../shared/tick";

export interface BalanceRowProps {
  row: DepartureRow;
  days: number;
  onCheck: (row: DepartureRow, key: DepartureCheckKey, value: boolean) => void;
}

function PaidPill({ paid, days }: { paid: boolean; days: number }) {
  const pill = paidPill(paid, days);
  return <StatusPill tone={pill.tone}>{pill.label}</StatusPill>;
}

/** Table row of the Balances list (wide screens). */
export function BalanceRow({ row, days, onCheck }: BalanceRowProps) {
  const paid = row.checks.fullyPaid;
  return (
    <tr className={cn("border-t border-social-border", paid && "bg-departure-done-bg")} data-testid={`row-balance-${row.bookingId}`}>
      <td className={TD}>
        <span className="font-semibold tabular-nums tracking-[0.01em] text-social-navy">{row.haysRef || "—"}</span>
      </td>
      <td className={TD}>
        <WhenCell travelDate={row.travelDate} days={days} done={paid} />
      </td>
      <td className={TD}>
        <b className="font-semibold">{row.leadPassenger}</b>
      </td>
      <td className={TD}>{row.destination ?? "—"}</td>
      <td className={TD}>
        <span className="block">{row.operatorName ?? "—"}</span>
        {row.supplierRef && <span className="block text-[12px] text-social-muted">{row.supplierRef}</span>}
      </td>
      <td className={TD_CENTER}>
        <div className="flex flex-col items-center gap-1">
          <Tick
            checked={paid}
            onChange={(v) => onCheck(row, "fullyPaid", v)}
            label={`Fully paid, ${row.haysRef} ${row.leadPassenger}`}
            testId={`tick-fullyPaid-${row.bookingId}`}
          />
          <PaidPill paid={paid} days={days} />
        </div>
      </td>
      <td className={TD}>
        <LastChange change={row.lastChange} />
      </td>
    </tr>
  );
}

/** Card version of a balance row (screens up to 860px). */
export function BalanceCard({ row, days, onCheck }: BalanceRowProps) {
  const paid = row.checks.fullyPaid;
  return (
    <li
      className={cn("flex flex-col gap-2.5 rounded-xl border p-3.5", paid ? "border-departure-done-border bg-departure-done-bg" : "border-social-border bg-card")}
      data-testid={`card-balance-${row.bookingId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="font-semibold">{row.leadPassenger}</b>
          <div className="text-[12px] text-social-muted">{[row.haysRef, row.destination, row.operatorName].filter(Boolean).join(" · ")}</div>
        </div>
        <WhenCell travelDate={row.travelDate} days={days} done={paid} />
      </div>
      <label className="flex min-h-10 cursor-pointer items-center gap-2.5 text-[14px]">
        <Checkbox checked={paid} onCheckedChange={(v) => onCheck(row, "fullyPaid", v === true)} className={TICK_BOX} />
        <span className="font-semibold">Fully paid</span>
        <PaidPill paid={paid} days={days} />
      </label>
      <LastChange change={row.lastChange} />
    </li>
  );
}
