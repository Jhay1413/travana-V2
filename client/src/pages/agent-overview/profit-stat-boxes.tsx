import { motion } from "framer-motion";
import { BarChart3, CircleDollarSign, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  subtext,
  progress,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
  progress?: { achieved: number; target: number; barColor: string };
}) {
  const pct =
    progress && progress.target > 0
      ? Math.min(Math.round((progress.achieved / progress.target) * 100), 100)
      : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card
        className="glass ringed grain rounded-2xl p-4"
        data-testid={`stat-box-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
      >
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className="text-2xl font-bold tracking-tight"
              data-testid={`stat-value-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              {value}
            </p>
            {progress ? (
              <div className="space-y-1 pt-1">
                <div
                  className="h-2.5 w-full rounded-full bg-gray-200/60 overflow-hidden"
                  data-testid={`progress-bar-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700 ease-out",
                      progress.barColor,
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {currency.format(progress.achieved)} achieved · {pct}%
                </p>
              </div>
            ) : subtext ? (
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
  const activeTarget = isAgentView ? profitStats.agentSalesTarget : profitStats.salesTarget;
  const agentTargetPct =
    activeTarget > 0 ? Math.round((profitStats.monthProfit / activeTarget) * 100) : 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatBox
        label="Today's Total Profit"
        value={currency.format(profitStats.todayProfit)}
        icon={CircleDollarSign}
        color="bg-emerald-500"
        subtext="Profit from today's bookings"
      />
      <StatBox
        label="This Week's Total"
        value={currency.format(profitStats.weekProfit)}
        icon={TrendingUp}
        color="bg-blue-500"
        subtext="Mon – Sun rolling total"
      />
      <StatBox
        label="This Month's Total"
        value={currency.format(profitStats.monthProfit)}
        icon={BarChart3}
        color="bg-purple-500"
        subtext={`${agentTargetPct}% of sales target`}
      />
      {isAgentView ? (
        <StatBox
          label="Sales Target"
          value={currency.format(activeTarget)}
          icon={Target}
          color="bg-amber-500"
          progress={{
            achieved: profitStats.monthProfit,
            target: activeTarget,
            barColor: "bg-amber-500",
          }}
        />
      ) : (
        <StatBox
          label="Agency Sales Target"
          value={currency.format(profitStats.salesTarget)}
          icon={Target}
          color="bg-amber-500"
          subtext={`${currency.format(profitStats.monthProfit)} achieved`}
        />
      )}
    </div>
  );
}
