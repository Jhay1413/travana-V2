import { OperatorTile } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { completedDisabled, stepsDone } from "../../lib/checks";
import { CHECK_STEPS } from "../../lib/stamp";
import type { DepartureCheckKey, DepartureRow } from "../../types";
import { LastChange, TD, TD_CENTER, WhenCell } from "../shared/list-bits";
import { Tick } from "../shared/tick";

export interface TicketRowProps {
  row: DepartureRow;
  days: number;
  onCheck: (row: DepartureRow, key: DepartureCheckKey, value: boolean) => void;
}

const COMPLETED_TITLE = "Tick the four checks first";

/** Table row of the Tickets list (wide screens). */
export function TicketRow({ row, days, onCheck }: TicketRowProps) {
  const { checks } = row;
  const done = checks.completed;
  const disabled = completedDisabled(checks);
  return (
    <tr
      className={cn("border-t border-social-border", done && "bg-departure-done-bg")}
      data-testid={`row-ticket-${row.bookingId}`}
    >
      <td className={TD}>
        <span className="font-semibold tabular-nums tracking-[0.01em] text-social-navy">{row.haysRef || "—"}</span>
      </td>
      <td className={TD}>
        <b className="block font-semibold">{row.clientName}</b>
        <LastChange change={row.lastChange} />
      </td>
      <td className={TD}>
        <WhenCell travelDate={row.travelDate} days={days} done={done} />
      </td>
      <td className={TD}>
        <span className="flex items-center gap-2">
          <OperatorTile name={row.operatorName} logoUrl={row.operatorLogoUrl} size={30} />
          <span>{row.operatorName ?? "—"}</span>
        </span>
      </td>
      <td className={TD}>{row.destination ?? "—"}</td>
      {CHECK_STEPS.map((s) => (
        <td className={TD_CENTER} key={s.key}>
          <Tick
            checked={checks[s.key]}
            onChange={(v) => onCheck(row, s.key, v)}
            label={`${s.label}, ${row.clientName}`}
            testId={`tick-${s.key}-${row.bookingId}`}
          />
        </td>
      ))}
      <td className={TD_CENTER}>
        <div className="flex flex-col items-center gap-0.5">
          <Tick
            checked={done}
            onChange={(v) => onCheck(row, "completed", v)}
            disabled={disabled}
            title={disabled ? COMPLETED_TITLE : undefined}
            label={`Completed, ${row.clientName}`}
            testId={`tick-completed-${row.bookingId}`}
          />
          <span className="text-[12px] text-social-muted">{done ? "Done" : `${stepsDone(checks)} of 4`}</span>
        </div>
      </td>
    </tr>
  );
}
