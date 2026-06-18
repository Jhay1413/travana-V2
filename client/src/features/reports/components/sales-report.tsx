import { motion } from "framer-motion";
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
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Download, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { useSalesReport } from "@/hooks/queries";
import type { ReportFilters } from "@/features/reports/api/reports.api";
import { currency, delta, formatMonthLabel } from "./helpers";
import { exportCsv } from "./csv";

function DeltaPill({ current, prior }: { current: number; prior: number }) {
  const d = delta(current, prior);
  if (d.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-3 w-3" /> no change
      </span>
    );
  }
  const positive = d.direction === "up";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={
        "inline-flex items-center gap-0.5 text-[10px] " +
        (positive ? "text-emerald-600" : "text-rose-600")
      }
    >
      <Icon className="h-3 w-3" />
      {d.pct === null ? `${positive ? "+" : ""}${currency.format(d.abs)}` : `${positive ? "+" : ""}${d.pct}%`}
    </span>
  );
}

function Tile({
  label,
  value,
  delta: deltaEl,
}: {
  label: string;
  value: string;
  delta?: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="glass ringed grain rounded-2xl p-4">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
        {deltaEl ? <div className="mt-1">{deltaEl}</div> : null}
      </Card>
    </motion.div>
  );
}

export function SalesReportTab({ filters }: { filters: ReportFilters }) {
  const { data, isLoading, isError } = useSalesReport(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading sales report…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Couldn't load the sales report.
      </div>
    );
  }

  const chartData = data.byMonth.map((p) => ({ ...p, label: formatMonthLabel(p.month) }));

  const handleExport = () => {
    exportCsv(
      `sales-${data.range.from}-to-${data.range.to}`,
      data.byMonth.map((m) => ({
        month: m.month,
        commission: m.commission.toFixed(2),
        bookings: m.bookings,
      })),
    );
  };

  return (
    <div className="space-y-4" data-testid="sales-report">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Commission"
          value={currency.format(data.totals.commission)}
          delta={<DeltaPill current={data.totals.commission} prior={data.prior.commission} />}
        />
        <Tile
          label="Bookings"
          value={data.totals.bookings.toLocaleString()}
          delta={<DeltaPill current={data.totals.bookings} prior={data.prior.bookings} />}
        />
        <Tile
          label="Avg Commission"
          value={currency.format(data.totals.avgCommission)}
          delta={
            <DeltaPill current={data.totals.avgCommission} prior={data.prior.avgCommission} />
          }
        />
        <Tile
          label="Distinct Clients"
          value={data.totals.distinctClients.toLocaleString()}
          delta={
            <DeltaPill current={data.totals.distinctClients} prior={data.prior.distinctClients} />
          }
        />
      </div>

      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Commission & bookings by month</div>
            <div className="text-xs text-muted-foreground">
              Bars: commission · Line: bookings
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="sales-export">
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
                formatter={(value: number, name: string) =>
                  name === "commission"
                    ? [currency.format(value), "Commission"]
                    : [value.toLocaleString(), "Bookings"]
                }
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

      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 text-sm font-medium">Commission by lead source</div>
        {data.byLeadSource.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No bookings in this period.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.byLeadSource.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.bookings.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currency.format(r.commission)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
