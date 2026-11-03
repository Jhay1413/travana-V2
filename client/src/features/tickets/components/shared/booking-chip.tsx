import { Link2 } from "lucide-react";
import { OperatorTile } from "@/features/pipeline";
import { cn } from "@/lib/utils";
import { holidaySubLine } from "../../lib/ticket-display";
import type { Ticket } from "../../types";

/** Operator tile, holiday title and travel line for a ticket, or a dashed "none" chip. */
export function BookingChip({
  ticket,
  size = 34,
  card = false,
  className,
}: {
  ticket: Pick<Ticket, "transactionId" | "holiday">;
  size?: number;
  /** Boxed variant used on board cards. */
  card?: boolean;
  className?: string;
}) {
  const { holiday, transactionId } = ticket;
  if (!holiday && !transactionId) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap border-[1.5px] border-dashed border-ticket-dashed text-[12px] text-social-muted",
          card ? "w-full rounded-[10px] px-2.5 py-[9px]" : "rounded-full px-2.5 py-[3px]",
          className,
        )}
        data-testid="ticket-no-holiday"
      >
        <Link2 className="h-3 w-3" strokeWidth={2} />
        No booking linked
      </span>
    );
  }
  const title = holiday?.title || (holiday?.kind ? `${holiday.kind[0].toUpperCase()}${holiday.kind.slice(1)}` : "Holiday linked");
  const sub = holiday ? holidaySubLine(holiday) : null;
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", card && "rounded-[10px] bg-pipeline-money-bg px-2.5 py-2", className)} data-testid="ticket-holiday-chip">
      <OperatorTile name={holiday?.operatorName ?? null} logoUrl={holiday?.operatorLogoUrl ?? null} size={size} />
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-semibold xl:text-[13px]">{title}</div>
        {sub && <div className="truncate text-[12px] text-social-muted">{sub}</div>}
      </div>
    </div>
  );
}
