import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, CardNote } from "@/features/admin-dashboard";
import { cn } from "@/lib/utils";
import { WEEKDAY_SHORT, parseKey } from "../../lib/dates";
import { buildLeaveCalendar, shiftMonth, statsRows, type CalendarState } from "../../lib/leave-calendar";
import { patternForBranches } from "../../lib/working-days";
import type { AgentProfileBranch } from "../../types";

const CELL: Record<CalendarState, string> = {
  working: "border-social-border bg-card",
  holiday: "border-status-posted-fg/25 bg-status-posted-bg text-status-posted-fg",
  sick: "border-status-failed-fg/25 bg-status-failed-bg text-status-failed-fg",
  leave: "border-stage-inplay-fg/25 bg-stage-inplay-bg text-stage-inplay-fg",
  pending: "border-dashed border-social-muted bg-card text-social-muted",
  off: "border-transparent bg-status-draft-bg text-social-muted",
};

const MARK: Partial<Record<CalendarState, string>> = { holiday: "Holiday", sick: "Sick", leave: "Leave", pending: "Pending" };

const LEGEND: Array<{ state: CalendarState; label: string }> = [
  { state: "holiday", label: "Holiday" },
  { state: "sick", label: "Sick" },
  { state: "leave", label: "Other leave" },
  { state: "pending", label: "Waiting for approval" },
  { state: "off", label: "Not working" },
];

const ARROW =
  "grid h-8 w-8 place-items-center rounded-[8px] border border-social-border bg-card text-foreground transition hover:bg-muted";

export function LeaveCalendarCard({
  firstName,
  isHomeworker,
  branches,
  employee,
  isLoading,
  isError,
  todayKey,
}: {
  firstName: string;
  isHomeworker: boolean;
  branches: readonly AgentProfileBranch[];
  employee: EmployeeDetail | undefined;
  isLoading: boolean;
  isError: boolean;
  todayKey: string;
}) {
  const today = parseKey(todayKey);
  const [shown, setShown] = useState({ year: today.year, month: today.month });

  if (isHomeworker) {
    return (
      <HomeCard className="min-[1101px]:col-span-12" testId="agent-profile-attendance">
        <CardHead id="attendance-title" title="Attendance" />
        <p className="text-[13px] text-social-muted xl:text-[14px]" data-testid="attendance-homeworker-note">
          {firstName} is a self-employed homeworker, so attendance is not tracked.
        </p>
      </HomeCard>
    );
  }

  const cal = buildLeaveCalendar({ ...shown, todayKey, pattern: patternForBranches(branches), leaves: employee?.holidays ?? [] });
  const isCurrent = shown.year === today.year && shown.month === today.month;
  const go = (delta: number) => setShown((s) => shiftMonth(s.year, s.month, delta));

  return (
    <HomeCard className="min-[1101px]:col-span-12" testId="agent-profile-attendance">
      <CardHead
        id="attendance-title"
        title={`Attendance, ${cal.title}`}
        sub="Working days and approved or requested leave from the HR record."
        right={
          <div className="flex items-center gap-2">
            <button type="button" className={ARROW} onClick={() => go(-1)} aria-label="Previous month" data-testid="button-calendar-prev">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" className={ARROW} onClick={() => go(1)} aria-label="Next month" data-testid="button-calendar-next">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        }
      />
      {isError ? (
        <CardNote tone="error" testId="attendance-error">
          We could not load the leave record, so the calendar may be missing holiday and sickness.
        </CardNote>
      ) : isLoading ? (
        <CardNote>Loading...</CardNote>
      ) : null}
      <div className="grid grid-cols-1 gap-8 min-[1101px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div>
          <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-[12px] text-social-muted xl:text-[13px]" data-testid="calendar-legend">
            {LEGEND.map((l) => (
              <span key={l.state} className="inline-flex items-center gap-2">
                <i className={cn("inline-block h-3.5 w-3.5 shrink-0 rounded-[4px] border", CELL[l.state])} aria-hidden />
                {l.label}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1.5 max-[720px]:gap-1" role="group" aria-label={`Attendance in ${cal.title}`} data-testid="leave-calendar">
            {WEEKDAY_SHORT.map((d) => (
              <span key={d} className="text-center text-[12px] font-medium text-social-muted xl:text-[13px]" aria-hidden>
                {d}
              </span>
            ))}
            {Array.from({ length: cal.leading }, (_, i) => (
              <div key={`blank-${i}`} className="invisible" aria-hidden />
            ))}
            {cal.cells.map((c) => (
              <div
                key={c.date}
                className={cn(
                  "flex min-h-[46px] flex-col rounded-[10px] border p-1 text-[12px] leading-tight min-[721px]:min-h-[54px] min-[721px]:px-[7px] min-[721px]:py-[5px] xl:text-[13px]",
                  CELL[c.state],
                  c.isToday && "ring-2 ring-social-navy",
                )}
                data-testid={`calendar-day-${c.date}`}
              >
                <b className="text-[13px] font-semibold xl:text-[14px]">{c.day}</b>
                <span aria-hidden className="truncate text-[10px] font-semibold min-[721px]:text-[11px]">
                  {c.isToday ? (MARK[c.state] ? `Today · ${MARK[c.state]}` : "Today") : (MARK[c.state] ?? "")}
                </span>
                <span className="sr-only">{c.label}</span>
              </div>
            ))}
          </div>
          {!isCurrent && (
            <button type="button" className="mt-3 text-[12px] font-semibold text-social-orange-text hover:underline xl:text-[13px]" onClick={() => setShown({ year: today.year, month: today.month })}>
              Back to this month
            </button>
          )}
        </div>
        <ul className="m-0 flex list-none flex-col p-0 text-[13px] xl:text-[14px]" data-testid="calendar-stats">
          {statsRows(cal.stats).map((r) => (
            <li key={r.label} className="flex items-center justify-between gap-3 border-t border-social-border py-2.5 first:border-t-0 first:pt-0">
              <span>{r.label}</span>
              <span className="font-semibold tabular-nums">{r.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </HomeCard>
  );
}
