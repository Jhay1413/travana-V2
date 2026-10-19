import type { EmployeeDetail } from "@/features/hr";
import { HomeCard } from "@/features/agent-overview";
import { CardHead, StatusPill } from "@/features/admin-dashboard";
import { buildHolidayModel, sicknessLine } from "../../lib/holiday-model";
import { plural } from "../../lib/money";
import { patternForBranches } from "../../lib/working-days";
import type { AgentProfileHeader } from "../../types";

/** Holiday in working days for the current year; homeworkers get an availability note instead. */
export function HolidayCard({ header, employee, todayKey, className }: { header: AgentProfileHeader; employee: EmployeeDetail; todayKey: string; className?: string }) {
  const first = header.user.firstName;

  if (header.isHomeworker) {
    return (
      <HomeCard className={className} testId="hr-holiday-card">
        <CardHead id="holiday-title" title="Availability" />
        <p className="text-[13px] xl:text-[14px]">
          As a self-employed homeworker, {first} sets their own hours, so holiday and sickness are not tracked here.
        </p>
      </HomeCard>
    );
  }

  const m = buildHolidayModel({
    allowance: employee.holidayAllowance,
    leaves: employee.holidays,
    todayKey,
    pattern: patternForBranches(header.branches),
  });

  return (
    <HomeCard className={className} testId="hr-holiday-card">
      <CardHead id="holiday-title" title="Holiday and absence" />
      {m.allowance === null ? (
        <p className="text-[13px] text-social-muted xl:text-[14px]" data-testid="holiday-no-allowance">
          No holiday allowance is set yet. Use Edit on Employment to add one.
        </p>
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <b className="text-[14px] font-semibold" data-testid="holiday-left">
              {plural(m.left, "day")} left
            </b>
            <span className="text-[12px] text-social-muted xl:text-[13px]">of {m.allowance} this year</span>
          </div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-[5px] bg-border" role="img" aria-label={m.ariaLabel}>
            <i className="block h-full bg-social-navy" style={{ width: `${m.takenPct}%` }} />
            <i className="block h-full bg-social-navy/55" style={{ width: `${m.bookedPct}%` }} />
          </div>
          <div className="my-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-social-muted xl:text-[13px]">
            <span>Taken {m.taken}</span>
            <span>Booked {m.booked}</span>
            <span>Left {m.left}</span>
            {m.pending > 0 && <span>Waiting for approval {m.pending}</span>}
          </div>
          {m.overBy > 0 && <p className="mb-2 text-[12px] font-medium text-status-failed-fg">{plural(m.overBy, "day")} over the allowance.</p>}
        </>
      )}
      {m.rows.length === 0 ? (
        <p className="mt-2 text-[12px] text-social-muted xl:text-[13px]">No holiday or leave recorded this year.</p>
      ) : (
        <ul className="m-0 mt-2 list-none divide-y divide-social-border p-0 text-[13px] xl:text-[14px]">
          {m.rows.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0">
                <b className="font-semibold">{r.dates}</b>
                <div className="text-[12px] text-social-muted">{r.note}</div>
              </div>
              <span className="flex shrink-0 items-center gap-2 tabular-nums">
                {plural(r.days, "day")} <StatusPill tone={r.tone}>{r.statusLabel}</StatusPill>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-social-muted xl:text-[13px]">{sicknessLine(m.sickDays, m.year)}</p>
    </HomeCard>
  );
}
