import { cn } from "@/lib/utils";
import { statusMeta } from "../../lib/ticket-display";

export function StatusDot({ status, className }: { status: string; className?: string }) {
  return <span className={cn("h-[7px] w-[7px] shrink-0 rounded-full", statusMeta(status).dotClass, className)} />;
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const meta = statusMeta(status);
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-[3px] text-[12px] font-semibold", meta.chipClass, className)}
      data-testid={`ticket-status-badge-${meta.slug}`}
    >
      <StatusDot status={status} />
      {meta.label}
    </span>
  );
}
