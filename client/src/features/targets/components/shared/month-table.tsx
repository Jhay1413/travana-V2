import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { MONTH_LABELS } from "../../lib/months";

const GRID = "grid grid-cols-[140px_repeat(12,minmax(0,1fr))_104px] items-center gap-x-1";

/** Keeps the twelve-month tables readable on narrow screens. */
export function WideScroll({ children, minWidth = 980 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth }}>{children}</div>
    </div>
  );
}

export function MonthHead({ first }: { first: string }) {
  return (
    <div className={cn(GRID, "rounded-[10px] bg-muted/60 px-3 py-2.5 text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted")}>
      <div>{first}</div>
      {MONTH_LABELS.map((m) => (
        <div key={m} className="px-1 text-right">
          {m}
        </div>
      ))}
      <div className="px-1 text-right">Year</div>
    </div>
  );
}

interface MonthRowProps {
  label: ReactNode;
  cells: ReactNode[];
  total: ReactNode;
  bold?: boolean;
  tinted?: boolean;
  first?: boolean;
  testId?: string;
}

export function MonthRow({ label, cells, total, bold, tinted, first, testId }: MonthRowProps) {
  return (
    <div
      data-testid={testId}
      className={cn(GRID, "px-3 py-2.5 text-[13px]", !first && "border-t border-social-border", tinted && "bg-muted/40")}
    >
      <div className={cn("flex items-center gap-2", bold ? "font-semibold" : "font-medium")}>{label}</div>
      {cells.map((c, i) => (
        <div key={i} className={cn("px-1 text-right tabular-nums", bold && "font-semibold")}>
          {c ?? <span className="text-social-muted">&ndash;</span>}
        </div>
      ))}
      <div className="px-1 text-right font-semibold tabular-nums">{total}</div>
    </div>
  );
}
