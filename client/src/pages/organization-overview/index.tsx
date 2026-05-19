import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useOrganizationOverviewStats } from "@/hooks/queries";
import { OrgProfileStrip } from "./org-profile-strip";
import { KpiCards } from "./kpi-cards";
import { ConversionFunnelCard } from "./conversion-funnel-card";
import { CommissionTrendCard } from "./commission-trend-card";
import { TopDestinationsCard } from "./top-destinations-card";
import { AttentionCard } from "./attention-card";
import { AgentsPerformanceCard } from "./agents-performance-card";

export default function OrganizationOverviewPage() {
  const { data, isLoading, isError, error } = useOrganizationOverviewStats();

  if (isLoading) {
    return (
      <div
        className="flex h-full min-h-[60vh] items-center justify-center"
        data-testid="organization-overview-loading"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading agency overview…
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card
        className="mx-auto mt-8 max-w-md p-6 text-center"
        data-testid="organization-overview-error"
      >
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" aria-hidden />
        <h2 className="text-base font-semibold">Couldn't load agency overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again in a moment."}
        </p>
      </Card>
    );
  }

  return (
    <section className="space-y-4" data-testid="organization-overview-page">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
        <h1 className="text-xl font-semibold">Agency Overview</h1>
      </div>

      {data.organization ? <OrgProfileStrip organization={data.organization} /> : null}

      <KpiCards kpis={data.kpis} />

      <AgentsPerformanceCard />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <CommissionTrendCard trend={data.trend} />
        <AttentionCard attention={data.attention} />
      </div>


      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <TopDestinationsCard
          destinations={data.topDestinations}
          resorts={data.topResorts}
          tourOperators={data.topTourOperators}
        />
        <ConversionFunnelCard funnel={data.funnel} />
      </div>
    </section>
  );
}
