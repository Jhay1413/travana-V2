import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Rounded square tile with initials (sources, suppliers). */
export function InitialsTile({ text }: { text: string }) {
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-status-draft-bg text-[12px] font-semibold tracking-wide text-social-navy"
      aria-hidden
    >
      {text}
    </span>
  );
}

const BAR_FILL = {
  navy: "bg-social-navy",
  orange: "bg-social-orange",
  onDark: "bg-social-orange",
} as const;

/** Simple progress bar. Unlike the Targets bar it has no pace marker. */
export function AdminProgress({
  pct,
  tone = "navy",
  label,
  testId,
  className,
  ariaNow,
  ariaMax = 100,
}: {
  pct: number;
  tone?: keyof typeof BAR_FILL;
  label: string;
  testId?: string;
  className?: string;
  ariaNow?: number;
  ariaMax?: number;
}) {
  const width = Math.min(100, Math.max(0, pct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={ariaMax}
      aria-valuenow={ariaNow ?? Math.round(width)}
      data-testid={testId}
      className={cn("h-1.5 overflow-hidden rounded-full", tone === "onDark" ? "bg-white/20" : "bg-border", className)}
    >
      <div className={cn("h-full rounded-full transition-all duration-700 ease-out", BAR_FILL[tone])} style={{ width: `${width}%` }} />
    </div>
  );
}

/** Thicker navy track used by the sources and supplier lists. */
export function RankBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 overflow-hidden rounded bg-status-draft-bg" aria-hidden>
      <div className="h-full rounded bg-social-navy" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

/** Card header: title (with optional pill), a one-line subtitle and a right-hand control. */
export function CardHead({
  title,
  sub,
  pill,
  right,
  id,
}: {
  title: ReactNode;
  sub?: ReactNode;
  pill?: ReactNode;
  right?: ReactNode;
  id?: string;
}) {
  return (
    <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-semibold xl:text-base" id={id}>
            {title}
          </h2>
          {pill}
        </div>
        {sub && <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Text-sized secondary button used inside cards. */
export const CARD_BUTTON =
  "inline-flex h-9 items-center justify-center rounded-[10px] border border-social-border bg-card px-4 text-[12px] font-semibold text-foreground transition hover:bg-muted xl:text-[13px]";

/** Muted message inside a card (empty and error states). */
export function CardNote({ children, testId, tone = "muted" }: { children: ReactNode; testId?: string; tone?: "muted" | "error" }) {
  return (
    <div
      className={cn("py-6 text-center text-[13px]", tone === "error" ? "text-status-failed-fg" : "text-social-muted")}
      data-testid={testId}
    >
      {children}
    </div>
  );
}
