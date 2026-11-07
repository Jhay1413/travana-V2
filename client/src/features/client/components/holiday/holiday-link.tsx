import { Clock } from "lucide-react";
import { OperatorTile } from "@/features/pipeline/shared/operator-tile";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { StatusPill } from "@/components/shared/status-pill";
import { cn } from "@/lib/utils";
import type { HolidayRowData } from "@/features/client/lib/live-deal-rows";
import type { RailPill } from "@/features/client/lib/holiday-rail";
import { TruncateTip } from "@/features/client/components/holiday/truncate-tip";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

/**
 * One row of the All holidays rail.
 *
 * Props:
 * - row: the row model from live-deal-rows (title, price, operator, destination, date line, copy / expired flags).
 * - current: highlights the row that is open on the page.
 * - nested: copy quote shown indented under its parent, with a connector line.
 * - pills: Pinned / Viewed / Booked pills (see railPills), shown after the meta line.
 * - expiryLabel: near-expiry text; renders a clock icon with this as its tooltip.
 * - refText: optional reference appended to the airport · dates line (bookings: HAYS ref).
 * - onSelect: called when the row is activated (click, Enter or Space).
 */
export interface HolidayLinkProps {
  row: HolidayRowData;
  current: boolean;
  nested?: boolean;
  pills: RailPill[];
  /** Tooltip text for the expiry clock icon (see railExpiryLabel); no icon when null/undefined. */
  expiryLabel?: string | null;
  refText?: string | null;
  onSelect: () => void;
}

const PILL = "px-1.5 py-0 text-[10px] xl:text-[10px]";

export function HolidayLink({ row, current, nested = false, pills, expiryLabel, refText, onSelect }: HolidayLinkProps) {
  const meta = [row.dateLine, refText].filter(Boolean).join(" · ") || null;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={current ? "page" : undefined}
      className={cn(
        "relative grid w-full grid-cols-[32px_minmax(0,1fr)] gap-x-2.5 gap-y-0.5 rounded-xl border px-2.5 py-2 text-left transition",
        current ? "border-qp-current-border bg-qp-current-tint" : "border-transparent hover:bg-muted/60",
        "max-[1180px]:min-w-[260px] max-[1180px]:border-social-border",
        nested &&
          "ml-[22px] w-[calc(100%-22px)] before:absolute before:-left-3 before:-top-2 before:bottom-1/2 before:w-2.5 before:rounded-bl-[10px] before:border-b-2 before:border-l-2 before:border-social-border max-[1180px]:ml-0 max-[1180px]:w-full max-[1180px]:before:hidden",
      )}
      data-testid={`holiday-link-${row.id}`}
    >
      <OperatorTile name={row.operatorName ?? row.title} logoUrl={row.operatorLogoUrl} size={32} />
      <div className="min-w-0">
        {/* Title -> Copy badge (copies only) -> sales price in grey. */}
        <div className="flex min-w-0 items-center gap-1.5">
          <TruncateTip
            text={row.title}
            className={cn("text-[13px] font-semibold", row.expired && "text-status-failed-fg")}
            testId="holiday-link-title"
          />
          {row.isCopy && (
            <StatusPill tone="info" className={cn(PILL, "shrink-0")}>
              Copy
            </StatusPill>
          )}
          {row.price > 0 && (
            <span className="ml-auto shrink-0 text-[13px] font-medium tabular-nums text-qp-muted" data-testid="holiday-link-price">
              {money.format(row.price)}
            </span>
          )}
        </div>
        {row.destinationName && <TruncateTip as="div" text={row.destinationName} className="text-xs text-qp-muted" />}
      </div>
      {(meta || pills.length > 0 || expiryLabel) && (
        // One line: departure airport · departure date → return date, truncated with the full text on hover.
        <div className="col-start-2 flex min-w-0 items-center gap-1.5 text-xs text-qp-muted">
          {meta && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="min-w-0 truncate tabular-nums" data-testid="holiday-link-meta">
                  {meta}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{meta}</TooltipContent>
            </Tooltip>
          )}
          {pills.map((pill) => (
            <StatusPill key={pill.label} tone={pill.tone} className={cn(PILL, "shrink-0")}>
              {pill.label}
            </StatusPill>
          ))}
          {expiryLabel && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  role="img"
                  aria-label={expiryLabel}
                  className="ml-auto shrink-0 text-stage-inplay-fg"
                  data-testid="holiday-link-expiry"
                >
                  <Clock className="size-3.5" aria-hidden />
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{expiryLabel}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
    </button>
  );
}
