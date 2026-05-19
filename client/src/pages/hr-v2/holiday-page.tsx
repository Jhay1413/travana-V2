import { useMemo } from "react";
import { CalendarDays, CheckCircle2, Clock, Thermometer } from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { StatCard } from "./dashboard-page";
import { isOnLeaveToday, parseFlexibleDate } from "./helpers";
import type { Employee, HolidayEntry } from "./_data";

const UPCOMING_WINDOW_DAYS = 30;
const SICK_LOG_WINDOW_DAYS = 30;

interface LeaveRow {
  employee: Employee;
  leave: HolidayEntry;
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysFromNow(target: Date): number {
  const today = startOfDay(new Date()).getTime();
  return Math.round((startOfDay(target).getTime() - today) / 86_400_000);
}

export function HolidayPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees, approveLeave, rejectLeave } = useHR();

  const active = useMemo(() => employees.filter((e) => e.status !== "Archived"), [employees]);
  const today = startOfDay(new Date());
  const currentYear = today.getFullYear();

  const allRequests = useMemo<LeaveRow[]>(
    () => active.flatMap((e) => e.holidays.map((h) => ({ employee: e, leave: h }))),
    [active],
  );

  const pending = useMemo(
    () =>
      allRequests
        .filter((r) => r.leave.status === "Pending")
        .sort((a, b) => {
          const ad = parseFlexibleDate(a.leave.from)?.getTime() ?? Number.POSITIVE_INFINITY;
          const bd = parseFlexibleDate(b.leave.from)?.getTime() ?? Number.POSITIVE_INFINITY;
          return ad - bd;
        }),
    [allRequests],
  );

  const approvedThisYear = useMemo(
    () =>
      allRequests.filter((r) => {
        if (r.leave.status !== "Approved") return false;
        const from = parseFlexibleDate(r.leave.from);
        return from ? from.getFullYear() === currentYear : false;
      }),
    [allRequests, currentYear],
  );

  const onLeaveTodayRows = useMemo(
    () =>
      active
        .filter((e) => isOnLeaveToday(e, today))
        .map((e) => {
          const leave = e.holidays.find((h) => {
            if (h.status !== "Approved") return false;
            const from = parseFlexibleDate(h.from);
            const to = parseFlexibleDate(h.to);
            if (!from || !to) return false;
            return today.getTime() >= from.getTime() && today.getTime() <= to.getTime();
          });
          return leave ? { employee: e, leave } : null;
        })
        .filter((r): r is LeaveRow => r !== null),
    [active, today],
  );

  const upcomingLeaves = useMemo(() => {
    const windowEnd = today.getTime() + UPCOMING_WINDOW_DAYS * 86_400_000;
    return allRequests
      .filter((r) => {
        if (r.leave.status !== "Approved") return false;
        const from = parseFlexibleDate(r.leave.from);
        if (!from) return false;
        return from.getTime() > today.getTime() && from.getTime() <= windowEnd;
      })
      .sort((a, b) => {
        const ad = parseFlexibleDate(a.leave.from)?.getTime() ?? 0;
        const bd = parseFlexibleDate(b.leave.from)?.getTime() ?? 0;
        return ad - bd;
      });
  }, [allRequests, today]);

  const sickRecently = useMemo(() => {
    const windowStart = today.getTime() - SICK_LOG_WINDOW_DAYS * 86_400_000;
    return allRequests
      .filter((r) => {
        if (r.leave.type !== "Sick") return false;
        if (r.leave.status !== "Approved") return false;
        const to = parseFlexibleDate(r.leave.to);
        if (!to) return false;
        return to.getTime() >= windowStart;
      })
      .sort((a, b) => {
        const ad = parseFlexibleDate(a.leave.from)?.getTime() ?? 0;
        const bd = parseFlexibleDate(b.leave.from)?.getTime() ?? 0;
        return bd - ad; // most recent first
      });
  }, [allRequests, today]);

  const sickDaysThisMonth = useMemo(() => {
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).getTime();
    return allRequests
      .filter((r) => r.leave.type === "Sick" && r.leave.status === "Approved")
      .reduce((sum, r) => {
        const from = parseFlexibleDate(r.leave.from);
        const to = parseFlexibleDate(r.leave.to);
        if (!from || !to) return sum;
        if (to.getTime() < startOfMonth) return sum;
        return sum + r.leave.days;
      }, 0);
  }, [allRequests, today]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="On leave today"
          value={onLeaveTodayRows.length}
          icon={CalendarDays}
          tone="indigo"
          hint="Derived from approved leave"
          testId="card-holiday-on-leave"
        />
        <StatCard
          label="Pending approvals"
          value={pending.length}
          icon={Clock}
          tone="amber"
          hint="Awaiting your decision"
          testId="card-holiday-pending"
        />
        <StatCard
          label="Approved this year"
          value={approvedThisYear.length}
          icon={CheckCircle2}
          tone="emerald"
          hint={`Leave entries dated ${currentYear}`}
          testId="card-holiday-approved"
        />
        <StatCard
          label="Sick days this month"
          value={sickDaysThisMonth}
          icon={Thermometer}
          tone="rose"
          hint="Approved sick leave"
          testId="card-holiday-sick"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="On leave today" subtitle={`${onLeaveTodayRows.length} out of office`}>
          {onLeaveTodayRows.length === 0 ? (
            <Empty message="Everyone is in today." testId="on-leave-today-empty" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {onLeaveTodayRows.map(({ employee, leave }) => {
                const to = parseFlexibleDate(leave.to);
                const daysLeft = to ? Math.max(0, daysFromNow(to)) : null;
                return (
                  <li
                    key={`${employee.id}-${leave.id}`}
                    className="px-5 py-4 flex items-center gap-3"
                    data-testid={`row-on-leave-today-${employee.id}`}
                  >
                    <Avatar employee={employee} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">{employee.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {leave.type} · {leave.from} → {leave.to}
                        {leave.reason ? ` · ${leave.reason}` : ""}
                      </div>
                    </div>
                    {daysLeft !== null && (
                      <span className="text-[11px] font-medium text-slate-500 tabular-nums flex-none">
                        {daysLeft === 0 ? "back tomorrow" : `${daysLeft + 1}d left`}
                      </span>
                    )}
                    <button
                      onClick={() => onOpenProfile(employee.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-none"
                      data-testid={`button-on-leave-open-${employee.id}`}
                    >
                      Open
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Pending approvals" subtitle={`${pending.length} request${pending.length === 1 ? "" : "s"}`}>
          {pending.length === 0 ? (
            <Empty message="All caught up — no pending requests." testId="pending-empty" />
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map(({ employee, leave }) => {
                const from = parseFlexibleDate(leave.from);
                const daysUntil = from ? daysFromNow(from) : null;
                return (
                  <li
                    key={`${employee.id}-${leave.id}`}
                    className="px-5 py-4 flex items-center gap-3"
                    data-testid={`row-pending-${employee.id}-${leave.id}`}
                  >
                    <Avatar employee={employee} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {employee.name}
                        <span className="text-slate-500 font-normal">
                          {" "}
                          · {leave.type} · {leave.days}d
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {leave.from} → {leave.to}
                        {daysUntil !== null && daysUntil >= 0 ? ` · starts in ${daysUntil}d` : ""}
                        {leave.reason ? ` · ${leave.reason}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-none">
                      <button
                        onClick={() => approveLeave(employee.id, leave.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                        data-testid={`button-pending-approve-${employee.id}-${leave.id}`}
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => rejectLeave(employee.id, leave.id)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                        data-testid={`button-pending-reject-${employee.id}-${leave.id}`}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card
        title="Upcoming approved leave"
        subtitle={`Starts in the next ${UPCOMING_WINDOW_DAYS} days`}
      >
        {upcomingLeaves.length === 0 ? (
          <Empty
            message={`Nobody scheduled to start leave in the next ${UPCOMING_WINDOW_DAYS} days.`}
            testId="upcoming-empty"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {upcomingLeaves.map(({ employee, leave }) => {
              const from = parseFlexibleDate(leave.from);
              const daysUntil = from ? daysFromNow(from) : null;
              return (
                <li
                  key={`${employee.id}-${leave.id}`}
                  className="px-5 py-4 flex items-center gap-3"
                  data-testid={`row-upcoming-${employee.id}-${leave.id}`}
                >
                  <Avatar employee={employee} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {employee.name}
                      <span className="text-slate-500 font-normal">
                        {" "}
                        · {leave.type} · {leave.days}d
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {leave.from} → {leave.to}
                      {leave.reason ? ` · ${leave.reason}` : ""}
                    </div>
                  </div>
                  {daysUntil !== null && (
                    <span className="text-[11px] font-medium text-slate-500 tabular-nums flex-none">
                      in {daysUntil}d
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Sick log" subtitle={`Approved sick leave in the last ${SICK_LOG_WINDOW_DAYS} days`}>
        {sickRecently.length === 0 ? (
          <Empty message="No sick leave recorded recently." testId="sick-log-empty" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sickRecently.map(({ employee, leave }) => (
              <li
                key={`${employee.id}-${leave.id}`}
                className="px-5 py-4 flex items-center gap-3"
                data-testid={`row-sick-${employee.id}-${leave.id}`}
              >
                <Avatar employee={employee} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">
                    {employee.name}
                    <span className="text-slate-500 font-normal"> · {leave.days}d</span>
                  </div>
                  <div className="text-xs text-slate-500 truncate">
                    {leave.from} → {leave.to}
                    {leave.reason ? ` · ${leave.reason}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => onOpenProfile(employee.id)}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-none"
                  data-testid={`button-sick-open-${employee.id}-${leave.id}`}
                >
                  Open
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function Card({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Empty({ message, testId }: { message: string; testId: string }) {
  return (
    <div className="p-8 text-center text-sm text-slate-500" data-testid={testId}>
      {message}
    </div>
  );
}
