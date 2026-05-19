import { useMemo, useState } from "react";
import {
  Briefcase,
  Building2,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  ShieldCheck,
  Thermometer,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { hrApi } from "@/api/endpoints/hr.api";
import type { EmployeeDetail, LeaveEntry } from "@/api/endpoints/hr.api";
import { useMyHrRecord } from "@/hooks/queries";
import { RequestLeaveDialog } from "./components/request-leave-dialog";

const DOCUMENT_CATEGORIES = ["Contract", "NDA", "Right to Work", "Policies", "Training", "Other"] as const;

function leaveStatusBadge(status: LeaveEntry["status"]): string {
  switch (status) {
    case "Approved":  return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Pending":   return "bg-amber-50 text-amber-700 border-amber-200";
    case "Rejected":  return "bg-rose-50 text-rose-700 border-rose-200";
    case "Cancelled": return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

function leaveStatusIcon(status: LeaveEntry["status"]) {
  switch (status) {
    case "Approved":  return CheckCircle2;
    case "Pending":   return Clock;
    case "Rejected":  return XCircle;
    case "Cancelled": return XCircle;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function leaveDays(entry: LeaveEntry): number {
  const from = new Date(entry.from);
  const to = new Date(entry.to);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

export default function MyProfilePage() {
  const { data, isLoading, isError, error } = useMyHrRecord();
  const [leaveOpen, setLeaveOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="my-profile-loading">
        <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-8 text-sm text-rose-600" data-testid="my-profile-error">
        {error instanceof Error ? error.message : "Couldn't load your profile."}
      </div>
    );
  }

  return (
    <>
      <MyProfileContent data={data} onRequestLeave={() => setLeaveOpen(true)} />
      <RequestLeaveDialog open={leaveOpen} onOpenChange={setLeaveOpen} />
    </>
  );
}

function MyProfileContent({
  data,
  onRequestLeave,
}: {
  data: EmployeeDetail;
  onRequestLeave: () => void;
}) {
  const initials = useMemo(() => {
    const parts = data.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [data.name]);

  const allowance = data.holidayAllowance ?? 0;
  const used = data.holidayUsedDays ?? 0;
  const remaining = Math.max(0, allowance - used);
  const usedPct = allowance > 0 ? Math.round((used / allowance) * 100) : 0;
  const sickYTD = useMemo(() => {
    const year = new Date().getFullYear();
    return data.holidays
      .filter((h) => h.type === "Sick" && h.status === "Approved")
      .filter((h) => {
        const from = new Date(h.from);
        return !Number.isNaN(from.getTime()) && from.getFullYear() === year;
      })
      .reduce((sum, h) => sum + leaveDays(h), 0);
  }, [data.holidays]);

  const sortedLeaves = useMemo(() => {
    return [...data.holidays].sort((a, b) => {
      const ad = new Date(a.from).getTime();
      const bd = new Date(b.from).getTime();
      return bd - ad;
    });
  }, [data.holidays]);

  const groupedDocs = useMemo(() => {
    const map = new Map<string, EmployeeDetail["documents"]>();
    for (const cat of DOCUMENT_CATEGORIES) map.set(cat, []);
    for (const d of data.documents) {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return Array.from(map.entries()).filter(([, docs]) => docs.length > 0);
  }, [data.documents]);

  return (
    <div className="p-4 md:p-8 space-y-6" data-testid="my-profile-root">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 flex flex-col md:flex-row md:items-center gap-5">
          <div
            className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl font-semibold flex-none"
            data-testid="my-profile-avatar"
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-slate-900" data-testid="my-profile-name">
              {data.name}
            </h1>
            <div className="text-sm text-slate-600 mt-0.5">{data.orgRole.replace(/_/g, " ")}</div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 mt-4 text-xs text-slate-500">
              <Field icon={Building2} value={data.branchName ?? "—"} />
              <Field icon={Mail} value={data.email} />
              <Field icon={Phone} value={data.phone || "—"} />
              <Field icon={MapPin} value={data.address ?? "—"} />
              <Field icon={Briefcase} value={`${data.employmentType}`} />
              <Field icon={CalendarCheck} value={`Started ${formatDate(data.startDate)}`} />
            </dl>
          </div>
          <div className="flex-none">
            <Button onClick={onRequestLeave} data-testid="button-open-request-leave">
              <Plus className="w-4 h-4 mr-2" />
              Request leave
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatTile
          label="Allowance"
          value={`${allowance}d`}
          tone="indigo"
          icon={CalendarDays}
          hint="Per year"
          testId="my-stat-allowance"
        />
        <StatTile
          label="Used"
          value={`${used}d`}
          tone="amber"
          icon={CalendarCheck}
          hint={`${usedPct}% of allowance`}
          testId="my-stat-used"
        />
        <StatTile
          label="Remaining"
          value={`${remaining}d`}
          tone="emerald"
          icon={CheckCircle2}
          hint="Still to book"
          testId="my-stat-remaining"
        />
        <StatTile
          label="Sick days YTD"
          value={`${sickYTD}d`}
          tone="rose"
          icon={Thermometer}
          hint={`${new Date().getFullYear()} approved sick leave`}
          testId="my-stat-sick"
        />
      </div>

      <Card title="My leaves" subtitle="Holiday and absence history with current status">
        {sortedLeaves.length === 0 ? (
          <Empty
            message="No leave requests yet. Use 'Request leave' to submit your first one."
            testId="my-leaves-empty"
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sortedLeaves.map((leave) => {
              const Icon = leaveStatusIcon(leave.status);
              return (
                <li
                  key={leave.id}
                  className="px-5 py-4 flex items-center gap-3"
                  data-testid={`row-my-leave-${leave.id}`}
                >
                  <Icon className="w-4 h-4 text-slate-400 flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 truncate">
                      {leave.type} · {leaveDays(leave)} day{leaveDays(leave) === 1 ? "" : "s"}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {formatDate(leave.from)} → {formatDate(leave.to)}
                      {leave.reason ? ` · ${leave.reason}` : ""}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${leaveStatusBadge(leave.status)} flex-none`}
                    data-testid={`my-leave-status-${leave.id}`}
                  >
                    {leave.status}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="My documents" subtitle="Files HR has uploaded against your record">
        {groupedDocs.length === 0 ? (
          <Empty
            message="No documents on file yet. HR will upload your contract and other paperwork here."
            testId="my-documents-empty"
          />
        ) : (
          <div className="divide-y divide-slate-100">
            {groupedDocs.map(([category, docs]) => (
              <div key={category} className="px-5 py-4" data-testid={`my-doc-category-${category.toLowerCase().replace(/\s/g, "-")}`}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4 text-indigo-500" />
                  <h4 className="text-sm font-semibold text-slate-800">{category}</h4>
                  <span className="text-xs text-slate-400">({docs.length})</span>
                </div>
                <ul className="space-y-2">
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3"
                      data-testid={`row-my-doc-${d.id}`}
                    >
                      <FileText className="w-4 h-4 text-slate-400 flex-none" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                        <div className="text-xs text-slate-500">Updated {formatDate(d.uploadedAt)}</div>
                      </div>
                      <a
                        href={hrApi.documentDownloadUrl(data.userId, d.id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700"
                        data-testid={`button-my-doc-download-${d.id}`}
                      >
                        <Download className="w-3.5 h-3.5" />
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Field({
  icon: Icon,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Icon className="w-3.5 h-3.5 text-slate-400 flex-none" />
      <span className="truncate">{value}</span>
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
  icon: Icon,
  hint,
  testId,
}: {
  label: string;
  value: string | number;
  tone: "indigo" | "emerald" | "amber" | "rose";
  icon: React.ComponentType<{ className?: string }>;
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
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid={testId}>
      <div className={`w-10 h-10 rounded-xl ${tones[tone]} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="text-2xl font-semibold text-slate-900 tabular-nums" data-testid={`${testId}-value`}>
        {value}
      </div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      {hint && <div className="text-xs text-slate-400 mt-2">{hint}</div>}
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
