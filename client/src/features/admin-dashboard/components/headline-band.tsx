import { Link } from "wouter";
import type { OrganizationOverviewKpis } from "@/features/organization/api/organization-overview.api";
import { bookingWord, fromBookings, ppbFromKpis, targetSummary } from "../lib/headline-math";
import { gbp } from "../lib/money";
import { AdminProgress } from "./shared/bits";

const CELL =
  "flex flex-col gap-1.5 border-t border-white/15 px-5 py-5 first:border-t-0 min-[721px]:border-l min-[721px]:border-t-0 min-[721px]:first:border-l-0 xl:gap-1.5 xl:px-7 xl:py-6";
const LABEL = "text-[12px] font-medium text-white/65 xl:text-[13px]";
const VALUE = "text-[30px] font-semibold leading-[1.1] tabular-nums xl:text-[38px]";
const SUB = "text-[12px] text-white/80 xl:text-[13px]";
const BOLD = "font-semibold text-stage-inplay-dot";

function CountSub({ count, when }: { count: number; when: string }) {
  const s = fromBookings(count, when);
  return (
    <span className={SUB}>
      {s.lead}
      <b className={BOLD}>{s.count}</b>
      {s.tail}
    </span>
  );
}

export function HeadlineBand({ kpis }: { kpis: OrganizationOverviewKpis }) {
  const target = kpis.monthTarget;
  const summary = targetSummary({ target, commission: kpis.monthCommission, ppb: ppbFromKpis(kpis) });

  return (
    <section
      className="grid grid-cols-1 overflow-hidden rounded-[20px] bg-admin-hero text-white min-[721px]:grid-cols-[repeat(auto-fit,minmax(220px,1fr))]"
      aria-label="Headline numbers"
      data-testid="admin-headline-band"
    >
      <div className={CELL} data-testid="stat-box-todays-profit">
        <span className={LABEL}>Today's profit</span>
        <span className={VALUE} data-testid="stat-value-todays-profit">
          {gbp(kpis.todayCommission)}
        </span>
        <CountSub count={kpis.todayBookingsCount} when="today" />
      </div>

      <div className={CELL} data-testid="stat-box-weeks-profit">
        <span className={LABEL}>This week's profit</span>
        <span className={VALUE} data-testid="stat-value-weeks-profit">
          {gbp(kpis.weekCommission)}
        </span>
        <CountSub count={kpis.weekBookingsCount} when="this week" />
      </div>

      <div className={CELL} data-testid="stat-box-this-month">
        <span className={LABEL}>This month's profit</span>
        <span className={VALUE} data-testid="stat-value-this-month">
          {gbp(kpis.monthCommission)}
        </span>
        <span className={SUB}>
          <b className={BOLD}>{kpis.monthBookingsCount}</b> {bookingWord(kpis.monthBookingsCount)}
          {kpis.monthUpsellCommission > 0 ? (
            <>
              , including <span data-testid="stat-upsell-amount-this-month">{gbp(kpis.monthUpsellCommission)}</span> of upsells
            </>
          ) : (
            " this month"
          )}
        </span>
      </div>

      <div className={CELL} data-testid="stat-box-target">
        <span className={LABEL}>Monthly target</span>
        <span className={VALUE} data-testid="stat-value-target">
          {target > 0 ? gbp(target) : "–"}
        </span>
        <AdminProgress pct={summary.pct} tone="onDark" label="Progress to monthly target" testId="progress-bar-target" className="mt-1" />
        <span className={SUB} data-testid="stat-value-run-to-target">
          {summary.kind === "progress" && <b className={BOLD}>{summary.lead}</b>}
          {summary.text}
          {summary.kind === "none" && (
            <>
              {" · "}
              <Link href="/agency/targets" className="font-semibold text-stage-inplay-dot hover:underline" data-testid="link-admin-set-target">
                Set a target
              </Link>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
