import { cn } from "@/lib/utils";
import { STATUS_LABEL, type TargetStatus } from "../../lib/status";

const PILL: Record<TargetStatus, string> = {
  ahead: "bg-stage-enquiry-bg text-stage-enquiry-fg",
  on_track: "bg-stage-quoted-bg text-stage-quoted-fg",
  behind: "bg-stage-lost-bg text-stage-lost-fg",
};

export const STATUS_DOT: Record<TargetStatus, string> = {
  ahead: "bg-stage-enquiry-dot",
  on_track: "bg-stage-quoted-dot",
  behind: "bg-stage-lost-dot",
};

export function StatusPill({ status, className }: { status: TargetStatus; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold", PILL[status], className)}
      data-testid={`status-${status}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
