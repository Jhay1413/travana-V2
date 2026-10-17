import { AlertCircle, CalendarDays, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { deriveDuePill, type DuePillModel } from "../../lib/ticket-due";
import type { Ticket } from "../../types";

const PILL = "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold";

/** Reply-due pill: red when overdue, amber when due within two hours, plain text otherwise. */
export function DuePill({ ticket, now, pill, className }: { ticket: Pick<Ticket, "dueDate" | "status">; now: Date; /** Already-derived pill; derived here when absent. */ pill?: DuePillModel; className?: string }) {
  const { tone, label } = pill ?? deriveDuePill(ticket, now);
  if (tone === "over") {
    return (
      <span className={cn(PILL, "bg-status-failed-bg text-status-failed-fg", className)} data-testid="ticket-due-over">
        <AlertCircle className="h-3 w-3" strokeWidth={2.4} />
        {label}
      </span>
    );
  }
  if (tone === "soon") {
    return (
      <span className={cn(PILL, "bg-ticket-amber-bg text-ticket-amber-fg", className)} data-testid="ticket-due-soon">
        <Clock className="h-3 w-3" strokeWidth={2.4} />
        {label}
      </span>
    );
  }
  if (tone === "ok") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] text-foreground/80", className)}>
        <CalendarDays className="h-[13px] w-[13px] text-social-muted" />
        {label}
      </span>
    );
  }
  return <span className={cn("whitespace-nowrap text-[12px] text-social-muted", className)}>{label}</span>;
}
