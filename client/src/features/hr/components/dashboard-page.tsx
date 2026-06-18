import { Users, UserPlus, CalendarDays, AlertTriangle } from "lucide-react";
import { useHR } from "./hr-context";
import { severityClasses } from "./helpers";
import { statuses } from "./_data";
import type { View } from "./sidebar";

export function DashboardPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { employees, reminders } = useHR();
  const totalEmployees = employees.filter((e) => e.status !== "Archived").length;
  const newStarters = employees.filter((e) => e.status === "Probation").length;
  const onLeaveToday = employees.filter((e) => e.status === "On Leave").length;
  const pendingApprovals = employees.reduce(
    (sum, e) => sum + e.holidays.filter((h) => h.status === "Pending").length,
    0,
  );
  const pendingTasks = reminders.length + pendingApprovals;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total employees" value={totalEmployees} icon={Users}
          tone="indigo" hint="Active across all teams" testId="card-stat-total-employees" />
        <StatCard label="New starters" value={newStarters} icon={UserPlus}
          tone="emerald" hint="In probation period" testId="card-stat-new-starters" />
        <StatCard label="On leave today" value={onLeaveToday} icon={CalendarDays}
          tone="amber" hint="Approved absence" testId="card-stat-on-leave" />
        <StatCard label="Pending HR tasks" value={pendingTasks} icon={AlertTriangle}
          tone="rose" hint="Across reminders & approvals" testId="card-stat-pending-tasks" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Automations & reminders</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Items the People team should action this week
              </p>
            </div>
            <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              data-testid="button-view-all-reminders">View all</button>
          </div>
          <ul className="divide-y divide-slate-100">
            {reminders.map((r) => (
              <li key={r.id}
                className="p-5 flex items-start gap-4 hover:bg-slate-50/60 transition-colors"
                data-testid={`row-reminder-${r.id}`}>
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${severityClasses(r.severity)} flex-none mt-0.5`}>
                  {r.type}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{r.message}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {r.employee} · Due {r.due}
                  </div>
                </div>
                <button className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-none"
                  data-testid={`button-reminder-action-${r.id}`}>Resolve</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="p-5 border-b border-slate-100">
            <h2 className="text-base font-semibold text-slate-900">Team snapshot</h2>
            <p className="text-xs text-slate-500 mt-0.5">Status across the active workforce</p>
          </div>
          <div className="p-5 space-y-4">
            {statuses.map((s) => {
              const count = employees.filter((e) => e.status === s).length;
              const pct = employees.length ? Math.round((count / employees.length) * 100) : 0;
              return (
                <div key={s} data-testid={`row-status-${s.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-700">{s}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s === "Active" ? "bg-emerald-400"
                        : s === "On Leave" ? "bg-amber-400"
                        : s === "Probation" ? "bg-sky-400"
                        : "bg-slate-300"
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
      </div>
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, tone, hint, testId,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  tone: "indigo" | "emerald" | "amber" | "rose";
  hint?: string;
  testId: string;
}) {
  const tones = {
    indigo:  "bg-indigo-50 text-indigo-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber:   "bg-amber-50 text-amber-600",
    rose:    "bg-rose-50 text-rose-600",
  } as const;
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow"
      data-testid={testId}>
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
