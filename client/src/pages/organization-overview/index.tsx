import { useMemo, useState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranches, useOrganizationOverviewStats } from "@/hooks/queries";
import { DashboardCard } from "@/features/agent-overview/components/dashboard-ui";
import { PipelineLivePanel } from "@/features/agent-overview/components/pipeline-live-panel";
import { AdminStatBoxes } from "@/features/organization/components/organization-overview/admin-stat-boxes";
import { MultiBranchStatsCard } from "@/features/organization/components/organization-overview/multi-branch-stats-card";
import { TourOperatorLeagueCard } from "@/features/organization/components/organization-overview/tour-operator-league-card";
import { CommissionTrendCard } from "@/features/organization/components/organization-overview/commission-trend-card";

const BRANCH_STORAGE_KEY = "admin-dashboard.branch";
const ALL_BRANCHES = "all";

function loadStoredBranch(): string {
  try {
    return localStorage.getItem(BRANCH_STORAGE_KEY) || ALL_BRANCHES;
  } catch {
    return ALL_BRANCHES;
  }
}

function saveStoredBranch(value: string): void {
  try {
    localStorage.setItem(BRANCH_STORAGE_KEY, value);
  } catch {
    // Storage unavailable (private mode / quota) — the selection just won't persist.
  }
}

export default function OrganizationOverviewPage() {
  const { data: branches, isSuccess: branchesLoaded } = useBranches();
  const [storedBranch, setStoredBranch] = useState<string>(loadStoredBranch);

  const sortedBranches = useMemo(
    () => [...(branches ?? [])].sort((a, b) => a.name.localeCompare(b.name)),
    [branches],
  );
  const showBranchSelect = sortedBranches.length > 1;

  // Only trust a stored id once the branch list confirms it exists in this org —
  // a deleted branch or one from another org would otherwise 404 the whole page.
  // Also ignored when the org has 0-1 branches (no select is shown).
  const selectedBranch =
    storedBranch !== ALL_BRANCHES &&
    branchesLoaded &&
    showBranchSelect &&
    sortedBranches.some((b) => b.id === storedBranch)
      ? storedBranch
      : ALL_BRANCHES;
  const branchId = selectedBranch === ALL_BRANCHES ? undefined : selectedBranch;

  const handleBranchChange = (value: string) => {
    setStoredBranch(value);
    saveStoredBranch(value);
  };

  const { data, isLoading, isError, error } = useOrganizationOverviewStats(branchId);

  // Full-page loader only when there is nothing to show; a branch switch keeps the
  // previous figures on screen (keepPreviousData) while the new ones load.
  if (isLoading && !data) {
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
    <div className="text-compact flex gap-6" data-testid="organization-overview-page">
      <section className="min-w-0 flex-1 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold">Admin Dashboard</h1>
          {showBranchSelect && (
            <Select value={selectedBranch} onValueChange={handleBranchChange}>
              <SelectTrigger
                className="h-8 w-[180px] rounded-[6px] border-black/10 bg-white px-2 text-xs text-[#7c98b0] shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white/55"
                data-testid="select-admin-dashboard-branch"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value={ALL_BRANCHES} className="text-xs">
                  All branches
                </SelectItem>
                {sortedBranches.map((b) => (
                  <SelectItem key={b.id} value={b.id} className="text-xs">
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <AdminStatBoxes kpis={data.kpis} />

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_.7fr]">
          <MultiBranchStatsCard branchId={branchId} />
          <TourOperatorLeagueCard rows={data.tourOperatorBreakdown} />
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_.7fr]">
          <CommissionTrendCard trend={data.trend} />
          <DashboardCard className="min-h-[320px]" testId="card-admin-dashboard-spare">
            {null}
          </DashboardCard>
        </div>
      </section>

      <PipelineLivePanel
        title="Todays Pipeline"
        scope="all"
        branchId={branchId}
        className="hidden w-[380px] shrink-0 border-l border-black/10 bg-white dark:border-white/10 dark:bg-white/[0.04] 2xl:block 2xl:-my-6 2xl:-mr-6 2xl:py-6"
      />
    </div>
  );
}
