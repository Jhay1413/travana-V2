import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section heading that sits on the page background (18px title, one-line status under it). */
export function SectionHead({ title, sub, right, id }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-[16px] font-semibold leading-snug xl:text-[18px]" id={id}>
          {title}
        </h2>
        {sub && (
          <p className="mt-0.5 text-[12px] text-social-muted xl:text-[13px]" role="status">
            {sub}
          </p>
        )}
      </div>
      {right}
    </div>
  );
}

/** Amber note ("started on ...") or a quiet tinted note. Not a live region: the section line above is the only one. */
export function ProfileNote({ tone = "warn", children, testId }: { tone?: "warn" | "tint"; children: ReactNode; testId?: string }) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-[10px] px-4 py-3 text-[13px] font-medium xl:text-[14px]",
        tone === "warn" ? "bg-stage-inplay-bg text-stage-inplay-fg" : "bg-status-draft-bg text-foreground",
      )}
    >
      {children}
    </div>
  );
}

const TILE_CELL =
  "flex flex-col gap-1 border-t border-social-border px-5 py-4 first:border-t-0 min-[721px]:border-l min-[721px]:border-t-0 min-[721px]:first:border-l-0";

/** A row of up to three figures in one white card (health tiles, earnings tiles). */
export function TileRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <section
      className="grid grid-cols-1 rounded-2xl border border-social-border bg-card py-1.5 min-[721px]:grid-cols-3"
      aria-label={label}
      data-testid={testId}
    >
      {children}
    </section>
  );
}

export function Tile({ label, value, unit, sub, children, testId }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; children?: ReactNode; testId?: string }) {
  return (
    <div className={TILE_CELL} data-testid={testId}>
      <span className="text-[12px] font-medium text-social-muted xl:text-[13px]">{label}</span>
      <span className="text-[22px] font-semibold leading-tight tabular-nums xl:text-[26px]">
        {value}
        {unit && <span className="text-[14px] font-medium text-social-muted xl:text-[15px]"> {unit}</span>}
      </span>
      {children}
      {sub && <span className="text-[12px] text-social-muted xl:text-[13px]">{sub}</span>}
    </div>
  );
}

/** Label and value on one row (Contact, Employment). Stacks on narrow screens. */
export function DlRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 border-t border-social-border py-2.5 text-[13px] first:border-t-0 first:pt-0 min-[721px]:grid-cols-[150px_minmax(0,1fr)] min-[721px]:gap-4 xl:text-[14px]">
      <dt className="text-[12px] text-social-muted xl:text-[13px]">{label}</dt>
      <dd className="m-0 break-words font-medium">{children}</dd>
    </div>
  );
}

export function SubHead({ children, first = false }: { children: ReactNode; first?: boolean }) {
  return (
    <h3 className={cn("text-[13px] font-semibold xl:text-[14px]", first ? "" : "mt-4 border-t border-social-border pt-4")}>{children}</h3>
  );
}

/** Table styling shared by the cards on every tab. */
export const TH = "whitespace-nowrap px-3 pb-2.5 text-[12px] font-semibold text-social-muted xl:text-[13px]";
export const TD = "border-b border-social-border px-3 py-2.5 text-[13px] xl:text-[14px]";

export function EmptyBlock({ title, children, testId }: { title: string; children?: ReactNode; testId?: string }) {
  return (
    <div className="py-6 text-center" data-testid={testId}>
      <p className="text-[14px] font-semibold">{title}</p>
      {children && <p className="mt-1 text-[13px] text-social-muted">{children}</p>}
    </div>
  );
}
