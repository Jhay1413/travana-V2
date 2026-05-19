import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Circle, Sparkles, UserPlus } from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { StatCard } from "./dashboard-page";
import { isNewStarter } from "./helpers";
import type { Employee } from "./_data";

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  missing?: boolean;
}

function deriveChecklist(employee: Employee): ChecklistItem[] {
  const has = (category: Employee["documents"][number]["category"]) =>
    employee.documents.some((d) => d.category === category && d.status === "Uploaded");
  const missing = (category: Employee["documents"][number]["category"]) =>
    employee.documents.some((d) => d.category === category && d.status === "Missing");

  return [
    { id: "contract",   label: "Contract signed",            done: has("Contract"),      missing: missing("Contract") },
    { id: "nda",        label: "NDA signed",                 done: has("NDA"),           missing: missing("NDA") },
    { id: "rtw",        label: "Right to work verified",     done: has("Right to Work"), missing: missing("Right to Work") },
    { id: "policies",   label: "Policies acknowledged",      done: has("Policies"),      missing: missing("Policies") },
    { id: "training",   label: "Training started",           done: has("Training"),      missing: missing("Training") },
  ];
}

function progressPct(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const done = items.filter((i) => i.done).length;
  return Math.round((done / items.length) * 100);
}

export function OnboardingPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees } = useHR();

  const starters = useMemo(
    () =>
      employees
        .filter(isNewStarter)
        .map((e) => {
          const checklist = deriveChecklist(e);
          return { employee: e, checklist, progress: progressPct(checklist) };
        })
        .sort((a, b) => a.progress - b.progress),
    [employees],
  );

  const totalStarters = starters.length;
  const completedCount = starters.filter((s) => s.progress === 100).length;
  const blockedCount = starters.filter((s) => s.checklist.some((i) => i.missing)).length;

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="hr-v2-onboarding">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="New starters"
          value={totalStarters}
          icon={UserPlus}
          tone="indigo"
          hint="Probation or joined < 90 days ago"
          testId="card-onboarding-total"
        />
        <StatCard
          label="Fully onboarded"
          value={completedCount}
          icon={CheckCircle2}
          tone="emerald"
          hint="All checklist items complete"
          testId="card-onboarding-complete"
        />
        <StatCard
          label="With missing items"
          value={blockedCount}
          icon={AlertTriangle}
          tone="rose"
          hint="Action required from HR"
          testId="card-onboarding-blocked"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="p-5 border-b border-slate-100 flex items-center gap-3">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <div>
            <h2 className="text-base font-semibold text-slate-900">New starter checklist</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Tracks contract, NDA, right-to-work, policies and training per joiner
            </p>
          </div>
        </div>

        {starters.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500" data-testid="onboarding-empty">
            No new starters in the last 90 days.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {starters.map(({ employee, checklist, progress }) => (
              <li
                key={employee.id}
                className="p-5"
                data-testid={`row-onboarding-${employee.id}`}
              >
                <div className="flex items-start gap-4">
                  <Avatar employee={employee} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 mb-1">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">
                          {employee.name}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                          {employee.role} · started {employee.startDate}
                          {employee.probationEnd ? ` · probation ends ${employee.probationEnd}` : ""}
                        </div>
                      </div>
                      <div className="text-right flex-none">
                        <div
                          className="text-sm font-semibold text-slate-900 tabular-nums"
                          data-testid={`onboarding-progress-${employee.id}`}
                        >
                          {progress}%
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {checklist.filter((i) => i.done).length}/{checklist.length} done
                        </div>
                      </div>
                    </div>

                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mt-2 mb-4">
                      <div
                        className={`h-full rounded-full ${
                          progress === 100 ? "bg-emerald-400" : progress >= 60 ? "bg-indigo-400" : "bg-amber-400"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                      {checklist.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center gap-2 text-xs"
                          data-testid={`onboarding-item-${employee.id}-${item.id}`}
                        >
                          {item.done ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-none" />
                          ) : item.missing ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-none" />
                          ) : (
                            <Circle className="w-3.5 h-3.5 text-slate-300 flex-none" />
                          )}
                          <span
                            className={`truncate ${
                              item.done
                                ? "text-slate-500 line-through"
                                : item.missing
                                ? "text-rose-700 font-medium"
                                : "text-slate-700"
                            }`}
                          >
                            {item.label}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mt-4">
                      <button
                        onClick={() => onOpenProfile(employee.id)}
                        className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        data-testid={`button-onboarding-open-${employee.id}`}
                      >
                        Open profile →
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
