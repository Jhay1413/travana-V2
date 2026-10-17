import { AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AdminSetupChecklist } from "@/features/onboarding";
import { useOrganizationOverviewStats } from "@/hooks/queries";
import { useDashboardBranch } from "../state/use-dashboard-branch";
import { BriefingCard } from "./briefing-card";
import { CommissionChartCard } from "./commission-chart-card";
import { CompareCard } from "./compare-card";
import { DeparturesCard } from "./departures-card";
import { HeadlineBand } from "./headline-band";
import { HomeworkersCard } from "./homeworkers-card";
import { PageHead } from "./page-head";
import { SalesHealth } from "./sales-health";
import { SourcesCard } from "./sources-card";
import { SupplierLeagueCard } from "./supplier-league-card";
import { TeamPerformanceCard } from "./team-performance-card";

// 12-column grid from 1101px up; one column below that.
const SPAN_5 = "min-[1101px]:col-span-5";
const SPAN_7 = "min-[1101px]:col-span-7";
const SPAN_12 = "min-[1101px]:col-span-12";

function errorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("response" in error)) return undefined;
  const response = (error as { response?: { status?: number } }).response;
  return response?.status;
}

export function AdminDashboard() {
  const branch = useDashboardBranch();
  const { data, isLoading, isError, error } = useOrganizationOverviewStats(branch.branchId);

  // Full-page loader only when there is nothing to show; a branch switch keeps the
  // previous figures on screen (keepPreviousData) while the new ones load.
  if (isLoading && !data) {
    return (
      <div className="flex h-full min-h-[60vh] items-center justify-center" data-testid="organization-overview-loading">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading agency overview…
        </div>
      </div>
    );
  }

  if (isError && errorStatus(error) === 403) {
    // Platform admins with no organisation in context: keep the head, explain, render no widgets.
    return (
      <div className="text-compact -m-4 flex min-h-full min-w-0 flex-col gap-6 bg-social-page p-4 md:-m-6 md:p-6" data-testid="organization-overview-page">
        <PageHead organizationName={null} showBranchSelect={false} branches={[]} selectedBranch={branch.selected} onBranchChange={branch.setBranch} />
        <Card className="mx-auto mt-4 max-w-lg p-6 text-center" data-testid="organization-overview-no-org">
          <h2 className="text-base font-semibold">This dashboard needs an organisation</h2>
          <p className="mt-1 text-[13px] text-social-muted">Platform admins: open an agency from All Agencies.</p>
        </Card>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="mx-auto mt-8 max-w-md p-6 text-center" data-testid="organization-overview-error">
        <AlertCircle className="mx-auto mb-2 h-6 w-6 text-status-failed-fg" aria-hidden />
        <h2 className="text-base font-semibold">Couldn't load agency overview</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {error instanceof Error ? error.message : "Please try again in a moment."}
        </p>
      </Card>
    );
  }

  return (
    <div
      className="text-compact -m-4 flex min-h-full min-w-0 flex-col gap-6 bg-social-page p-4 md:-m-6 md:p-6"
      data-testid="organization-overview-page"
    >
      <PageHead
        organizationName={data.organization?.name}
        showBranchSelect={branch.showSelect}
        branches={branch.sortedBranches}
        selectedBranch={branch.selected}
        onBranchChange={branch.setBranch}
      />

      <AdminSetupChecklist />

      <HeadlineBand kpis={data.kpis} />
      <SalesHealth kpis={data.kpis} />

      <div className="grid grid-cols-1 gap-6 min-[1101px]:grid-cols-12">
        <BriefingCard className={SPAN_5} />
        <DeparturesCard className={SPAN_7} />
        <CompareCard branchId={branch.branchId} className={SPAN_7} />
        <SourcesCard branchId={branch.branchId} className={SPAN_5} />
        <TeamPerformanceCard pageBranchId={branch.branchId} className={SPAN_12} />
        <HomeworkersCard rows={data.homeworkers} className={SPAN_12} />
        <CommissionChartCard trend={data.trend} className={SPAN_7} />
        <SupplierLeagueCard rows={data.tourOperatorBreakdown} className={SPAN_5} />
      </div>
    </div>
  );
}
