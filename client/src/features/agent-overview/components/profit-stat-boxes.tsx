import { motion } from "framer-motion";
import { BadgePoundSterling, CalendarCheck, Target } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";

// Icons follow Icons.txt at the repo root (Home section).
function StatCard({
  label,
  icon: Icon,
  iconClass,
  children,
  testId,
}: {
  label: string;
  icon: React.ElementType;
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
}

export function ProfitStatBoxes({
  profitStats,
  isAgentView,
}: {
  profitStats: ProfitStats;
  isAgentView: boolean;
}) {
  const target = isAgentView ? profitStats.agentSalesTarget : profitStats.salesTarget;
  const pct = target > 0 ? Math.round((profitStats.monthProfit / target) * 100) : 0;
  const toTargetPct = Math.max(0, 100 - pct);
  const remaining = Math.max(0, target - profitStats.monthProfit);
  const ppb = Math.round(profitStats.avgBookingValue);
  const bookingsToTarget = ppb > 0 ? Math.ceil(remaining / ppb) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <StatCard label="Todays Profit" icon={BadgePoundSterling} iconClass="text-emerald-500" testId="stat-box-todays-profit">
        <p className="mt-2 text-xl font-semibold tracking-tight" data-testid="stat-value-todays-profit">
          {currency.format(profitStats.todayProfit)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Total from today's bookings</p>
      </StatCard>

      <StatCard label="This Weeks Profit" icon={BadgePoundSterling} iconClass="text-blue-500" testId="stat-box-weeks-profit">
        <p className="mt-2 text-xl font-semibold tracking-tight" data-testid="stat-value-weeks-profit">
          {currency.format(profitStats.weekProfit)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Total from this week's bookings</p>
      </StatCard>

      <StatCard label="This Month" icon={CalendarCheck} iconClass="text-emerald-500" testId="stat-box-this-month">
        <p className="mt-2 text-xl font-semibold tracking-tight" data-testid="stat-value-this-month">
          {currency.format(profitStats.monthProfit)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          <span className="font-semibold text-[#fe9a00]">{profitStats.bookingsCount}</span>{" "}
          Bookings this Month
        </p>
      </StatCard>

      <StatCard label="Target" icon={Target} iconClass="text-amber-500" testId="stat-box-target">
        <p className="mt-2 text-xl font-semibold tracking-tight" data-testid="stat-value-target">
          {currency.format(target)}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <div
            className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            data-testid="progress-bar-target"
          >
            <div
              className="h-full rounded-full bg-[#fe9a00] transition-all duration-700 ease-out"
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{toTargetPct}% to target</span>
        </div>
      </StatCard>

      <StatCard label="Run To Target" icon={BadgePoundSterling} iconClass="text-[#ff0015]" testId="stat-box-run-to-target">
        <p
          className="mt-2 flex flex-wrap items-baseline gap-x-1 text-lg font-semibold tracking-tight"
          data-testid="stat-value-run-to-target"
        >
          {currency.format(remaining)}
          <span className="whitespace-nowrap text-base font-semibold text-black/30 dark:text-white/30">
            / {currency.format(target)}
          </span>
        </p>
        <p className="mt-2 text-xs font-semibold text-[#ff0015]">
          {bookingsToTarget > 0 && ppb > 0
            ? `${bookingsToTarget} Bookings at ${currency.format(ppb)}ppb`
            : "Target reached"}
        </p>
      </StatCard>
    </div>
  );
}
