import type { ReactNode } from "react";
import { AlertCircle, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { driftMessage, type DriftTone } from "../../lib/allocation";

const TONE: Record<DriftTone, string> = {
  ok: "text-status-scheduled-fg",
  warn: "text-ticket-amber-fg",
  bad: "text-stage-lost-fg",
};

export function ToneMessage({ tone, children, className }: { tone: DriftTone; children: ReactNode; className?: string }) {
  const Icon = tone === "ok" ? Check : AlertCircle;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold", TONE[tone], className)} role="status">
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2.4} />
      {children}
    </span>
  );
}

/** "Fully allocated" / "£2,000 not allocated yet" / "£2,000 over". */
export function DriftMessage({ drift, short, className }: { drift: number; short?: boolean; className?: string }) {
  const { tone, text } = driftMessage(drift, short);
  return (
    <ToneMessage tone={tone} className={className}>
      {text}
    </ToneMessage>
  );
}
