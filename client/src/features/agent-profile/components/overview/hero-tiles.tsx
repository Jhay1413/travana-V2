import { Link } from "wouter";
import { AdminProgress, gbp } from "@/features/admin-dashboard";
import { bookingsSub, targetSummary } from "../../lib/hero-copy";
import { gbp2 } from "../../lib/money";
import type { AgentProfilePerformance } from "../../types";

const CELL =
  "flex flex-col gap-1.5 border-t border-white/15 px-5 py-5 first:border-t-0 min-[721px]:border-l min-[721px]:border-t-0 min-[721px]:first:border-l-0 xl:px-7 xl:py-6";
const LABEL = "text-[12px] font-medium text-white/65 xl:text-[13px]";
const VALUE = "text-[30px] font-semibold leading-[1.1] tabular-nums xl:text-[38px]";
const SUB = "text-[12px] text-white/80 xl:text-[13px]";

function upperFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Navy band: profit, bookings, average profit per booking and the period target. */
export function HeroTiles({
  perf,
  target,
  targetLoading,
  say,
  targetLink,
}: {
  perf: AgentProfilePerformance;
  target: number;
  targetLoading: boolean;
  say: string;
  targetLink: string;
}) {
  const ppb = perf.bookings > 0 ? perf.ppb : null;
  const summary = targetSummary(perf.profit, target);
  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-[20px] bg-admin-hero text-white min-[721px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
      aria-label="Headline numbers"
      data-testid="agent-profile-hero"
    >
      <div className={CELL} data-testid="hero-profit">
        <span className={LABEL}>Profit</span>
        <span className={VALUE}>{gbp(perf.profit)}</span>
        <span className={SUB}>{upperFirst(say)}</span>
      </div>
      <div className={CELL} data-testid="hero-bookings">
        <span className={LABEL}>Bookings</span>
        <span className={VALUE}>{perf.bookings}</span>
        <span className={SUB}>{bookingsSub(perf.bookings, perf.quotesSent)}</span>
      </div>
      <div className={CELL} data-testid="hero-ppb">
        <span className={LABEL}>Average profit per booking</span>
        <span className={VALUE}>{ppb === null ? "—" : gbp2(ppb)}</span>
        <span className={SUB}>{ppb === null ? "No bookings in this period" : "Per booking made"}</span>
      </div>
      <div className={CELL} data-testid="hero-target">
        <span className={LABEL}>Target for this period</span>
        <span className={VALUE}>{targetLoading ? "…" : summary.value}</span>
        {!targetLoading && summary.kind === "progress" && (
          <AdminProgress pct={summary.pct} tone="onDark" label="Progress to target for this period" testId="progress-period-target" className="mt-1" />
        )}
        <span className={SUB}>
          {targetLoading ? "Loading the target" : summary.text}
          {!targetLoading && summary.kind === "none" && (
            <>
              {" · "}
              <Link href={targetLink} className="font-semibold text-stage-inplay-dot hover:underline" data-testid="link-hero-set-target">
                Set target
              </Link>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
