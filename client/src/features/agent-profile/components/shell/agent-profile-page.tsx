import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { UserX } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { CARD_BUTTON } from "@/features/admin-dashboard";
import { useRole } from "@/hooks/use-role";
import { londonDayKey } from "@/lib/london-day";
import { useAgentProfileHeader, useAgentProfileMonthly } from "../../api/use-agent-profile-queries";
import { parseKey } from "../../lib/dates";
import { DEFAULT_PERIOD_KEY, buildPeriods } from "../../lib/period";
import { breadcrumbFor, tabPath } from "../../lib/profile-tabs";
import type { ProfileTab } from "../../types";
import { EarningsTab } from "../earnings/earnings-tab";
import { HrTab } from "../hr/hr-tab";
import { OverviewTab } from "../overview/overview-tab";
import { PipelineTab } from "../pipeline/pipeline-tab";
import { EmptyBlock } from "../shared/profile-bits";
import { TrainingTab } from "../training/training-tab";
import { ProfileBreadcrumb } from "./profile-breadcrumb";
import { ProfileCard } from "./profile-card";
import { ProfileTabs } from "./profile-tabs";

function NotFound({ title, message }: { title: string; message: string }) {
  const { orgRole } = useRole();
  const back = breadcrumbFor(orgRole === "org_admin" || orgRole === "platform_admin");
  return (
    <section className="flex flex-col items-center gap-3 rounded-2xl border border-social-border bg-card p-8" data-testid="agent-profile-not-found">
      <UserX className="h-8 w-8 text-social-muted" aria-hidden />
      <EmptyBlock title={title}>{message}</EmptyBlock>
      <Link href={back.rootHref} className={CARD_BUTTON} data-testid="link-agent-profile-back">
        Back to the dashboard
      </Link>
    </section>
  );
}

/** Agent profile (design board A3): header, four tabs plus the pipeline, all for one person. */
export function AgentProfilePage({ agentId, tab }: { agentId: string; tab: ProfileTab }) {
  const [, navigate] = useLocation();
  const [periodKey, setPeriodKey] = useState(DEFAULT_PERIOD_KEY);
  const todayKey = londonDayKey(new Date());
  const periods = useMemo(() => buildPeriods(todayKey), [todayKey]);
  const header = useAgentProfileHeader(agentId);
  const monthly = useAgentProfileMonthly(agentId, parseKey(todayKey).year);
  const data = header.data;

  if (header.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center" data-testid="agent-profile-loading">
        <Spinner className="h-7 w-7" />
      </div>
    );
  }

  if (!data) {
    const err = header.error as (Error & { status?: number }) | null;
    // 404: no such agent in view. 403: the server says why (no organisation, no branch), so show that.
    const notFound = err?.status === 404;
    return (
      <div className="flex flex-col gap-4" data-testid="page-agent-profile">
        {notFound ? (
          <NotFound title="We could not find that agent" message="They may have left, or they may not be in your branch." />
        ) : (
          <NotFound title="We could not open this profile" message={err?.message || "Something went wrong loading this profile. Try again in a moment."} />
        )}
      </div>
    );
  }

  // Monthly data from another year (kept while loading) is ignored; null means "still loading".
  const year = parseKey(todayKey).year;
  const thisYear = monthly.data?.year === year ? monthly.data : undefined;
  const hasTarget = thisYear ? thisYear.targets.some((t) => t > 0) : monthly.isError ? false : null;

  return (
    <div className="flex flex-col gap-5" data-testid="page-agent-profile">
      <ProfileBreadcrumb isAdmin={data.viewer.isAdmin} name={data.user.name} />
      <ProfileCard header={data} todayKey={todayKey} hasTarget={hasTarget} />
      <ProfileTabs value={tab} onChange={(next) => navigate(tabPath(agentId, next))} />
      <div id="profile-tabpanel" role="tabpanel" aria-labelledby={`profile-tab-${tab}`} className="flex flex-col gap-6">
        {tab === "overview" && <OverviewTab header={data} periods={periods} periodKey={periodKey} onPeriod={setPeriodKey} todayKey={todayKey} />}
        {tab === "earnings" && <EarningsTab header={data} periods={periods} periodKey={periodKey} onPeriod={setPeriodKey} todayKey={todayKey} />}
        {tab === "training" && <TrainingTab header={data} todayKey={todayKey} />}
        {tab === "hr" && <HrTab header={data} todayKey={todayKey} />}
        {tab === "pipeline" && <PipelineTab userId={data.user.id} />}
      </div>
    </div>
  );
}
