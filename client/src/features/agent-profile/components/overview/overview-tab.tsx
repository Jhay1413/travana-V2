import { Spinner } from "@/components/ui/spinner";
import { CardNote } from "@/features/admin-dashboard";
import { beforeStartNote, windowBeforeStart } from "../../lib/before-start";
import { showingLine } from "../../lib/hero-copy";
import type { PeriodOption } from "../../lib/period";
import { targetHref } from "../../lib/profile-tabs";
import { useProfilePeriod } from "../../state/use-profile-period";
import type { AgentProfileHeader } from "../../types";
import { ProfileNote, SectionHead } from "../shared/profile-bits";
import { HealthTiles } from "./health-tiles";
import { HeroTiles } from "./hero-tiles";
import { PeriodControls } from "./period-controls";
import { WeekPlanner } from "./week-planner";

export function OverviewTab({
  header,
  periods,
  periodKey,
  onPeriod,
  todayKey,
}: {
  header: AgentProfileHeader;
  periods: PeriodOption[];
  periodKey: string;
  onPeriod: (key: string) => void;
  todayKey: string;
}) {
  const { user, viewer } = header;
  const { period, performance, target, targetLoading } = useProfilePeriod(user.id, periods, periodKey);
  const perf = performance.data;

  return (
    <div className="flex flex-col gap-6" data-testid="agent-profile-overview">
      <section className="flex flex-col gap-3" aria-labelledby="performance-title">
        <SectionHead
          id="performance-title"
          title="Performance"
          sub={showingLine(user.firstName, period.say)}
          right={<PeriodControls periods={periods} value={period.key} onChange={onPeriod} />}
        />
        {windowBeforeStart(period.to, header.startedAt) && <ProfileNote>{beforeStartNote(user.firstName, header.startedAt, "figures")}</ProfileNote>}
        {performance.isError ? (
          <CardNote tone="error" testId="performance-error">
            We could not load {user.firstName}'s figures. Try again in a moment.
          </CardNote>
        ) : !perf ? (
          <div className="flex min-h-[160px] items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <>
            <HeroTiles perf={perf} target={target} targetLoading={targetLoading} say={period.say} targetLink={targetHref(viewer.isAdmin, header.isHomeworker)} />
            <HealthTiles perf={perf} />
          </>
        )}
      </section>
      <WeekPlanner userId={user.id} firstName={user.firstName} todayKey={todayKey} />
    </div>
  );
}
