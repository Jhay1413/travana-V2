import { CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { StatCard } from "./dashboard-page";

export function HolidayPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees, approveLeave, rejectLeave } = useHR();
  const allRequests = employees.flatMap((e) =>
    e.holidays.map((h) => ({ ...h, employee: e })),
  );
  const pending = allRequests.filter((r) => r.status === "Pending");
  const approved = allRequests.filter((r) => r.status === "Approved");

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Pending approvals"   value={pending.length}                                     icon={Clock}        tone="amber"   testId="card-holiday-pending" />
        <StatCard label="Approved this year"  value={approved.length}                                    icon={CheckCircle2} tone="emerald" testId="card-holiday-approved" />
        <StatCard label="On leave today"      value={employees.filter((e) => e.status === "On Leave").length} icon={CalendarDays} tone="indigo"  testId="card-holiday-on-leave" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Pending approvals</h2>
          <span className="text-xs text-slate-500">{pending.length} requests</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {pending.map((r) => (
            <li
              key={`${r.employee.id}-${r.id}`}
              className="px-5 py-4 flex items-center gap-4"
              data-testid={`row-pending-${r.employee.id}-${r.id}`}
            >
              <Avatar employee={r.employee} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{r.employee.name}</div>
                <div className="text-xs text-slate-500">
                  {r.type} · {r.from} – {r.to} · {r.days} days{r.reason ? ` · ${r.reason}` : ""}
                </div>
              </div>
              <button
                onClick={() => onOpenProfile(r.employee.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                data-testid={`button-pending-view-${r.employee.id}-${r.id}`}
              >
                Open
              </button>
              <button
                onClick={() => rejectLeave(r.employee.id, r.id)}
                className="px-3 py-1.5 text-xs font-medium text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 rounded-lg"
                data-testid={`button-pending-reject-${r.employee.id}-${r.id}`}
              >
                Reject
              </button>
              <button
                onClick={() => approveLeave(r.employee.id, r.id)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg"
                data-testid={`button-pending-approve-${r.employee.id}-${r.id}`}
              >
                Approve
              </button>
            </li>
          ))}
          {pending.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-500">All caught up — no pending requests.</li>
          )}
        </ul>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Upcoming approved leave</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {approved.slice(0, 6).map((r) => (
            <li
              key={`${r.employee.id}-${r.id}`}
              className="px-5 py-4 flex items-center gap-4"
              data-testid={`row-approved-${r.employee.id}-${r.id}`}
            >
              <Avatar employee={r.employee} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{r.employee.name}</div>
                <div className="text-xs text-slate-500">
                  {r.type} · {r.from} – {r.to}
                </div>
              </div>
              <span className="text-xs text-slate-400">{r.days} days</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
