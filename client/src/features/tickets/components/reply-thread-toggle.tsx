import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * "Hide 3 replies" / "Show 3 replies" link under a comment that has replies.
 * Rendered inside the comment's column, directly beneath the bubble.
 */
export function ReplyThreadToggle({
  count,
  collapsed,
  onToggle,
  className,
  "data-testid": testId,
}: {
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  className?: string;
  "data-testid"?: string;
}) {
  const Icon = collapsed ? ChevronRight : ChevronDown;
  const label = `${collapsed ? "Show" : "Hide"} ${count} ${count === 1 ? "reply" : "replies"}`;
  return (
    <div className={cn("mt-1 flex justify-start", className)}>
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-black/50 transition hover:bg-black/[0.04] hover:text-black/80 dark:text-white/50 dark:hover:bg-white/[0.06] dark:hover:text-white/80"
        aria-expanded={!collapsed}
        data-testid={testId}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </button>
    </div>
  );
}
