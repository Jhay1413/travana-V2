import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBranchOverviewStats } from "@/hooks/queries";
import { BranchProfileStrip } from "./branch-profile-strip";
import { KpiCards } from "./kpi-cards";
import { ConversionFunnelCard } from "./conversion-funnel-card";
import { AgentsPerformanceCard } from "./agents-performance-card";

export default function BranchOverviewPage({
  branchId,
  hideTitle = false,
}: { branchId?: string; hideTitle?: boolean } = {}) {
  const { data, isLoading, isError, error } = useBranchOverviewStats(branchId);

  if (isLoading) {
    return (
      <div
        className="flex h-full min-h-[60vh] items-center justify-center"
        data-testid="branch-overview-loading"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading branch overview…
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card
        className="mx-auto mt-8 max-w-md p-6 text-center"
        data-testid="branch-overview-error"
      >
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" aria-hidden />
        <h2 className="text-base font-semibold">Couldn't load branch overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again in a moment."}
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" data-testid="branch-overview-page">
      {hideTitle ? null : (
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold">Branch Overview</h1>
        </div>
      )}

      {data.branch ? <BranchProfileStrip branch={data.branch} /> : null}

      <KpiCards kpis={data.kpis} />

      <AgentsPerformanceCard branchId={branchId} />

      <ConversionFunnelCard branchId={branchId} />
    </section>
  );
}
