import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { currency } from "./helpers";
import type { BranchOverviewTrendPoint } from "@/features/organization/api/branch-overview.api";

function shortMonth(yyyyDashMm: string): string {
  const [, m] = yyyyDashMm.split("-").map((n) => parseInt(n, 10));
  if (!m) return yyyyDashMm;
  return new Date(2000, m - 1, 1).toLocaleDateString(undefined, { month: "short" });
}

export function CommissionTrendCard({ trend }: { trend: BranchOverviewTrendPoint[] }) {
  const data = trend.map((p) => ({
    ...p,
    label: shortMonth(p.month),
    achieved: p.target > 0 && p.commission >= p.target,
  }));

  const year = trend[0]?.month?.slice(0, 4) ?? "";

  return (
    <Card
      className="glass ringed grain rounded-2xl p-4 md:p-5"
      data-testid="commission-trend-card"
    >
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">
            Commission vs target — {year}
          </div>
          <div className="text-xs text-muted-foreground">
            Bars: actual commission · Line: monthly target · Green = on/over target
          </div>
        </div>
        <div className="hidden gap-3 text-[10px] text-muted-foreground sm:flex">
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-emerald-500" /> On/over target
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-rose-500" /> Under target
          </span>
        </div>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickFormatter={(v: number) => currency.format(v)}
              width={70}
            />
            <RechartsTooltip
              formatter={(value: number, name: string) => {
                if (name === "commission") return [currency.format(value), "Commission"];
                if (name === "target") return [currency.format(value), "Target"];
                return [value.toLocaleString(), name];
              }}
              labelStyle={{ fontSize: 12 }}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(v: string) => (v === "commission" ? "Commission" : "Target")}
            />
            <Bar
              dataKey="commission"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              data-testid="trend-bars"
            >
              {data.map((entry) => (
                <Cell
                  key={entry.month}
                  fill={
                    entry.target > 0
                      ? entry.achieved
                        ? "rgb(16 185 129)"
                        : "rgb(244 63 94)"
                      : "rgb(148 163 184)"
                  }
                />
              ))}
            </Bar>
            <Line
              type="monotone"
              dataKey="target"
              stroke="rgb(99 102 241)"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 3 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
