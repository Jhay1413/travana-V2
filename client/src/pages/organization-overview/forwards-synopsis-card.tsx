import { Link } from "wouter";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRevenueDashboard } from "@/hooks/queries/use-revenue-queries";

function fmt(v: number) {
  return `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function ForwardsSynopsisCard() {
  const { data, isLoading } = useRevenueDashboard();

  const months = data?.monthlyData ?? [];
  const totalForwards = months.reduce((s, m) => s + m.forwards, 0);
  const totalTarget = months.reduce((s, m) => s + m.target, 0);
  const totalDeals = months.reduce((s, m) => s + m.deals, 0);
  const pct = totalTarget > 0 ? Math.round((totalForwards / totalTarget) * 100) : 0;
  const diff = totalForwards - totalTarget;
  const maxBar = Math.max(1, ...months.map((m) => Math.max(m.forwards, m.target)));

  return (
    <Card className="p-4" data-testid="card-forwards-synopsis">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Forwards Synopsis · Next 12 months</h2>
        </div>
        <Link
          href="/agency/forwards"
          className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          data-testid="link-forwards-detail"
        >
          View detail <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading forwards…</div>
      ) : (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border bg-card p-3" data-testid="stat-12m-total">
              <div className="text-[11px] font-medium text-muted-foreground">
                12 month forwards
              </div>
              <div className="mt-1 text-lg font-semibold">{fmt(totalForwards)}</div>
              <div className="text-[11px] text-muted-foreground">
                of {fmt(totalTarget)} target ({pct}%)
              </div>
            </div>
            <div className="rounded-lg border bg-card p-3" data-testid="stat-12m-variance">
              <div className="text-[11px] font-medium text-muted-foreground">
                vs target
              </div>
              <div
                className={`mt-1 text-lg font-semibold ${diff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {diff >= 0 ? "+" : ""}
                {fmt(diff)}
              </div>
              <div className="text-[11px] text-muted-foreground">across 12 months</div>
            </div>
            <div className="rounded-lg border bg-card p-3" data-testid="stat-12m-deals">
              <div className="text-[11px] font-medium text-muted-foreground">
                Deals booked
              </div>
              <div className="mt-1 text-lg font-semibold">{totalDeals}</div>
              <div className="text-[11px] text-muted-foreground">forward-dated</div>
            </div>
          </div>

          <div className="space-y-1.5" data-testid="list-monthly-forwards">
            {months.map((m) => {
              const fwdPct = (m.forwards / maxBar) * 100;
              const tgtPct = (m.target / maxBar) * 100;
              const monthPct = m.target > 0 ? Math.round((m.forwards / m.target) * 100) : 0;
              const color =
                monthPct >= 100
                  ? "bg-emerald-500"
                  : monthPct >= 75
                    ? "bg-amber-500"
                    : "bg-rose-500";
              return (
                <div
                  key={`${m.year}-${m.monthNumber}`}
                  className="grid grid-cols-[64px_1fr_auto] items-center gap-3 text-xs"
                  data-testid={`row-month-${m.year}-${m.monthNumber}`}
                >
                  <div className="font-medium text-muted-foreground">
                    {m.shortMonth} {String(m.year).slice(2)}
                  </div>
                  <div className="relative h-3 rounded-full bg-muted">
                    <div
                      className="absolute top-0 left-0 h-full w-px bg-foreground/40"
                      style={{ left: `${tgtPct}%` }}
                      title={`Target ${fmt(m.target)}`}
                    />
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: `${fwdPct}%` }}
                    />
                  </div>
                  <div className="flex w-32 justify-end gap-2 tabular-nums">
                    <span className="font-medium">{fmt(m.forwards)}</span>
                    <span className="text-muted-foreground">/ {fmt(m.target)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Card>
  );
}
