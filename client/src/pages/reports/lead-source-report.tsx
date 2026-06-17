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
import { Download, Loader2 } from "lucide-react";
import { useLeadSourceReport } from "@/hooks/queries";
import type { ReportFilters } from "@/features/reports/api/reports.api";
import { currency } from "./helpers";
import { exportCsv } from "./csv";

export function LeadSourceTab({ filters }: { filters: ReportFilters }) {
  const { data, isLoading, isError } = useLeadSourceReport(filters);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading lead-source report…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Couldn't load the lead-source report.
      </div>
    );
  }

  const handleExport = () => {
    exportCsv(
      `lead-source-${data.range.from}-to-${data.range.to}`,
      data.rows.map((r) => ({
        source: r.source,
        enquiries: r.enquiries,
        quotes: r.quotes,
        bookings: r.bookings,
        commission: r.commission.toFixed(2),
        quoteRatePct: r.quoteRatePct,
        bookRatePct: r.bookRatePct,
      })),
    );
  };

  return (
    <div className="space-y-4" data-testid="lead-source-report">
      <Card className="glass ringed grain rounded-2xl p-4 md:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Lead source funnel</div>
            <div className="text-xs text-muted-foreground">
              {data.range.from} → {data.range.to} · Enquiry → Quote → Booking by channel
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            data-testid="lead-source-export"
          >
            <Download className="mr-1 h-3.5 w-3.5" /> CSV
          </Button>
        </div>

        {data.rows.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">No data in scope.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Enquiries</TableHead>
                <TableHead className="text-right">Quotes</TableHead>
                <TableHead className="text-right">Quote rate</TableHead>
                <TableHead className="text-right">Bookings</TableHead>
                <TableHead className="text-right">Book rate</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.source}>
                  <TableCell className="font-medium">{r.source}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.enquiries.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.quotes.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.quoteRatePct}%</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.bookings.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.bookRatePct}%</TableCell>
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
