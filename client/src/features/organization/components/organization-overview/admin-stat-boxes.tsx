import { BadgePoundSterling } from "lucide-react";
import { StatCard } from "@/features/agent-overview/components/profit-stat-boxes";
import type { OrganizationOverviewKpis } from "@/features/organization/api/organization-overview.api";
import { currency, currencyFull } from "./helpers";

// Industry benchmark commission rate used to scale the Average Comm. Rate bar.
const BENCHMARK_COMMISSION_RATE = 12.5;

const ICON = BadgePoundSterling;
const ICON_CLASS = "text-emerald-500";
const VALUE_CLASS = "mt-2 text-xl font-semibold tracking-tight";
const SUB_CLASS = "mt-2 text-xs text-muted-foreground";
const GREY_CLASS = "whitespace-nowrap text-base font-semibold text-black/30 dark:text-white/30";

function bookingWord(count: number): string {
  return count === 1 ? "Booking" : "Bookings";
}

// The profit headline already includes upsell commission, so word it "incl." not "+".
function UpsellNote({ amount, testId }: { amount: number; testId: string }) {
  if (!(amount > 0)) return null;
  return (
    <span className="whitespace-nowrap" data-testid={testId}>
      {" "}(incl. {currency.format(amount)} upsells)
    </span>
  );
}

function Accent({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-[#fe9a00]">{children}</span>;
}

function ProgressBar({ pct, testId }: { pct: number; testId: string }) {
  return (
    <div
      className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
      data-testid={testId}
    >
      <div
        className="h-full rounded-full bg-[#fe9a00] transition-all duration-700 ease-out"
        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
      />
    </div>
  );
}

export function AdminStatBoxes({ kpis }: { kpis: OrganizationOverviewKpis }) {
  const target = kpis.monthTarget;
  const pct = target > 0 ? Math.round((kpis.monthCommission / target) * 100) : 0;
  const remaining = Math.max(0, target - kpis.monthCommission);
  const ppb = kpis.avgCommission;
  const bookingsToTarget = ppb > 0 ? Math.ceil(remaining / ppb) : 0;

  let runToTargetText: string;
  if (target <= 0) runToTargetText = "No target set";
  else if (remaining <= 0) runToTargetText = "Target reached";
  else if (ppb <= 0) runToTargetText = "No bookings yet to estimate";
  else runToTargetText = `${bookingsToTarget} ${bookingWord(bookingsToTarget)} at ${currency.format(ppb)}ppb`;

  const viewsPerQuote =
    kpis.quotesSentCount > 0 ? (kpis.quoteViewsCount / kpis.quotesSentCount).toFixed(1) : "0";

  // Bookings vs quotes created in the same month (not a cohort), so clamp at 100%.
  const closeRate =
    kpis.monthQuotesCount > 0
      ? Math.min(100, Math.round((kpis.monthBookingsCount / kpis.monthQuotesCount) * 100))
      : 0;
  const closeDelta = Math.round(kpis.weekCloseRate - kpis.prevWeekCloseRate);

  const commissionRate = kpis.monthSales > 0 ? (kpis.monthCommission / kpis.monthSales) * 100 : 0;
  const rateBarPct = Math.min(100, (commissionRate / BENCHMARK_COMMISSION_RATE) * 100);

  const projectedOpenSales = (kpis.openQuotesValue * closeRate) / 100;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Todays Profit" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-todays-profit">
          <p className={VALUE_CLASS} data-testid="stat-value-todays-profit">
            {currency.format(kpis.todayCommission)}
          </p>
          <p className={SUB_CLASS}>
            Total from <Accent>{kpis.todayBookingsCount}</Accent> {bookingWord(kpis.todayBookingsCount)} today
            <UpsellNote amount={kpis.todayUpsellCommission} testId="stat-upsell-amount-todays-profit" />
          </p>
        </StatCard>

        <StatCard label="This Weeks Profit" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-weeks-profit">
          <p className={VALUE_CLASS} data-testid="stat-value-weeks-profit">
            {currency.format(kpis.weekCommission)}
          </p>
          <p className={SUB_CLASS}>
            Total from <Accent>{kpis.weekBookingsCount}</Accent> {bookingWord(kpis.weekBookingsCount)} this week
            <UpsellNote amount={kpis.weekUpsellCommission} testId="stat-upsell-amount-weeks-profit" />
          </p>
        </StatCard>

        <StatCard label="This Month" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-this-month">
          <p className={VALUE_CLASS} data-testid="stat-value-this-month">
            {currency.format(kpis.monthCommission)}
          </p>
          <p className={SUB_CLASS}>
            <Accent>{kpis.monthBookingsCount}</Accent> {bookingWord(kpis.monthBookingsCount)} this Month
            <UpsellNote amount={kpis.monthUpsellCommission} testId="stat-upsell-amount-this-month" />
          </p>
        </StatCard>

        <StatCard label="Average PPB" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-avg-ppb">
          <p className={VALUE_CLASS} data-testid="stat-value-avg-ppb">
            {currencyFull.format(kpis.avgCommission)}
          </p>
          <p className={SUB_CLASS}>Average Profit Per Booking</p>
        </StatCard>

        <StatCard label="Target" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-target">
          <p className={VALUE_CLASS} data-testid="stat-value-target">
            {currency.format(target)}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar pct={pct} testId="progress-bar-target" />
            <span className="shrink-0 text-xs text-muted-foreground">{target > 0 ? `${pct}% of target` : "No target set"}</span>
          </div>
        </StatCard>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Quote Views" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-quote-views">
          <p
            className="mt-2 flex flex-wrap items-baseline gap-x-1 text-xl font-semibold tracking-tight"
            data-testid="stat-value-quote-views"
          >
            {kpis.quoteViewsCount}
            <span className={GREY_CLASS}>/ {kpis.quotesSentCount}</span>
          </p>
          <p className={SUB_CLASS}>
            <Accent>{viewsPerQuote}</Accent> views avg. per quote sent
          </p>
        </StatCard>

        <StatCard label="Close Rate" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-close-rate">
          <p className={VALUE_CLASS} data-testid="stat-value-close-rate">
            {closeRate}%
          </p>
          <p className={SUB_CLASS}>
            {closeDelta === 0 ? (
              "Weekly rate unchanged from last week"
            ) : (
              <>
                Weekly rate {closeDelta > 0 ? "up" : "down"} <Accent>{Math.abs(closeDelta)} pts</Accent> from last week
              </>
            )}
          </p>
        </StatCard>

        <StatCard label="Average Comm. Rate" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-avg-comm-rate">
          <p className={VALUE_CLASS} data-testid="stat-value-avg-comm-rate">
            {commissionRate.toFixed(2)}%
          </p>
          <div className="mt-3 flex items-center gap-2">
            <ProgressBar pct={rateBarPct} testId="progress-bar-avg-comm-rate" />
            <span className="shrink-0 text-xs text-muted-foreground">Avg. {BENCHMARK_COMMISSION_RATE}%</span>
          </div>
        </StatCard>

        <StatCard label="Open Deals" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-open-deals">
          <p
            className="mt-2 flex flex-wrap items-baseline gap-x-1 text-xl font-semibold tracking-tight"
            data-testid="stat-value-open-deals"
          >
            {kpis.openQuotesCount}
            <span className={GREY_CLASS}>/ {currency.format(kpis.openQuotesValue)}</span>
          </p>
          <p className={SUB_CLASS}>
            Projected open sales <Accent>{currencyFull.format(projectedOpenSales)}</Accent>
          </p>
        </StatCard>

        <StatCard label="Run To Target" icon={ICON} iconClass={ICON_CLASS} testId="stat-box-run-to-target">
          <p
            className="mt-2 flex flex-wrap items-baseline gap-x-1 text-lg font-semibold tracking-tight"
            data-testid="stat-value-run-to-target"
          >
            {currency.format(remaining)}
            <span className={GREY_CLASS}>/ {currency.format(target)}</span>
          </p>
          <p className="mt-2 text-xs font-semibold text-[#ff0015]">{runToTargetText}</p>
        </StatCard>
      </div>
    </div>
  );
}
