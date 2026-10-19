import { Spinner } from "@/components/ui/spinner";
import { CardNote } from "@/features/admin-dashboard";
import { beforeStartNote, windowBeforeStart } from "../../lib/before-start";
import { parseKey } from "../../lib/dates";
import type { PeriodOption } from "../../lib/period";
import { useProfilePeriod } from "../../state/use-profile-period";
import type { AgentProfileHeader } from "../../types";
import { ProfileNote, SectionHead } from "../shared/profile-bits";
import { PeriodSelect } from "../overview/period-controls";
import { BiggestDealsCard } from "./biggest-deals-card";
import { EarningsTiles } from "./earnings-tiles";
import { MonthlyCard } from "./monthly-card";
import { PayoutsCard } from "./payouts-card";

export function EarningsTab({
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
  const { user, viewer, isHomeworker } = header;
  const { period, performance, shaded } = useProfilePeriod(user.id, periods, periodKey);
  const perf = performance.data;
  const showPayouts = isHomeworker && viewer.canSeePay;

  return (
    <div className="flex flex-col gap-6" data-testid="agent-profile-earnings">
      <section className="flex flex-col gap-3" aria-labelledby="earnings-title">
        <SectionHead
          id="earnings-title"
          title="Earnings for the company"
          sub={`Showing the profit ${user.name} ${isHomeworker ? "booked in" : "earned for the company in"} ${period.say}.`}
          right={<PeriodSelect periods={periods} value={period.key} onChange={onPeriod} testId="select-earnings-period" />}
        />
        {windowBeforeStart(period.to, header.startedAt) && <ProfileNote>{beforeStartNote(user.firstName, header.startedAt, "earnings")}</ProfileNote>}
        {performance.isError ? (
          <CardNote tone="error" testId="earnings-error">
            We could not load {user.firstName}'s earnings. Try again in a moment.
          </CardNote>
        ) : !perf ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Spinner className="h-6 w-6" />
          </div>
        ) : (
          <EarningsTiles header={header} perf={perf} />
        )}
      </section>

      <MonthlyCard userId={user.id} year={parseKey(todayKey).year} firstName={user.firstName} isHomeworker={isHomeworker} lifetimeProfit={header.lifetimeProfit} shaded={shaded} />

      <div className="grid grid-cols-1 gap-4 min-[1101px]:grid-cols-12">
        <BiggestDealsCard userId={user.id} className={showPayouts ? "min-[1101px]:col-span-7" : "min-[1101px]:col-span-12"} />
        {showPayouts && <PayoutsCard userId={user.id} className="min-[1101px]:col-span-5" />}
      </div>
    </div>
  );
}
