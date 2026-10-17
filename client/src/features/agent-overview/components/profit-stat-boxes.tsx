import { Link } from "wouter";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";
import { bookingWord, computeTargetStats, upsellWord } from "../lib/tile-math";
import { StatTile } from "./home/stat-tile";

// Icons follow Icons.txt at the repo root (Home section).
export function StatCard({
  label,
  icon: Icon,
  iconClass,
  children,
  testId,
}: {
  label: string;
  icon: LucideIcon;
  iconClass: string;
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="h-full"
    >
      <Card
        className="h-full rounded-lg border border-black/10 bg-white p-4 shadow-none dark:border-white/10 dark:bg-white/[0.04]"
        data-testid={testId}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">{label}</p>
          <Icon className={cn("h-5 w-5 shrink-0", iconClass)} aria-hidden />
        </div>
        {children}
      </Card>
    </motion.div>
  );
}

export interface ProfitStats {
  todayProfit: number;
  weekProfit: number;
  monthProfit: number;
  salesTarget: number;
  agentSalesTarget: number;
  avgBookingValue: number;
  totalOpenQuotesValue: number;
  bookingsCount: number;
  quotesCount: number;
  todayBookingsCount?: number;
  weekBookingsCount?: number;
  monthBookingsCount?: number;
  monthAvgBookingValue?: number;
  todayUpsellsCount?: number;
  weekUpsellsCount?: number;
  monthUpsellsCount?: number;
  todayUpsellAmount?: number;
  weekUpsellAmount?: number;
  monthUpsellAmount?: number;
}

// The profit headline ALREADY includes upsell commission, so the amount is worded
// "incl. £X" (a part of the total), never "+£X". A "+" would read as extra on top and
// lead agents to double-count it when checking progress against target.
function BookingCountSubtext({
  count,
  upsellCount,
  upsellAmount,
  period,
  testId,
}: {
  count: number;
  upsellCount?: number;
  upsellAmount?: number;
  period: string;
  testId: string;
}) {
  return (
    <span>
      <span className="font-semibold text-social-orange-text">{count}</span> {bookingWord(count)}
      {!!upsellCount && (
        <>
          {" · "}
          <span className="font-semibold text-social-orange-text">{upsellCount}</span> {upsellWord(upsellCount)}
          {!!upsellAmount && (
            <span data-testid={testId}> (incl. {currency.format(upsellAmount)})</span>
          )}
        </>
      )}{" "}
      {period}
    </span>
  );
}

export function ProfitStatBoxes({
  profitStats,
  isAgentView,
  targetHref,
  className,
}: {
  profitStats: ProfitStats;
  isAgentView: boolean;
  /** Where the current role can set its target; shown as "Set a target" when none is set. */
  targetHref?: string | null;
  /** Grid column classes; defaults to 2 columns, 5 from lg. */
  className?: string;
}) {
  const target = isAgentView ? profitStats.agentSalesTarget : profitStats.salesTarget;
  const stats = computeTargetStats({
    monthProfit: profitStats.monthProfit,
    target,
    monthAvgBookingValue: profitStats.monthAvgBookingValue,
    avgBookingValue: profitStats.avgBookingValue,
  });
  const monthBookingsCount = profitStats.monthBookingsCount ?? profitStats.bookingsCount;

  return (
    <div className={cn("grid gap-3", className ?? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-5")}>
      <StatTile
        label="Todays Profit"
        glyph="pound"
        tone="green"
        value={currency.format(profitStats.todayProfit)}
        valueTestId="stat-value-todays-profit"
        testId="stat-box-todays-profit"
      >
        {profitStats.todayBookingsCount !== undefined ? (
          <BookingCountSubtext
            count={profitStats.todayBookingsCount}
            upsellCount={profitStats.todayUpsellsCount}
            upsellAmount={profitStats.todayUpsellAmount}
            period="today"
            testId="stat-upsell-amount-todays-profit"
          />
        ) : (
          "Total from today's bookings"
        )}
      </StatTile>

      <StatTile
        label="This Weeks Profit"
        glyph="pound"
        tone="blue"
        value={currency.format(profitStats.weekProfit)}
        valueTestId="stat-value-weeks-profit"
        testId="stat-box-weeks-profit"
      >
        {profitStats.weekBookingsCount !== undefined ? (
          <BookingCountSubtext
            count={profitStats.weekBookingsCount}
            upsellCount={profitStats.weekUpsellsCount}
            upsellAmount={profitStats.weekUpsellAmount}
            period="this week"
            testId="stat-upsell-amount-weeks-profit"
          />
        ) : (
          "Total from this week's bookings"
        )}
      </StatTile>

      <StatTile
        label="This Month"
        glyph="calendar"
        tone="green"
        value={currency.format(profitStats.monthProfit)}
        valueTestId="stat-value-this-month"
        testId="stat-box-this-month"
      >
        <BookingCountSubtext
          count={monthBookingsCount}
          upsellCount={profitStats.monthUpsellsCount}
          upsellAmount={profitStats.monthUpsellAmount}
          period="this Month"
          testId="stat-upsell-amount-this-month"
        />
      </StatTile>

      <StatTile
        label="Target"
        glyph="target"
        tone="orange"
        value={currency.format(target)}
        valueTestId="stat-value-target"
        barPct={stats.hasTarget ? stats.barPct : 0}
        barTestId="progress-bar-target"
        testId="stat-box-target"
      >
        {stats.hasTarget ? (
          <span>{stats.reached ? "Target reached" : `${stats.toTargetPct}% to target`}</span>
        ) : (
          <>
            <span>No target set</span>
            {targetHref && (
              <>
                {" · "}
                <Link
                  href={targetHref}
                  className="font-semibold text-social-orange-text hover:underline"
                  data-testid="link-set-target"
                >
                  Set a target
                </Link>
              </>
            )}
          </>
        )}
      </StatTile>

      <StatTile
        label="Run To Target"
        glyph="pound"
        tone="red"
        value={currency.format(stats.remaining)}
        suffix={`/ ${currency.format(target)}`}
        valueTestId="stat-value-run-to-target"
        testId="stat-box-run-to-target"
      >
        <span className="font-semibold text-red-600">{stats.runToTargetText}</span>
      </StatTile>
    </div>
  );
}
