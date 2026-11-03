import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote, StatusPill } from "@/features/admin-dashboard";
import { useAgentProfileWeek } from "../../api/use-agent-profile-queries";
import { buildWeekView, weekRangeText, weekStarts, type WeekChoice } from "../../lib/week-model";
import { WeekDay } from "./week-day";

/** This week / next week: departures and open tasks, Monday to Sunday (London). */
export function WeekPlanner({ userId, firstName, todayKey }: { userId: string; firstName: string; todayKey: string }) {
  const [choice, setChoice] = useState<WeekChoice>("this");
  const start = weekStarts(todayKey)[choice];
  const week = useAgentProfileWeek(userId, start);
  const view = buildWeekView(week.data, start, todayKey);

  return (
    <HomeCard testId="agent-profile-week">
      <CardHead
        id="week-overview-title"
        title="Week overview"
        sub={`What ${firstName} has on, ${weekRangeText(start)}`}
        right={
          <Segmented
            value={choice}
            onChange={setChoice}
            variant="black"
            label="Choose the week"
            items={[
              { value: "this", label: "This week", testId: "segment-week-this" },
              { value: "next", label: "Next week", testId: "segment-week-next" },
            ]}
          />
        }
      />
      {week.isError ? (
        <CardNote tone="error" testId="week-error">
          We could not load the week. Try again in a moment.
        </CardNote>
      ) : (
        <>
          <div className="mb-3.5 flex flex-wrap items-center gap-2">
            <span className="mr-2 text-[13px] font-medium xl:text-[14px]" data-testid="week-summary">
              {week.isLoading ? "Loading the week..." : view.summary}
            </span>
            {view.chips.map((c) => (
              <StatusPill key={c.kind} tone={c.tone}>
                {c.text}
              </StatusPill>
            ))}
          </div>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Week planner, scrolls sideways on narrow screens">
            <div className="grid grid-cols-1 gap-2.5 min-[721px]:grid-cols-[repeat(7,minmax(138px,1fr))]">
              {view.days.map((d) => (
                <WeekDay key={d.date} day={d} />
              ))}
            </div>
          </div>
        </>
      )}
    </HomeCard>
  );
}
