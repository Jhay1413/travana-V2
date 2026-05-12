import { motion } from "framer-motion";
import {
  BarChart3,
  CircleDollarSign,
  TrendingUp,
  Wallet,
  ClipboardList,
  Receipt,
  Users,
  CalendarRange,
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
        label="Month Profit"
        value={currency.format(kpis.monthProfit)}
        icon={CircleDollarSign}
        color="bg-emerald-500"
        subtext={`Today: ${currency.format(kpis.todayProfit)} · Week: ${currency.format(kpis.weekProfit)}`}
      />
      <StatBox
        label="Month Revenue"
        value={currency.format(kpis.monthRevenue)}
        icon={Receipt}
        color="bg-blue-500"
        subtext="Sum of booking sales price"
      />
      <StatBox
        label="Bookings"
        value={kpis.monthBookingsCount.toLocaleString()}
        icon={ClipboardList}
        color="bg-purple-500"
        subtext={`Avg ${currency.format(kpis.avgBookingValue)}`}
      />
      <StatBox
        label="Open Quotes"
        value={currency.format(kpis.openQuotesValue)}
        icon={Wallet}
        color="bg-amber-500"
        subtext={`${kpis.openQuotesCount} open`}
      />
      <StatBox
        label="Active Clients"
        value={kpis.activeClientsCount.toLocaleString()}
        icon={Users}
        color="bg-sky-500"
        subtext="Activity in last 90 days"
      />
      <StatBox
        label="YTD Profit"
        value={currency.format(kpis.ytdProfit)}
        icon={BarChart3}
        color="bg-fuchsia-500"
        subtext={`Revenue ${currency.format(kpis.ytdRevenue)}`}
      />
      <StatBox
        label="YTD Revenue"
        value={currency.format(kpis.ytdRevenue)}
        icon={TrendingUp}
        color="bg-rose-500"
        subtext="Year to date"
      />
      <StatBox
        label="Avg Booking"
        value={currency.format(kpis.avgBookingValue)}
        icon={CalendarRange}
        color="bg-teal-500"
        subtext="Mean of this month"
      />
    </div>
  );
}
