import type {
  EmployeeRow as ApiEmployeeRow,
  EmployeeDetail as ApiEmployeeDetail,
  HrReminder as ApiReminder,
  LeaveEntry as ApiLeaveEntry,
  DocumentEntry as ApiDocumentEntry,
  NoteEntry as ApiNoteEntry,
  HrStatus as ApiHrStatus,
  EmploymentType as ApiEmploymentType,
  ContractType as ApiContractType,
  DocumentCategory as ApiDocumentCategory,
  InvitableRole,
} from "@/api/endpoints/hr.api";
import type { Employee, EmployeeStatus, DocStatus, DocumentItem, Reminder } from "./_data";

const EXPIRY_WARNING_DAYS = 30;
const NEW_STARTER_DAYS = 90;

/** Accept ISO strings, DD MMM YYYY, and similar; returns null if unparseable. */
export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value || value === "—") return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isNewStarter(employee: Employee): boolean {
  if (employee.status === "Probation") return true;
  if (employee.status === "Archived") return false;
  const start = parseFlexibleDate(employee.startDate);
  if (!start) return false;
  const days = (Date.now() - start.getTime()) / 86_400_000;
  return days <= NEW_STARTER_DAYS;
}

/**
 * Returns true if the employee has an approved holiday/leave entry covering
 * today (inclusive). Derived from real leave entries — independent of the
 * `status` field, which has to be manually flipped to "On Leave".
 */
export function isOnLeaveToday(employee: Employee, today: Date = new Date()): boolean {
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  for (const h of employee.holidays) {
    if (h.status !== "Approved") continue;
    const from = parseFlexibleDate(h.from);
    const to = parseFlexibleDate(h.to);
    if (!from || !to) continue;
    if (todayStart >= from.getTime() && todayStart <= to.getTime()) return true;
  }
  return false;
}

const AVATAR_TONES = [
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
  "bg-sky-100 text-sky-700",
  "bg-violet-100 text-violet-700",
  "bg-fuchsia-100 text-fuchsia-700",
  "bg-orange-100 text-orange-700",
  "bg-teal-100 text-teal-700",
];

export function pickAvatarTone(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function deriveInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function prettyRole(orgRole: string): string {
  switch (orgRole) {
    case "agent":          return "Travel Agent";
    case "homeworker":     return "Homeworker";
    case "branch_manager": return "Branch Manager";
    case "org_admin":      return "Admin";
    case "platform_admin": return "Platform Admin";
    case "referral_agent": return "Referral Agent";
    default:               return orgRole || "Staff";
  }
}

export function formatApiDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function toIsoDate(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function mapApiStatus(s: ApiHrStatus): EmployeeStatus {
  return s === "Terminated" ? "Archived" : s;
}

function mapApiHoliday(h: ApiLeaveEntry) {
  const days =
    Math.max(0, Math.round((new Date(h.to).getTime() - new Date(h.from).getTime()) / 86_400_000) + 1);
  const type: Employee["holidays"][number]["type"] =
    h.type === "Annual" ? "Holiday" : h.type === "Sick" ? "Sick" : "Other";
  const status: Employee["holidays"][number]["status"] =
    h.status === "Approved" ? "Approved" : h.status === "Rejected" ? "Rejected" : "Pending";
  return {
    id: h.id,
    type,
    from: formatApiDate(h.from),
    to: formatApiDate(h.to),
    days,
    status,
    reason: h.reason ?? undefined,
  };
}

function mapApiCategory(c: ApiDocumentCategory | undefined): DocumentItem["category"] {
  switch (c) {
    case "Contract":      return "Contract";
    case "NDA":           return "NDA";
    case "Right to Work": return "Right to Work";
    case "Policies":      return "Policies";
    case "Training":      return "Training";
    default:              return "Policies";
  }
}

function deriveDocStatus(d: ApiDocumentEntry): DocStatus {
  if (d.status === "Missing") return "Missing";
  if (d.expiresAt) {
    const expires = new Date(d.expiresAt);
    if (!Number.isNaN(expires.getTime())) {
      const daysUntil = Math.round((expires.getTime() - Date.now()) / 86_400_000);
      if (daysUntil <= EXPIRY_WARNING_DAYS) return "Expiring Soon";
    }
  }
  if (d.status === "Expiring Soon") return "Expiring Soon";
  return "Uploaded";
}

function mapApiDocument(d: ApiDocumentEntry): DocumentItem {
  return {
    id: d.id,
    name: d.name,
    category: mapApiCategory(d.category as ApiDocumentCategory | undefined),
    status: deriveDocStatus(d),
    updated: formatApiDate(d.uploadedAt),
  };
}

function mapApiNote(n: ApiNoteEntry) {
  return { id: n.id, author: n.author, date: formatApiDate(n.createdAt), body: n.body };
}

export function mapApiEmployee(row: ApiEmployeeRow & Partial<ApiEmployeeDetail>): Employee {
  const apiHolidays = row.holidays ?? [];
  const sickDaysYTD = apiHolidays
    .filter((h) => h.type === "Sick" && h.status === "Approved")
    .reduce((sum, h) => {
      const d = Math.max(0, Math.round((new Date(h.to).getTime() - new Date(h.from).getTime()) / 86_400_000) + 1);
      return sum + d;
    }, 0);
  return {
    id: row.userId,
    name: row.name,
    role: prettyRole(row.orgRole),
    team: row.branchName ?? "Unassigned",
    status: mapApiStatus(row.status),
    employmentType: row.employmentType,
    location: row.address ?? "—",
    email: row.email,
    phone: row.phone || "—",
    startDate: formatApiDate(row.startDate),
    probationEnd: row.probationEnd ? formatApiDate(row.probationEnd) : undefined,
    manager: row.managerName ?? "—",
    emergencyContact: {
      name: row.emergencyContactName ?? "—",
      relation: row.emergencyContactRelationship ?? "—",
      phone: row.emergencyContactPhone ?? "—",
    },
    avatarColor: pickAvatarTone(row.name),
    initials: deriveInitials(row.name),
    holidayAllowance: row.holidayAllowance ?? 0,
    holidayUsed: row.holidayUsedDays ?? 0,
    sickDaysYTD,
    documents: (row.documents ?? []).map(mapApiDocument),
    holidays: apiHolidays.map(mapApiHoliday),
    training: [],
    notes: (row.notes ?? []).map(mapApiNote),
    timeline: [],
    onboarding: [],
  };
}

export function mapApiReminder(r: ApiReminder): Reminder {
  const severity: Reminder["severity"] = r.severity === "urgent" ? "high" : r.severity === "warning" ? "medium" : "low";
  const type: Reminder["type"] =
    r.kind === "probation_end" ? "Probation"
    : r.kind === "contract_end" ? "Contract"
    : "Holiday";
  return {
    id: r.id,
    type,
    message: r.message,
    employee: r.employeeName,
    due: formatApiDate(r.dueDate),
    severity,
  };
}

export function statusBadgeClasses(status: EmployeeStatus): string {
  switch (status) {
    case "Active":   return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "On Leave": return "bg-amber-50 text-amber-700 border-amber-200";
    case "Probation":return "bg-sky-50 text-sky-700 border-sky-200";
    case "Archived": return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function docStatusBadge(status: DocStatus): string {
  switch (status) {
    case "Uploaded":      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Missing":       return "bg-rose-50 text-rose-700 border-rose-200";
    case "Expiring Soon": return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

export function severityClasses(severity: "high" | "medium" | "low"): string {
  switch (severity) {
    case "high":   return "bg-rose-50 text-rose-700 border-rose-200";
    case "medium": return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":    return "bg-sky-50 text-sky-700 border-sky-200";
  }
}

export const STATUS_OPTIONS:     ApiHrStatus[]     = ["Active", "Probation", "On Leave", "Terminated"];
export const EMPLOYMENT_OPTIONS: ApiEmploymentType[] = ["Full-time", "Part-time", "Contractor"];
export const CONTRACT_OPTIONS:   ApiContractType[]   = ["Permanent", "Fixed-term", "Casual"];

export const INVITE_ROLES: { value: InvitableRole; label: string }[] = [
  { value: "agent",          label: "Agent" },
  { value: "branch_manager", label: "Branch Manager" },
  { value: "homeworker",     label: "Homeworker" },
  { value: "referral_agent", label: "Referral Agent" },
];
