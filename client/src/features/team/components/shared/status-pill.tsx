import { cn } from "@/lib/utils";
import { STATUS_WORD } from "../../lib/member-status";

export type PillStatus = "active" | "suspended" | "invited";

const TONE: Record<PillStatus, { chip: string; dot: string }> = {
  active: { chip: "bg-status-scheduled-bg text-status-scheduled-fg", dot: "bg-status-scheduled-fg" },
  invited: { chip: "bg-status-posted-bg text-status-posted-fg", dot: "bg-status-posted-fg" },
  suspended: { chip: "bg-ticket-amber-bg text-ticket-amber-fg", dot: "bg-ticket-amber-fg" },
};

/** Status always carries a word as well as a dot, never colour alone. */
export function StatusPill({ status, detail, className }: { status: PillStatus; detail?: string; className?: string }) {
  const tone = TONE[status];
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold", tone.chip, className)}
      data-testid={`status-${status}`}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} aria-hidden />
      {STATUS_WORD[status]}
      {detail ? <span className="font-medium opacity-80">· {detail}</span> : null}
    </span>
  );
}
