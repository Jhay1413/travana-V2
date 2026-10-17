import { cn } from "@/lib/utils";
import type { RowStatusKind } from "../lib/row-status";

const KIND_CLASSES: Record<RowStatusKind, string> = {
  needs_reply: "bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/15 dark:text-amber-300",
  overdue: "bg-[#FEE2E2] text-[#B91C1C] dark:bg-red-500/15 dark:text-red-300",
  waiting: "bg-[#EEF2F7] text-[#475569] dark:bg-white/10 dark:text-slate-300",
  snoozed: "bg-[#EEF2F7] text-[#475569] dark:bg-white/10 dark:text-slate-300",
  done: "bg-[#D1FAE5] text-[#047857] dark:bg-emerald-500/15 dark:text-emerald-300",
};

export interface StatusPillProps {
  kind: RowStatusKind;
  label: string;
}

export function StatusPill({ kind, label }: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[12px] font-semibold",
        KIND_CLASSES[kind],
      )}
      data-kind={kind}
    >
      {label}
    </span>
  );
}
