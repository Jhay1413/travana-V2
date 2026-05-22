import { Link } from "wouter";
import { ArrowRight, Banknote, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useRevenueDashboard } from "@/hooks/queries/use-revenue-queries";

function fmt(v: number) {
  return `£${v.toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export function ForwardsSynopsisCard() {
  const { data, isLoading } = useRevenueDashboard();

  const nextMonth = data?.nextMonthForwards ?? 0;
  const nextTarget = data?.nextMonthTarget ?? 0;
  const total12 = data?.total12MonthForwards ?? 0;
  const total12Target = (data?.monthlyData ?? []).reduce((s, m) => s + m.target, 0);
  const dealsNeeded = data?.dealsNeeded ?? 0;
  const gap = Math.max(0, nextTarget - nextMonth);
  const pct = nextTarget > 0 ? Math.min(100, Math.round((nextMonth / nextTarget) * 100)) : 0;
  const annualDiff = total12 - total12Target;

  return (
    <Card className="p-4" data-testid="card-forwards-synopsis">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Forwards Synopsis</h2>
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
          <div className="grid gap-3 sm:grid-cols-3">
            <div
              className="rounded-lg border bg-card p-3"
              data-testid="stat-next-month-forwards"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Target className="h-3 w-3" aria-hidden /> Next month
              </div>
              <div className="mt-1 text-lg font-semibold">{fmt(nextMonth)}</div>
              <div className="text-[11px] text-muted-foreground">
                of {fmt(nextTarget)} target ({pct}%)
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${pct >= 100 ? "bg-emerald-500" : pct >= 75 ? "bg-amber-500" : "bg-rose-500"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            <div
              className="rounded-lg border bg-card p-3"
              data-testid="stat-12m-forwards"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <Banknote className="h-3 w-3" aria-hidden /> 12 month total
              </div>
              <div className="mt-1 text-lg font-semibold">{fmt(total12)}</div>
              <div
                className={`text-[11px] font-medium ${annualDiff >= 0 ? "text-emerald-600" : "text-rose-600"}`}
              >
                {annualDiff >= 0 ? "+" : ""}
                {fmt(annualDiff)} vs target
              </div>
            </div>

            <div
              className="rounded-lg border bg-card p-3"
              data-testid="stat-deals-needed"
            >
              <div className="text-[11px] font-medium text-muted-foreground">
                Gap to target
              </div>
              <div className="mt-1 text-lg font-semibold">{fmt(gap)}</div>
              <div className="text-[11px] text-muted-foreground">
                ~{dealsNeeded} deal{dealsNeeded === 1 ? "" : "s"} needed
              </div>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
