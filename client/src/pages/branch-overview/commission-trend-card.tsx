import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { currency, formatMonthLabel } from "./helpers";
import type { BranchOverviewTrendPoint } from "@/api/endpoints/branch-overview.api";

export function CommissionTrendCard({ trend }: { trend: BranchOverviewTrendPoint[] }) {
  const data = trend.map((p) => ({ ...p, label: formatMonthLabel(p.month) }));
  return (
    <Card className="glass ringed grain rounded-2xl p-4 md:p-5" data-testid="commission-trend-card">
      <div className="mb-3">
        <div className="text-sm font-medium">Commission & bookings — last 12 months</div>
        <div className="text-xs text-muted-foreground">
          Bars: commission · Line: booking count
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => currency.format(v)}
              width={70}
            />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} width={30} />
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                if (name === "commission") return [currency.format(value), "Commission"];
                return [value.toLocaleString(), "Bookings"];
              }}
              labelStyle={{ fontSize: 12 }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar
              yAxisId="left"
              dataKey="commission"
              fill="rgb(16 185 129)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="bookings"
              stroke="rgb(99 102 241)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
