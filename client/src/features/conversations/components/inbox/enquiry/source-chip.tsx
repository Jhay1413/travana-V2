import { Check, Info, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChipKind = "chat" | "check" | "set" | "checked";

const GREEN = "bg-[#D1FAE5] text-[#047857] dark:bg-emerald-950/50 dark:text-emerald-300";

const CHIP: Record<ChipKind, { label: string; className: string; Icon: typeof Check }> = {
  chat: { label: "From chat", className: "bg-[#EDE9FE] text-[#6D28D9] dark:bg-violet-950/50 dark:text-violet-300", Icon: Sparkles },
  check: { label: "Please check", className: "bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/50 dark:text-amber-300", Icon: Info },
  set: { label: "Set for you", className: GREEN, Icon: Check },
  checked: { label: "You checked", className: GREEN, Icon: Check },
};

/** Small pill showing where a field's value came from. */
export function SourceChip({ kind }: { kind: ChipKind }) {
  const { label, className, Icon } = CHIP[kind];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-px text-[10.5px] font-semibold", className)}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}
