import { useMemo, useState } from "react";
import { AlertTriangle, Clock, GraduationCap, ShieldCheck } from "lucide-react";
import { useHR } from "./hr-context";
import { Avatar } from "./avatar";
import { StatCard } from "./dashboard-page";
import { docStatusBadge } from "./helpers";
import type { Employee, DocStatus } from "./_data";

type FilterId = "all" | "missing" | "expiring";

const FILTERS: { id: FilterId; label: string }[] = [
  { id: "all",      label: "All employees" },
  { id: "missing",  label: "Has missing" },
  { id: "expiring", label: "Has expiring" },
];

interface TrainingRow {
  employee: Employee;
  items: { id: string; name: string; status: DocStatus; updated: string }[];
  missing: number;
  expiring: number;
}

function buildRows(employees: Employee[]): TrainingRow[] {
  return employees
    .filter((e) => e.status !== "Archived")
    .map((employee) => {
      const items = employee.documents
        .filter((d) => d.category === "Training")
        .map((d) => ({ id: d.id, name: d.name, status: d.status, updated: d.updated }));
      return {
        employee,
        items,
        missing:  items.filter((i) => i.status === "Missing").length,
        expiring: items.filter((i) => i.status === "Expiring Soon").length,
      };
    });
}

export function TrainingPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees } = useHR();
  const [filter, setFilter] = useState<FilterId>("all");

  const rows = useMemo(() => buildRows(employees), [employees]);

  const totals = useMemo(() => {
    const allItems = rows.flatMap((r) => r.items);
    return {
      records:  allItems.length,
      missing:  allItems.filter((i) => i.status === "Missing").length,
      expiring: allItems.filter((i) => i.status === "Expiring Soon").length,
      compliant:
        rows.length === 0
          ? 0
          : Math.round(
              (rows.filter((r) => r.missing === 0 && r.expiring === 0).length / rows.length) * 100,
            ),
    };
  }, [rows]);

  const visible = useMemo(() => {
    if (filter === "missing")  return rows.filter((r) => r.missing > 0);
    if (filter === "expiring") return rows.filter((r) => r.expiring > 0);
    return rows;
  }, [rows, filter]);

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="hr-v2-training">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Training records"
          value={totals.records}
          icon={GraduationCap}
          tone="indigo"
          hint="Across the active workforce"
          testId="card-training-records"
        />
        <StatCard
          label="Branch compliance"
          value={`${totals.compliant}%`}
          icon={ShieldCheck}
          tone="emerald"
          hint="Employees with no gaps"
          testId="card-training-compliance"
        />
        <StatCard
          label="Missing"
          value={totals.missing}
          icon={AlertTriangle}
          tone="rose"
          hint="Action required"
          testId="card-training-missing"
        />
        <StatCard
          label="Expiring soon"
          value={totals.expiring}
          icon={Clock}
          tone="amber"
          hint="Renew before they lapse"
          testId="card-training-expiring"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Per-employee training</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              ATOL, GDPR, safeguarding and other compliance certificates
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5" data-testid="training-filters">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filter === f.id
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                }`}
                data-testid={`training-filter-${f.id}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500" data-testid="training-empty">
            No records match this filter.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {visible.map((row) => (
              <li
                key={row.employee.id}
                className="p-5 flex items-start gap-4"
                data-testid={`row-training-${row.employee.id}`}
              >
                <Avatar employee={row.employee} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900 truncate">
                        {row.employee.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate">{row.employee.role}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-none">
                      {row.missing > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200"
                          data-testid={`training-missing-count-${row.employee.id}`}
                        >
                          {row.missing} missing
                        </span>
                      )}
                      {row.expiring > 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200"
                          data-testid={`training-expiring-count-${row.employee.id}`}
                        >
                          {row.expiring} expiring
                        </span>
                      )}
                      {row.missing === 0 && row.expiring === 0 && row.items.length > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200">
                          Compliant
                        </span>
                      )}
                      {row.items.length === 0 && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border bg-slate-50 text-slate-600 border-slate-200">
                          No records
                        </span>
                      )}
                    </div>
                  </div>

                  {row.items.length > 0 && (
                    <ul className="space-y-1.5">
                      {row.items.map((item) => (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 text-xs"
                          data-testid={`training-item-${row.employee.id}-${item.id}`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-800 truncate">{item.name}</div>
                            <div className="text-[11px] text-slate-500">Updated {item.updated}</div>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-medium border flex-none ${docStatusBadge(item.status)}`}
                          >
                            {item.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-3">
                    <button
                      onClick={() => onOpenProfile(row.employee.id)}
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                      data-testid={`button-training-open-${row.employee.id}`}
                    >
                      Open profile →
                    </button>
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
