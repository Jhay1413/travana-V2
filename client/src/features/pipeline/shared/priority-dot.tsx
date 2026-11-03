import { cn } from "@/lib/utils";
import { PRIORITY_META } from "@/features/pipeline/lib/pipeline-helpers";

/** Coloured dot plus label for a deal priority (read-only). */
export function PriorityDot({ priority, className }: { priority: "low" | "medium" | "high"; className?: string }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-foreground/80", className)}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}
