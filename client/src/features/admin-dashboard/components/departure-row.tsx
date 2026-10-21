import { dateTileParts, formatTravelDate, type DepartureRow as Row } from "@/features/departures";
import { cardPill, departureMeta } from "../lib/departure-pill";
import { StatusPill } from "./shared/pills";

/** One upcoming departure on the dashboard card: date tile, who and where, and a status pill. */
export function DepartureCardRow({ row }: { row: Row }) {
  const { day, num } = dateTileParts(row.travelDate);
  const pill = cardPill(row.checks);
  const meta = departureMeta(row.nights, row.operatorName);
  return (
    <div
      className="grid grid-cols-[56px_minmax(0,1fr)] items-center gap-3.5 border-t border-social-border py-3 first:border-t-0 first:pt-0.5"
      data-testid={`row-departure-${row.bookingId}`}
    >
      <span className="w-14 rounded-[10px] bg-status-draft-bg py-1 text-center text-[12px] leading-tight text-social-muted" aria-hidden>
        {day}
        <b className="block text-[17px] font-semibold text-social-navy">{num}</b>
      </span>
      <div className="min-w-0">
        <h3 className="text-[13px] font-semibold leading-snug xl:text-[14px]">
          {row.destination ? `${row.clientName}, ${row.destination}` : row.clientName}
        </h3>
        <div className="text-[12px] text-social-muted xl:text-[13px]">
          Departs {formatTravelDate(row.travelDate)}
          {meta && ` · ${meta}`}
        </div>
        <div className="mt-1.5">
          <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
        </div>
      </div>
    </div>
  );
}
