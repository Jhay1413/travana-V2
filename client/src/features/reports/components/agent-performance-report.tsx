import { useState } from "react";
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
import { Download, Loader2, ArrowUpDown } from "lucide-react";
import { useAgentPerformanceReport } from "@/hooks/queries";
import type { ReportFilters, AgentPerformanceRow } from "@/features/reports/api/reports.api";
import { currency } from "./helpers";
import { exportCsv } from "./csv";

type SortKey = "commission" | "bookings" | "quotes" | "conversionPct" | "avgCommission";

export function AgentPerformanceTab({ filters }: { filters: ReportFilters }) {
  const { data, isLoading, isError } = useAgentPerformanceReport(filters);
  const [sortKey, setSortKey] = useState<SortKey>("commission");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading agent performance…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Couldn't load the agent performance report.
      </div>
    );
  }

  const sortedRows = [...data.rows].sort((a: AgentPerformanceRow, b: AgentPerformanceRow) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    if (av === bv) return a.name.localeCompare(b.name);
    return bv - av;
  });

  const handleExport = () => {
    exportCsv(
      `agents-${data.range.from}-to-${data.range.to}`,
      sortedRows.map((r) => ({
        name: r.name,
        commission: r.commission.toFixed(2),
        bookings: r.bookings,
        quotes: r.quotes,
        conversionPct: r.conversionPct,
        avgCommission: r.avgCommission.toFixed(2),
      })),
    );
  };

  const SortHead = ({ k, label }: { k: SortKey; label: string }) => (
    <button
      type="button"
      onClick={() => setSortKey(k)}
      className={
        "inline-flex items-center gap-1 text-xs font-medium " +
        (sortKey === k ? "text-foreground" : "text-muted-foreground")
      }
    >
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </button>
  );

  return (
    <div className="space-y-4" data-testid="agent-performance-report">
      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Agent performance</div>
            <div className="text-xs text-muted-foreground">
              {data.range.from} → {data.range.to} · {data.rows.length} agents · total {currency.format(data.totals.commission)}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={handleExport} data-testid="agents-export">
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        {sortedRows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No agents in scope.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead className="text-right">
                  <SortHead k="bookings" label="Bookings" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead k="quotes" label="Quotes" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead k="conversionPct" label="Conv %" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead k="avgCommission" label="Avg" />
                </TableHead>
                <TableHead className="text-right">
                  <SortHead k="commission" label="Commission" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((r, idx) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.bookings.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quotes.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.conversionPct}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {currency.format(r.avgCommission)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
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
