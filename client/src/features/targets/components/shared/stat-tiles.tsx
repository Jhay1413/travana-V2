import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TARGETS_CARD } from "./targets-styles";

/** One headline number with a small caption, as on the Shops, Agents and Homeworkers tabs. */
export function StatTile({ label, value, sub, children, testId }: { label: string; value: ReactNode; sub?: ReactNode; children?: ReactNode; testId?: string }) {
  return (
    <div className={cn(TARGETS_CARD, "min-w-0 flex-1 basis-[200px] p-4 xl:p-5")} data-testid={testId}>
      <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted xl:text-[12px]">{label}</div>
      <div className="mt-1.5 text-[26px] font-semibold leading-tight xl:text-[30px]">{value}</div>
      {sub && <div className="mt-0.5 text-[12px] text-social-muted">{sub}</div>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export interface BannerColumn {
  label: string;
  value: ReactNode;
  sub: ReactNode;
  testId?: string;
}

/** The four-column banner that opens the Business and My targets pages. */
export function HeroBanner({ columns }: { columns: BannerColumn[] }) {
  return (
    <div className={cn(TARGETS_CARD, "grid grid-cols-2 lg:grid-cols-4")}>
      {columns.map((c, i) => (
        <div key={c.label} className={cn("min-w-0 p-4 xl:p-5", i > 0 && "lg:border-l lg:border-social-border", i % 2 === 1 && "border-l border-social-border lg:border-l")}>
          <div className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted xl:text-[12px]">{c.label}</div>
          <div className="mt-1.5 text-[24px] font-semibold leading-tight xl:text-[30px]" data-testid={c.testId}>
            {c.value}
          </div>
          <div className="mt-0.5 text-[12px] text-social-muted">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}
