import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { completedDisabled, stepsDone } from "../../lib/checks";
import { CHECK_STEPS } from "../../lib/stamp";
import { TICK_BOX } from "../shared/tick";
import type { DepartureCheckKey } from "../../types";
import { LastChange, WhenCell } from "../shared/list-bits";
import type { TicketRowProps } from "./ticket-row";

function CheckLine({
  label,
  checked,
  disabled,
  onChange,
  extra,
  hint,
  bold,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  extra?: string;
  hint?: string;
  bold?: boolean;
}) {
  return (
    <li>
      <label title={disabled ? hint : undefined} className={cn("flex min-h-10 flex-wrap items-center gap-2.5 text-[14px]", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <Checkbox checked={checked} disabled={disabled} aria-label={disabled && hint ? `${label}. ${hint}` : label} onCheckedChange={(v) => onChange(v === true)} className={TICK_BOX} />
        <span className={bold ? "font-semibold" : undefined}>{label}</span>
        {extra && <span className="text-[12px] text-social-muted">{extra}</span>}
      </label>
    </li>
  );
}

/** Card version of a ticket row (screens up to 860px): two-column checks grid. */
export function TicketCard({ row, days, onCheck }: TicketRowProps) {
  const { checks } = row;
  const done = checks.completed;
  const set = (key: DepartureCheckKey) => (value: boolean) => onCheck(row, key, value);
  return (
    <li
      className={cn("flex flex-col gap-2.5 rounded-xl border p-3.5", done ? "border-departure-done-border bg-departure-done-bg" : "border-social-border bg-card")}
      data-testid={`card-ticket-${row.bookingId}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <b className="font-semibold">{row.clientName}</b>
          <div className="text-[12px] text-social-muted">{[row.destination, row.operatorName].filter(Boolean).join(" · ")}</div>
        </div>
        <WhenCell travelDate={row.travelDate} days={days} done={done} />
      </div>
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 max-[420px]:grid-cols-1">
        {CHECK_STEPS.map((s) => (
          <CheckLine key={s.key} label={s.label} checked={checks[s.key]} onChange={set(s.key)} />
        ))}
        <CheckLine
          label="Completed"
          bold
          checked={done}
          disabled={completedDisabled(checks)}
          hint="Tick the four checks first"
          onChange={set("completed")}
          extra={done ? undefined : `${stepsDone(checks)} of 4 checks${completedDisabled(checks) ? ". Tick the four checks first" : ""}`}
        />
      </ul>
      <LastChange change={row.lastChange} />
    </li>
  );
}
