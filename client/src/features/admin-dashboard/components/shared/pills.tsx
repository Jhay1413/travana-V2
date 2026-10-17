import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTone = "good" | "info" | "warn" | "bad" | "plain";

const TONES: Record<PillTone, string> = {
  good: "bg-status-scheduled-bg text-status-scheduled-fg",
  info: "bg-status-posted-bg text-status-posted-fg",
  warn: "bg-stage-inplay-bg text-stage-inplay-fg",
  bad: "bg-status-failed-bg text-status-failed-fg",
  plain: "bg-status-draft-bg text-status-draft-fg",
};

/** Status or result pill. Always carries a word, never colour alone. */
export function StatusPill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-3 py-[3px] text-[11px] font-semibold xl:text-[12px]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Muted marker for cards that show prototype sample content rather than live data. */
export function SamplePill() {
  return (
    <span
      className="inline-flex h-[22px] items-center rounded-full border border-dashed border-social-border bg-muted px-2.5 text-[11px] font-semibold text-social-muted"
      data-testid="pill-sample"
    >
      Sample
    </span>
  );
}
