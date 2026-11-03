import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  displayFigures,
  driftMessage,
  formatMoney,
  groupLines,
  monthLabel,
  shiftMonth,
  type MonthRef,
} from "../lib/statement";
import { formatProfitShare } from "../lib/profit-share";
import type { StatementResult } from "../statement-types";

export function MonthPicker({ month, onChange }: { month: MonthRef; onChange: (m: MonthRef) => void }) {
  return (
    <div className="flex items-center gap-2" data-testid="statement-month-picker">
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(shiftMonth(month, -1))} aria-label="Previous month">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] text-center text-sm font-semibold">{monthLabel(month)}</div>
      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => onChange(shiftMonth(month, 1))} aria-label="Next month">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function Stat({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-base font-semibold" data-testid={testId}>{value}</div>
    </div>
  );
}

export function StatementSummary({ result }: { result: StatementResult }) {
  const figures = displayFigures(result);
  const drift = driftMessage(result);
  return (
    <div className="space-y-3" data-testid="statement-summary">
      {figures.frozen && (
        <div className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800" data-testid="badge-statement-finalised">
          Finalised
        </div>
      )}
      {drift && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800" data-testid="banner-statement-drift">
          {drift}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Gross profit" value={formatMoney(figures.gross)} testId="stat-gross" />
        <Stat label="Share" value={formatProfitShare(figures.sharePercent)} testId="stat-share-percent" />
        <Stat label="Homeworker share" value={formatMoney(figures.homeworkerShare)} testId="stat-homeworker-share" />
        <Stat label="Agency share" value={formatMoney(figures.orgShare)} testId="stat-org-share" />
        <Stat label="Bookings" value={String(result.bookingCount)} testId="stat-booking-count" />
      </div>
    </div>
  );
}

export function StatementLines({ result }: { result: StatementResult }) {
  const { bookings, upsells } = groupLines(result.lines);
  if (bookings.length === 0 && upsells.length === 0) {
    return <div className="py-6 text-center text-sm text-muted-foreground">No bookings in this period.</div>;
  }
  return (
    <div className="space-y-5" data-testid="statement-lines">
      {bookings.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold">Bookings</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-right">Service charge</TableHead>
                <TableHead className="text-right">Net</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((l) => (
                <TableRow key={`b-${l.bookingId}`} data-testid={`row-statement-booking-${l.bookingId}`}>
                  <TableCell>{l.clientName ?? "–"}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.commission)}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.discounts)}</TableCell>
                  <TableCell className="text-right">{formatMoney(l.serviceCharge)}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(l.net)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      {upsells.length > 0 && (
        <div>
          <div className="mb-1 text-sm font-semibold">Upsells</div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upsells.map((l, i) => (
                <TableRow key={`u-${l.bookingId}-${i}`}>
                  <TableCell>{l.clientName ?? "–"}</TableCell>
                  <TableCell>{l.upsellType}</TableCell>
                  <TableCell className="text-right font-medium">{formatMoney(l.amount)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

export function StatementBody({ result, isLoading, isError }: { result: StatementResult | undefined; isLoading: boolean; isError: boolean }) {
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (isError || !result) return <div className="py-6 text-center text-sm text-rose-500">Couldn't load the statement.</div>;
  return (
    <div className="space-y-5">
      <StatementSummary result={result} />
      <StatementLines result={result} />
    </div>
  );
}
