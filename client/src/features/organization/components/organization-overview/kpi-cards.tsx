import { motion } from "framer-motion";
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CircleDollarSign,
  Coins,
  PiggyBank,
  Target,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";
import type { OrganizationOverviewKpis } from "@/features/organization/api/organization-overview.api";

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  subtext,
  testId,
  progress,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  testId?: string;
  progress?: { percent: number; over: boolean };
}) {
  const baseTestKey = testId ?? label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className="glass ringed grain rounded-2xl p-4"
        data-testid={`stat-box-${baseTestKey}`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className="text-2xl font-bold tracking-tight"
              data-testid={`stat-value-${baseTestKey}`}
            >
              {value}
            </p>
            {progress ? (
              <div
                className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                data-testid={`stat-progress-${baseTestKey}`}
              >
                <div
                  className={cn(
                    "h-full rounded-full",
                    progress.over ? "bg-emerald-500" : "bg-rose-500",
                  )}
                  style={{ width: `${Math.min(100, Math.max(0, progress.percent))}%` }}
                />
              </div>
            ) : null}
            {subtext ? (
              <p className="text-[10px] text-muted-foreground">{subtext}</p>
            ) : null}
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ml-3",
              color,
            )}
          >
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function KpiCards({ kpis }: { kpis: OrganizationOverviewKpis }) {
  const overTarget = kpis.leftToTarget < 0;
  const leftToTargetLabel = overTarget
    ? `+ ${currency.format(Math.abs(kpis.leftToTarget))}`
    : currency.format(kpis.leftToTarget);
  const cappedPercent = Math.min(100, Math.max(0, kpis.percentToTarget));
  const percentLabel = `${Math.round(kpis.percentToTarget)}%`;
  const percentSubtext = overTarget
    ? `Visual capped at 100% · raw ${percentLabel}`
    : `Capped visual ${Math.round(cappedPercent)}% · raw ${percentLabel}`;
  const monthName = kpis.currentMonthName || "Month";

  return (
    <div className="space-y-3" data-testid="org-overview-kpi-grid">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          testId="today"
          label="Today"
          value={currency.format(kpis.todayCommission)}
          icon={CalendarClock}
          color="bg-emerald-500"
          subtext="Commission booked today"
        />
        <StatBox
          testId="week"
          label="Week"
          value={currency.format(kpis.weekCommission)}
          icon={CalendarDays}
          color="bg-blue-500"
          subtext="Mon–Sun rolling total"
        />
        <StatBox
          testId="month"
          label="Month"
          value={currency.format(kpis.monthCommission)}
          icon={CircleDollarSign}
          color="bg-purple-500"
          subtext={`${monthName} so far`}
        />
        <StatBox
          testId="month-target"
          label={`${monthName} Target`}
          value={currency.format(kpis.monthTarget)}
          icon={Target}
          color="bg-fuchsia-500"
          subtext={kpis.monthTarget > 0 ? "Sum of branch targets" : "No targets set"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatBox
          testId="total-bookings"
          label="Total Bookings"
          value={kpis.monthBookingsCount.toLocaleString()}
          icon={ClipboardList}
          color="bg-sky-500"
          subtext="This month"
        />
        <StatBox
          testId="average-commission"
          label="Average Commission"
          value={currency.format(kpis.avgCommission)}
          icon={Coins}
          color="bg-teal-500"
          subtext="Per booking, this month"
        />
        <StatBox
          testId="left-to-target"
          label="Left to Target"
          value={leftToTargetLabel}
          icon={PiggyBank}
          color={overTarget ? "bg-emerald-600" : "bg-amber-500"}
          subtext={overTarget ? "Above target" : "Remaining to hit target"}
        />
        <StatBox
          testId="percentage-to-target"
          label="Percentage to Target"
          value={percentLabel}
          icon={CalendarRange}
          color={overTarget ? "bg-emerald-600" : "bg-rose-500"}
          subtext={percentSubtext}
          progress={
            kpis.monthTarget > 0
              ? { percent: cappedPercent, over: overTarget }
              : undefined
          }
        />
      </div>
    </div>
  );
}
