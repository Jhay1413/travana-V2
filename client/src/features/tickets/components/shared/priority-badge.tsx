import { AlertTriangle, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { priorityMeta } from "../../lib/ticket-display";

/** Urgent is a red pill, High an amber pill, Medium / Low a quiet dot plus label. */
export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  const meta = priorityMeta(priority);
  if (meta.tone === "urgent") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-status-failed-bg px-2.5 py-[3px] text-[12px] font-semibold text-status-failed-fg", className)}>
        <AlertTriangle className="h-3 w-3" strokeWidth={2.4} />
        Urgent
      </span>
    );
  }
  if (meta.tone === "high") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ticket-amber-bg px-2.5 py-[3px] text-[12px] font-semibold text-ticket-amber-fg", className)}>
        <ArrowUp className="h-3 w-3" strokeWidth={2.6} />
        High
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-foreground/80", className)}>
      <span className={cn("h-2 w-2 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
