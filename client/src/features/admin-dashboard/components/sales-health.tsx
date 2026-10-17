import type { ReactNode } from "react";
import type { OrganizationOverviewKpis } from "@/features/organization/api/organization-overview.api";
import {
  BENCHMARK_COMMISSION_RATE,
  closeDeltaText,
  closeRatePct,
  commissionRate,
  projectedSales,
  rateBarPct,
  viewsSub,
} from "../lib/health-copy";
import { ppbFromKpis } from "../lib/headline-math";
import { gbp, gbp2 } from "../lib/money";
import { AdminProgress } from "./shared/bits";

const CELL =
  "flex flex-col gap-1 border-t border-social-border px-5 py-4 first:border-t-0 min-[721px]:border-l min-[721px]:border-t-0 min-[721px]:first:border-l-0";
const LABEL = "text-[12px] font-medium text-social-muted xl:text-[13px]";
const VALUE = "text-[22px] font-semibold leading-tight tabular-nums xl:text-[26px]";
const SUB = "text-[12px] text-social-muted xl:text-[13px]";

function Unit({ children }: { children: ReactNode }) {
  return <span className="text-[14px] font-medium text-social-muted xl:text-[15px]"> {children}</span>;
}

export function SalesHealth({ kpis }: { kpis: OrganizationOverviewKpis }) {
  const closeRate = closeRatePct(kpis.monthBookingsCount, kpis.monthQuotesCount);
  const rate = commissionRate(kpis.monthCommission, kpis.monthSales);

  return (
    <section
      className="grid grid-cols-1 rounded-2xl border border-social-border bg-card py-1.5 min-[721px]:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]"
      aria-label="Sales health"
      data-testid="admin-sales-health"
    >
      <div className={CELL} data-testid="stat-box-avg-ppb">
        <span className={LABEL}>Average profit per booking</span>
        <span className={VALUE} data-testid="stat-value-avg-ppb">
          {gbp2(ppbFromKpis(kpis))}
        </span>
        <span className={SUB}>Per booking made</span>
      </div>

      <div className={CELL} data-testid="stat-box-quote-views">
        <span className={LABEL}>Quote views</span>
        <span className={VALUE} data-testid="stat-value-quote-views">
          {kpis.quoteViewsCount}
          <Unit>views</Unit>
        </span>
        <span className={SUB}>{viewsSub(kpis.quoteViewsCount, kpis.quotesSentCount)}</span>
      </div>

      <div className={CELL} data-testid="stat-box-close-rate">
        <span className={LABEL}>Close rate</span>
        <span className={VALUE} data-testid="stat-value-close-rate">
          {closeRate}%
        </span>
        <span className={SUB}>{closeDeltaText(kpis.weekCloseRate, kpis.prevWeekCloseRate)}</span>
      </div>

      <div className={CELL} data-testid="stat-box-avg-comm-rate">
        <span className={LABEL}>Average commission rate</span>
        <span className={VALUE} data-testid="stat-value-avg-comm-rate">
          {rate.toFixed(2)}%
        </span>
        <AdminProgress
          pct={rateBarPct(rate)}
          tone="navy"
          label={`Average commission rate against ${BENCHMARK_COMMISSION_RATE} percent`}
          testId="progress-bar-avg-comm-rate"
          ariaNow={Math.min(Number(rate.toFixed(2)), BENCHMARK_COMMISSION_RATE)}
          ariaMax={BENCHMARK_COMMISSION_RATE}
          className="mt-1"
        />
        <span className={SUB}>Avg. {BENCHMARK_COMMISSION_RATE}%</span>
      </div>

      <div className={CELL} data-testid="stat-box-open-deals">
        <span className={LABEL}>Open deals</span>
        <span className={VALUE} data-testid="stat-value-open-deals">
          {kpis.openQuotesCount}
          <Unit>worth {gbp(kpis.openQuotesValue)}</Unit>
        </span>
        <span className={SUB}>Projected sales {gbp2(projectedSales(kpis.openQuotesValue, closeRate))}</span>
      </div>
    </section>
  );
}
