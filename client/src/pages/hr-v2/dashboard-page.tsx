import { useMemo } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { isNewStarter, isOnLeaveToday, parseFlexibleDate, severityClasses } from "./helpers";
import type { Employee, HolidayEntry, Reminder } from "./_data";
import type { View } from "./sidebar";

const UPCOMING_LEAVE_WINDOW_DAYS = 14;

interface PendingApproval {
  employee: Employee;
  leave: HolidayEntry;
}

interface UpcomingLeave {
  employee: Employee;
  leave: HolidayEntry;
  startsAt: Date;
}

interface StarterProgress {
  employee: Employee;
  done: number;
  total: number;
  pct: number;
}

function deriveOnboardingProgress(employee: Employee): StarterProgress {
  const cats = ["Contract", "NDA", "Right to Work", "Policies", "Training"] as const;
  const done = cats.reduce(
    (n, c) => n + (employee.documents.some((d) => d.category === c && d.status === "Uploaded") ? 1 : 0),
    0,
  );
  return {
    employee,
    done,
    total: cats.length,
    pct: Math.round((done / cats.length) * 100),
  };
}

export function DashboardPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { employees, reminders, approveLeave, rejectLeave } = useHR();

  const active = useMemo(() => employees.filter((e) => e.status !== "Archived"), [employees]);

  const totalEmployees = active.length;
  const newStartersCount = useMemo(() => active.filter(isNewStarter).length, [active]);
  const onLeaveTodayCount = useMemo(() => active.filter((e) => isOnLeaveToday(e)).length, [active]);

  const pendingApprovals = useMemo<PendingApproval[]>(() => {
    const list: PendingApproval[] = [];
    for (const e of active) {
      for (const h of e.holidays) {
        if (h.status === "Pending") list.push({ employee: e, leave: h });
      }
    }
    return list.sort((a, b) => {
      const ad = parseFlexibleDate(a.leave.from)?.getTime() ?? Number.POSITIVE_INFINITY;
      const bd = parseFlexibleDate(b.leave.from)?.getTime() ?? Number.POSITIVE_INFINITY;
      return ad - bd;
    });
  }, [active]);

  const upcomingLeaves = useMemo<UpcomingLeave[]>(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const windowEnd = todayStart.getTime() + UPCOMING_LEAVE_WINDOW_DAYS * 86_400_000;
    const list: UpcomingLeave[] = [];
    for (const e of active) {
      for (const h of e.holidays) {
        if (h.status !== "Approved") continue;
        const start = parseFlexibleDate(h.from);
        const end = parseFlexibleDate(h.to);
        if (!start || !end) continue;
        if (end.getTime() < todayStart.getTime()) continue;
        if (start.getTime() > windowEnd) continue;
        list.push({ employee: e, leave: h, startsAt: start });
      }
    }
    return list.sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  }, [active]);

  const starterProgress = useMemo<StarterProgress[]>(() => {
    return active
      .filter(isNewStarter)
      .map(deriveOnboardingProgress)
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3);
  }, [active]);

  const pendingTasksCount = reminders.length + pendingApprovals.length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active employees"
          value={totalEmployees}
          icon={Users}
          tone="indigo"
          hint="All except archived"
          testId="card-stat-total-employees"
        />
        <StatCard
          label="New starters"
          value={newStartersCount}
          icon={UserPlus}
          tone="emerald"
          hint="Probation or joined < 90 days ago"
          testId="card-stat-new-starters"
        />
        <StatCard
          label="On leave today"
          value={onLeaveTodayCount}
          icon={CalendarDays}
          tone="amber"
          hint="From approved holiday entries"
          testId="card-stat-on-leave"
        />
        <StatCard
          label="Pending HR tasks"
          value={pendingTasksCount}
          icon={AlertTriangle}
          tone="rose"
          hint="Reminders + leave approvals"
          testId="card-stat-pending-tasks"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pending leave approvals</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {pendingApprovals.length === 0
                  ? "Nothing waiting for you"
                  : `${pendingApprovals.length} request${pendingApprovals.length === 1 ? "" : "s"} to decide`}
              </p>
            </div>
            <button
              onClick={() => onNavigate({ name: "holiday" })}
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
              data-testid="button-dashboard-open-holiday"
            >
              Open holiday
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          {pendingApprovals.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500" data-testid="approvals-empty">
              No leave requests waiting for a decision.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingApprovals.slice(0, 6).map(({ employee, leave }) => (
                <li
                  key={`${employee.id}-${leave.id}`}
                  className="p-4 flex items-center gap-3"
                  data-testid={`row-pending-approval-${leave.id}`}
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
                  <div className="flex items-center gap-1.5 flex-none">
                    <button
                      onClick={() => approveLeave(employee.id, leave.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg"
                      data-testid={`button-approve-${leave.id}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => rejectLeave(employee.id, leave.id)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg"
                      data-testid={`button-reject-${leave.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
              {pendingApprovals.length > 6 && (
                <li className="p-3 text-center text-xs text-slate-500">
                  +{pendingApprovals.length - 6} more — open the Holiday tab to see them all
                </li>
              )}
            </ul>
          )}
        </div>

        <OnboardingProgressCard
          starters={starterProgress}
          onNavigate={onNavigate}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <UpcomingTimeOffCard
          upcoming={upcomingLeaves}
          windowDays={UPCOMING_LEAVE_WINDOW_DAYS}
          onNavigate={onNavigate}
        />

        <TeamSnapshotCard employees={active} onNavigate={onNavigate} />
      </div>

      <RemindersCard reminders={reminders} />
    </div>
  );
}

function OnboardingProgressCard({
  starters,
  onNavigate,
}: {
  starters: StarterProgress[];
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            Onboarding progress
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Top new starters needing attention</p>
        </div>
        <button
          onClick={() => onNavigate({ name: "onboarding" })}
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
          data-testid="button-dashboard-open-onboarding"
        >
          View all
        </button>
      </div>
      <div className="p-5 space-y-4">
        {starters.length === 0 ? (
          <div className="text-sm text-slate-500 text-center py-4" data-testid="onboarding-progress-empty">
            No new starters right now.
          </div>
        ) : (
          starters.map(({ employee, done, total, pct }) => (
            <div key={employee.id} data-testid={`row-onboarding-progress-${employee.id}`}>
              <div className="flex items-center gap-3 mb-1.5">
                <Avatar employee={employee} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{employee.name}</div>
                  <div className="text-[11px] text-slate-500 truncate">{employee.role}</div>
                </div>
                <div className="text-right flex-none">
                  <div className="text-sm font-semibold text-slate-900 tabular-nums">{pct}%</div>
                  <div className="text-[10px] text-slate-500">
                    {done}/{total}
                  </div>
                </div>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    pct === 100 ? "bg-emerald-400" : pct >= 60 ? "bg-indigo-400" : "bg-amber-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function UpcomingTimeOffCard({
  upcoming,
  windowDays,
  onNavigate,
}: {
  upcoming: UpcomingLeave[];
  windowDays: number;
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Upcoming time off</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Approved leave in the next {windowDays} days · plan rota accordingly
          </p>
        </div>
        <button
          onClick={() => onNavigate({ name: "holiday" })}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
          data-testid="button-dashboard-open-holiday-upcoming"
        >
          View calendar
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {upcoming.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500" data-testid="upcoming-leave-empty">
          Nobody on approved leave in the next {windowDays} days.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {upcoming.slice(0, 6).map(({ employee, leave }) => (
            <li
              key={`${employee.id}-${leave.id}`}
              className="p-4 flex items-center gap-3"
              data-testid={`row-upcoming-leave-${leave.id}`}
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
            </li>
          ))}
          {upcoming.length > 6 && (
            <li className="p-3 text-center text-xs text-slate-500">
              +{upcoming.length - 6} more in the window
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function TeamSnapshotCard({
  employees,
  onNavigate,
}: {
  employees: Employee[];
  onNavigate: (view: View) => void;
}) {
  const activeStatuses = ["Active", "On Leave", "Probation"] as const;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="p-5 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-900">Team snapshot</h2>
        <p className="text-xs text-slate-500 mt-0.5">Status across the active workforce</p>
      </div>
      <div className="p-5 space-y-4">
        {activeStatuses.map((s) => {
          const count = employees.filter((e) => e.status === s).length;
          const pct = employees.length ? Math.round((count / employees.length) * 100) : 0;
          return (
            <div key={s} data-testid={`row-status-${s.toLowerCase().replace(/\s/g, "-")}`}>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span className="text-slate-700">{s}</span>
                <span className="text-slate-500 tabular-nums">
                  {count} <span className="text-xs text-slate-400">· {pct}%</span>
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    s === "Active" ? "bg-emerald-400" : s === "On Leave" ? "bg-amber-400" : "bg-sky-400"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        <button
          onClick={() => onNavigate({ name: "directory" })}
          className="w-full mt-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 border border-indigo-100 bg-indigo-50/50 hover:bg-indigo-50 rounded-lg py-2 transition-colors"
          data-testid="button-go-to-directory"
        >
          Open directory
        </button>
      </div>
    </div>
  );
}

function RemindersCard({ reminders }: { reminders: Reminder[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
      <div className="p-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Automations & reminders</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Probation reviews, contract renewals and work anniversaries due in the next 30 days
          </p>
        </div>
      </div>
      {reminders.length === 0 ? (
        <div className="p-8 text-center text-sm text-slate-500" data-testid="reminders-empty">
          No reminders due in the next 30 days.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {reminders.map((r) => (
            <li
              key={r.id}
              className="p-5 flex items-start gap-4 hover:bg-slate-50/60 transition-colors"
              data-testid={`row-reminder-${r.id}`}
            >
              <div
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${severityClasses(r.severity)} flex-none mt-0.5`}
              >
                {r.type}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900">{r.message}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {r.employee} · Due {r.due}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  hint,
  testId,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "indigo" | "emerald" | "amber" | "rose";
  hint?: string;
  testId: string;
}) {
  const tones = {
    indigo: "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    rose: "bg-rose-50 text-rose-600",
  } as const;
  return (
    <div
      className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      data-testid={testId}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div className="text-2xl font-semibold text-slate-900" data-testid={`${testId}-value`}>
        {value}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {hint && <div className="text-xs text-slate-400 mt-2">{hint}</div>}
    </div>
  );
}
