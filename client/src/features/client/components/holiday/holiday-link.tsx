import { OperatorTile } from "@/features/pipeline/shared/operator-tile";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { HolidayRowData } from "@/features/client/lib/live-deal-rows";
import type { RailPill } from "@/features/client/lib/holiday-rail";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/**
 * One row of the All holidays rail.
 *
 * Props:
 * - row: the row model from live-deal-rows (title, price, operator, destination, date line, copy / expired flags).
 * - current: highlights the row that is open on the page.
 * - nested: copy quote shown indented under its parent, with a connector line.
 * - pills: Copy / Pinned / Viewed / Expires pills (see railPills), shown after the meta line.
 * - refText: optional reference shown in the meta line instead of the date line (bookings: HAYS ref).
 * - onSelect: called when the row is activated (click, Enter or Space).
 */
export interface HolidayLinkProps {
  row: HolidayRowData;
  current: boolean;
  nested?: boolean;
  pills: RailPill[];
  refText?: string | null;
  onSelect: () => void;
}

const PILL = "px-2 py-0 text-[11px] xl:text-[11px]";

export function HolidayLink({ row, current, nested = false, pills, refText, onSelect }: HolidayLinkProps) {
  const meta = refText || row.dateLine;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative grid w-full grid-cols-[40px_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-[14px] border p-3 text-left transition",
        current ? "border-qp-current-border bg-qp-current-tint" : "border-transparent hover:bg-muted/60",
        "max-[1180px]:min-w-[260px] max-[1180px]:border-social-border",
        nested &&
          "ml-[22px] w-[calc(100%-22px)] before:absolute before:-left-3 before:-top-2 before:bottom-1/2 before:w-2.5 before:rounded-bl-[10px] before:border-b-2 before:border-l-2 before:border-social-border max-[1180px]:ml-0 max-[1180px]:w-full max-[1180px]:before:hidden",
      )}
      data-testid={`holiday-link-${row.id}`}
    >
      <OperatorTile name={row.operatorName ?? row.title} logoUrl={row.operatorLogoUrl} size={40} />
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <b className={cn("min-w-0 truncate text-sm font-semibold", row.expired && "text-status-failed-fg")}>{row.title}</b>
          {row.price > 0 && <span className="shrink-0 font-semibold tabular-nums">{money.format(row.price)}</span>}
        </div>
        {row.destinationName && <div className="truncate text-[13px] text-qp-muted">{row.destinationName}</div>}
      </div>
      {(meta || pills.length > 0) && (
        <div className="col-start-2 flex flex-wrap items-center gap-1.5 text-xs text-qp-muted">
          {meta && <span className="tabular-nums">{meta}</span>}
          {pills.map((pill) => (
            <StatusPill key={pill.label} tone={pill.tone} className={PILL}>
              {pill.label}
            </StatusPill>
          ))}
        </div>
      )}
    </button>
  );
}
