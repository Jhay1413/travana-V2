import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RowStatusKind } from "../lib/row-status";

const KIND_CLASSES: Record<RowStatusKind, string> = {
  needs_reply: "bg-ticket-amber-bg text-ticket-amber-fg",
  overdue: "bg-status-failed-bg text-status-failed-fg",
  waiting: "pl-0 font-medium text-social-muted",
  snoozed: "pl-0 font-medium text-social-muted",
  done: "bg-avatar-green-bg text-avatar-green-fg",
};

const CLOCK_KINDS: ReadonlySet<RowStatusKind> = new Set<RowStatusKind>(["waiting", "snoozed"]);

export interface StatusPillProps {
  kind: RowStatusKind;
  label: string;
}

export function StatusPill({ kind, label }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        KIND_CLASSES[kind],
      )}
      data-kind={kind}
    >
      {CLOCK_KINDS.has(kind) && <Clock className="mr-1 h-3 w-3" aria-hidden="true" />}
      {label}
    </span>
  );
}
