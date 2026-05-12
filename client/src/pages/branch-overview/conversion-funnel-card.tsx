import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import type { BranchOverviewFunnel } from "@/api/endpoints/branch-overview.api";

function FunnelBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">{value.toLocaleString()}</span>
      </div>
      <div className="h-3 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/5">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function ConversionFunnelCard({ funnel }: { funnel: BranchOverviewFunnel }) {
  const max = Math.max(funnel.enquiries, funnel.quotes, funnel.bookings, 1);
  const quoteRate = funnel.enquiries > 0 ? Math.round((funnel.quotes / funnel.enquiries) * 100) : 0;
  const bookRate = funnel.quotes > 0 ? Math.round((funnel.bookings / funnel.quotes) * 100) : 0;

  return (
    <Card
      className="glass ringed grain rounded-2xl p-4 md:p-5"
      data-testid="conversion-funnel-card"
    >
      <div className="mb-3 flex items-baseline justify-between">
        <div>
          <div className="text-sm font-medium">Conversion funnel</div>
          <div className="text-xs text-muted-foreground">Year to date</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{funnel.conversionRate}%</div>
          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Overall conversion
          </div>
        </div>
      </div>
      <div className="space-y-3">
        <FunnelBar label="Enquiries" value={funnel.enquiries} max={max} color="bg-sky-500" />
        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <ArrowRight className="h-3 w-3" /> {quoteRate}% quoted
        </div>
        <FunnelBar label="Quotes" value={funnel.quotes} max={max} color="bg-indigo-500" />
        <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
          <ArrowRight className="h-3 w-3" /> {bookRate}% booked
        </div>
        <FunnelBar label="Bookings" value={funnel.bookings} max={max} color="bg-emerald-500" />
      </div>
    </Card>
  );
}
