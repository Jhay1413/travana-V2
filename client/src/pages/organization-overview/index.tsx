import { useState } from "react";
import { AlertCircle, BarChart3, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBranches, useOrganizationOverviewStats } from "@/hooks/queries";
import { OrgProfileStrip } from "./org-profile-strip";
import { KpiCards } from "./kpi-cards";
import { BranchesPerformanceTable } from "./branches-performance-table";
import { AgentsPerformanceCard } from "./agents-performance-card";
import { ForwardsSynopsisCard } from "./forwards-synopsis-card";
import BranchOverviewPage from "@/pages/branch-overview";

type DemoView = "single-branch" | "multi-branch";

export default function OrganizationOverviewPage() {
  const { data, isLoading, isError, error } = useOrganizationOverviewStats();
  const { data: branches } = useBranches();
  const [demoView, setDemoView] = useState<DemoView>(
    data?.kind === "single-branch" ? "single-branch" : "multi-branch",
  );

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

  const defaultBranchId =
    (branches ?? []).find((b) => b.isDefault)?.id ?? (branches ?? [])[0]?.id;

  return (
    <section className="space-y-4" data-testid="organization-overview-page">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h1 className="text-xl font-semibold">Agency Overview</h1>
        </div>
        {/* TODO: remove — demo-only toggle to preview both overview layouts */}
        <Tabs
          value={demoView}
          onValueChange={(v) => setDemoView(v as DemoView)}
          data-testid="organization-overview-demo-tabs"
        >
          <TabsList>
            <TabsTrigger value="single-branch">Single branch</TabsTrigger>
            <TabsTrigger value="multi-branch">Multi branch</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {data.organization ? <OrgProfileStrip organization={data.organization} /> : null}

      {demoView === "single-branch" ? (
        <>
          {defaultBranchId ? (
            <BranchOverviewPage branchId={defaultBranchId} hideTitle />
          ) : null}

          <ForwardsSynopsisCard />
        </>
      ) : (
        <>
          <KpiCards kpis={data.kpis} />
          <BranchesPerformanceTable />
          <ForwardsSynopsisCard />
          <AgentsPerformanceCard agentsOnly />
        </>
      )}
    </section>
  );
}
