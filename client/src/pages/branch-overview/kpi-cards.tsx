import { motion } from "framer-motion";
import {
  BarChart3,
  CircleDollarSign,
  TrendingUp,
  Wallet,
  ClipboardList,
  Users,
  CalendarRange,
  CalendarClock,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { currency } from "./helpers";
import type { BranchOverviewKpis } from "@/api/endpoints/branch-overview.api";

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  const testKey = label.toLowerCase().replace(/[^a-z0-9]/g, "-");
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass ringed grain rounded-2xl p-4" data-testid={`stat-box-${testKey}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p
              className="text-2xl font-bold tracking-tight"
              data-testid={`stat-value-${testKey}`}
            >
              {value}
            </p>
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

export function KpiCards({ kpis }: { kpis: BranchOverviewKpis }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatBox
        label="Today's Commission"
        value={currency.format(kpis.todayCommission)}
        icon={CalendarClock}
        color="bg-emerald-500"
        subtext="Bookings created today"
      />
      <StatBox
        label="Week Commission"
        value={currency.format(kpis.weekCommission)}
        icon={TrendingUp}
        color="bg-blue-500"
        subtext="Mon–Sun rolling total"
      />
      <StatBox
        label="Month Commission"
        value={currency.format(kpis.monthCommission)}
        icon={CircleDollarSign}
        color="bg-purple-500"
        subtext={`Across ${kpis.monthBookingsCount} bookings`}
      />
      <StatBox
        label="YTD Commission"
        value={currency.format(kpis.ytdCommission)}
        icon={BarChart3}
        color="bg-fuchsia-500"
        subtext="Year to date"
      />
      <StatBox
        label="Bookings"
        value={kpis.monthBookingsCount.toLocaleString()}
        icon={ClipboardList}
        color="bg-sky-500"
        subtext="This month"
      />
      <StatBox
        label="Avg Commission"
        value={currency.format(kpis.avgCommission)}
        icon={CalendarRange}
        color="bg-teal-500"
        subtext="Per booking, this month"
      />
      <StatBox
        label="Open Quotes"
        value={currency.format(kpis.openQuotesValue)}
        icon={Wallet}
        color="bg-amber-500"
        subtext={`${kpis.openQuotesCount} open · commission`}
      />
      <StatBox
        label="Active Clients"
        value={kpis.activeClientsCount.toLocaleString()}
        icon={Users}
        color="bg-rose-500"
        subtext="Activity in last 90 days"
      />
    </div>
  );
}
