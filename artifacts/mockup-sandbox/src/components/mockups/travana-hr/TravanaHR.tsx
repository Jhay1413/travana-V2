import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  GraduationCap,
  Settings,
  Search,
  Bell,
  ChevronDown,
  Plane,
  ArrowLeft,
  Plus,
  Upload,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Circle,
  CalendarCheck,
  StickyNote,
  History,
  Award,
  UserCheck,
  UserPlus,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import {
  employees as initialEmployees,
  reminders,
  roles,
  locations,
  statuses,
  type Employee,
  type EmployeeStatus,
  type DocStatus,
} from "./_data";

interface HRContextValue {
  employees: Employee[];
  approveLeave: (empId: string, leaveId: string) => void;
  rejectLeave: (empId: string, leaveId: string) => void;
  addNote: (empId: string, body: string) => void;
  toggleOnboarding: (empId: string, itemId: string) => void;
  uploadDocument: (empId: string, name: string) => void;
}

const HRContext = createContext<HRContextValue | null>(null);

function useHR(): HRContextValue {
  const ctx = useContext(HRContext);
  if (!ctx) throw new Error("HRContext missing");
  return ctx;
}

type View =
  | { name: "dashboard" }
  | { name: "directory" }
  | { name: "profile"; employeeId: string; tab?: ProfileTab }
  | { name: "holiday" }
  | { name: "documents" }
  | { name: "training" }
  | { name: "settings" };

type ProfileTab = "overview" | "documents" | "holiday" | "training" | "notes" | "timeline";

const navItems = [
  { id: "dashboard", label: "HR Dashboard", icon: LayoutDashboard },
  { id: "directory", label: "Employee Directory", icon: Users },
  { id: "holiday", label: "Holiday & Absence", icon: CalendarDays },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "training", label: "Training", icon: GraduationCap },
  { id: "settings", label: "Settings", icon: Settings },
] as const;

function statusBadgeClasses(status: EmployeeStatus): string {
  switch (status) {
    case "Active":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "On Leave":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "Probation":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "Archived":
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function docStatusBadge(status: DocStatus): string {
  switch (status) {
    case "Uploaded":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "Missing":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "Expiring Soon":
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function severityClasses(severity: "high" | "medium" | "low"): string {
  switch (severity) {
    case "high":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "medium":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "low":
      return "bg-sky-50 text-sky-700 border-sky-200";
  }
}

function Avatar({ employee, size = "md" }: { employee: Employee; size?: "sm" | "md" | "lg" }) {
  const sz =
    size === "lg"
      ? "w-16 h-16 text-lg"
      : size === "sm"
        ? "w-8 h-8 text-xs"
        : "w-10 h-10 text-sm";
  return (
    <div
      className={`${sz} ${employee.avatarColor} rounded-full flex items-center justify-center font-semibold flex-none`}
      data-testid={`avatar-${employee.id}`}
    >
      {employee.initials}
    </div>
  );
}

function Sidebar({
  current,
  onNavigate,
}: {
  current: View["name"];
  onNavigate: (view: View) => void;
}) {
  return (
    <aside className="hidden md:flex w-64 flex-none flex-col border-r border-slate-200 bg-white">
      <div className="px-6 py-6 border-b border-slate-100 flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 flex items-center justify-center text-white shadow-sm">
          <Plane className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-slate-900 leading-tight" data-testid="text-brand-name">
            Travana
          </div>
          <div className="text-xs text-slate-500 leading-tight">HR · Admin</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate({ name: item.id } as View)}
              data-testid={`link-nav-${item.id}`}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-slate-100">
        <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-sky-50 border border-indigo-100 p-4">
          <div className="text-xs font-semibold text-indigo-900 mb-1">Need help?</div>
          <p className="text-xs text-indigo-700/80 leading-relaxed">
            Reach the People team at people@travana.co
          </p>
        </div>
      </div>
    </aside>
  );
}

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex-none bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-lg md:text-xl font-semibold text-slate-900 truncate" data-testid="text-page-title">
          {title}
        </h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-500 truncate">{subtitle}</p>}
      </div>
      <div className="hidden md:flex relative w-72 lg:w-96">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="search"
          placeholder="Search employees, documents…"
          data-testid="input-global-search"
          className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
        />
      </div>
      <button
        className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
        data-testid="button-notifications"
      >
        <Bell className="w-5 h-5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
      </button>
      <button
        className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        data-testid="button-user-menu"
      >
        <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-semibold">
          JP
        </div>
        <div className="hidden sm:block text-left">
          <div className="text-sm font-medium text-slate-900 leading-tight">Jordan Pierce</div>
          <div className="text-[11px] text-slate-500 leading-tight">HR Admin</div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>
    </header>
  );
}

function MobileNav({
  current,
  onNavigate,
}: {
  current: View["name"];
  onNavigate: (view: View) => void;
}) {
  return (
    <div className="md:hidden flex-none bg-white border-b border-slate-200 overflow-x-auto">
      <div className="flex gap-1 px-3 py-2 min-w-max">
        {navItems.map((item) => {
          const active = current === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate({ name: item.id } as View)}
              data-testid={`link-mobile-nav-${item.id}`}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                active
                  ? "bg-indigo-600 text-white"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function StatCard({
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

function DashboardPage({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { employees } = useHR();
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
        <StatCard
          label="Total employees"
          value={totalEmployees}
          icon={Users}
          tone="indigo"
          hint="Active across all teams"
          testId="card-stat-total-employees"
        />
        <StatCard
          label="New starters"
          value={newStarters}
          icon={UserPlus}
          tone="emerald"
          hint="In probation period"
          testId="card-stat-new-starters"
        />
        <StatCard
          label="On leave today"
          value={onLeaveToday}
          icon={CalendarDays}
          tone="amber"
          hint="Approved absence"
          testId="card-stat-on-leave"
        />
        <StatCard
          label="Pending HR tasks"
          value={pendingTasks}
          icon={AlertTriangle}
          tone="rose"
          hint="Across reminders & approvals"
          testId="card-stat-pending-tasks"
        />
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
            <button
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              data-testid="button-view-all-reminders"
            >
              View all
            </button>
          </div>
          <ul className="divide-y divide-slate-100">
            {reminders.map((r) => (
              <li
                key={r.id}
                className="p-5 flex items-start gap-4 hover:bg-slate-50/60 transition-colors"
                data-testid={`row-reminder-${r.id}`}
              >
                <div className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${severityClasses(r.severity)} flex-none mt-0.5`}>
                  {r.type}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{r.message}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {r.employee} · Due {r.due}
                  </div>
                </div>
                <button
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex-none"
                  data-testid={`button-reminder-action-${r.id}`}
                >
                  Resolve
                </button>
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
              const pct = Math.round((count / employees.length) * 100);
              return (
                <div key={s} data-testid={`row-status-${s.toLowerCase().replace(/\s/g, "-")}`}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-slate-700">{s}</span>
                    <span className="text-slate-500">{count}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        s === "Active"
                          ? "bg-emerald-400"
                          : s === "On Leave"
                            ? "bg-amber-400"
                            : s === "Probation"
                              ? "bg-sky-400"
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

function DirectoryPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees } = useHR();
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("All");
  const [status, setStatus] = useState<string>("All");
  const [location, setLocation] = useState<string>("All");

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      if (role !== "All" && e.role !== role) return false;
      if (status !== "All" && e.status !== status) return false;
      if (location !== "All" && e.location !== location) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !e.name.toLowerCase().includes(q) &&
          !e.role.toLowerCase().includes(q) &&
          !e.team.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [employees, search, role, status, location]);

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-4 md:p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role or team"
              data-testid="input-directory-search"
              className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <FilterSelect
              label="Role"
              value={role}
              onChange={setRole}
              options={["All", ...roles]}
              testId="select-filter-role"
            />
            <FilterSelect
              label="Status"
              value={status}
              onChange={setStatus}
              options={["All", ...statuses]}
              testId="select-filter-status"
            />
            <FilterSelect
              label="Location"
              value={location}
              onChange={setLocation}
              options={["All", ...locations]}
              testId="select-filter-location"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((e) => (
          <article
            key={e.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col"
            data-testid={`card-employee-${e.id}`}
          >
            <div className="flex items-start gap-3">
              <Avatar employee={e} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 truncate" data-testid={`text-name-${e.id}`}>
                  {e.name}
                </div>
                <div className="text-xs text-slate-500 truncate">{e.role}</div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeClasses(e.status)} flex-none`}
                data-testid={`status-${e.id}`}
              >
                {e.status}
              </span>
            </div>
            <dl className="mt-4 space-y-1.5 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                <span>{e.team}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{e.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-3.5 h-3.5 text-slate-400" />
                <span>Started {e.startDate}</span>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <button
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg py-2 transition-colors"
                data-testid={`button-contact-${e.id}`}
              >
                <Mail className="w-3.5 h-3.5" />
                Contact
              </button>
              <button
                onClick={() => onOpenProfile(e.id)}
                className="flex-1 inline-flex items-center justify-center text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg py-2 transition-colors"
                data-testid={`button-view-profile-${e.id}`}
              >
                View profile
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-sm text-slate-500 py-12">
            No employees match those filters.
          </div>
        )}
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  testId: string;
}) {
  return (
    <label className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
      <Filter className="w-3.5 h-3.5 text-slate-400" />
      <span className="text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="bg-transparent text-slate-800 text-xs font-medium focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProfilePage({
  employee,
  tab,
  onTabChange,
  onBack,
}: {
  employee: Employee;
  tab: ProfileTab;
  onTabChange: (t: ProfileTab) => void;
  onBack: () => void;
}) {
  const tabs: { id: ProfileTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "overview", label: "Overview", icon: UserCheck },
    { id: "documents", label: "Documents", icon: FileText },
    { id: "holiday", label: "Holiday & Absence", icon: CalendarDays },
    { id: "training", label: "Training", icon: GraduationCap },
    { id: "notes", label: "HR Notes", icon: StickyNote },
    { id: "timeline", label: "Timeline", icon: History },
  ];

  return (
    <div className="p-4 md:p-8 space-y-6">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
        data-testid="button-back-to-directory"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to directory
      </button>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-5">
          <Avatar employee={employee} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl font-semibold text-slate-900" data-testid="text-profile-name">
                {employee.name}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${statusBadgeClasses(employee.status)}`}
                data-testid="status-profile"
              >
                {employee.status}
              </span>
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {employee.role} · {employee.team}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> {employee.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> {employee.phone}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" /> {employee.location}
              </span>
            </div>
          </div>
          <div className="flex gap-2 flex-none">
            <button
              className="px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
              data-testid="button-profile-message"
            >
              Message
            </button>
            <button
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
              data-testid="button-profile-edit"
            >
              Edit profile
            </button>
          </div>
        </div>

        <div className="px-2 md:px-6 border-b border-slate-100 overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onTabChange(t.id)}
                  data-testid={`tab-${t.id}`}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-indigo-600 text-indigo-700"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-6 bg-slate-50/40">
          {tab === "overview" && <OverviewTab employee={employee} />}
          {tab === "documents" && <DocumentsTab employee={employee} />}
          {tab === "holiday" && <HolidayTab employee={employee} />}
          {tab === "training" && <TrainingTab employee={employee} />}
          {tab === "notes" && <NotesTab employee={employee} />}
          {tab === "timeline" && <TimelineTab employee={employee} />}
        </div>
      </div>
    </div>
  );
}

function OnboardingChecklist({ employee }: { employee: Employee }) {
  const { toggleOnboarding } = useHR();
  const done = employee.onboarding.filter((o) => o.done).length;
  const total = employee.onboarding.length;
  const pct = Math.round((done / total) * 100);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-onboarding">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Onboarding checklist</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {done} of {total} steps complete
          </p>
        </div>
        <div className="text-sm font-semibold text-indigo-600">{pct}%</div>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full mb-4 overflow-hidden">
        <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2.5">
        {employee.onboarding.map((o) => (
          <li key={o.id} data-testid={`onboarding-${o.id}`}>
            <button
              type="button"
              onClick={() => toggleOnboarding(employee.id, o.id)}
              className="w-full flex items-center gap-2.5 text-sm text-left rounded-md hover:bg-slate-50 -mx-1 px-1 py-0.5 transition-colors"
              data-testid={`button-onboarding-toggle-${o.id}`}
            >
              {o.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-none" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 flex-none" />
              )}
              <span className={o.done ? "text-slate-700 line-through decoration-slate-300" : "text-slate-500"}>
                {o.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function OverviewTab({ employee }: { employee: Employee }) {
  const fields: { label: string; value: string }[] = [
    { label: "Employment type", value: employee.employmentType },
    { label: "Start date", value: employee.startDate },
    { label: "Probation end", value: employee.probationEnd ?? "—" },
    { label: "Manager", value: employee.manager },
    { label: "Location", value: employee.location },
    { label: "Team", value: employee.team },
  ];
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-basic-details">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Basic details</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map((f) => (
              <div key={f.label}>
                <dt className="text-xs text-slate-500">{f.label}</dt>
                <dd className="text-sm font-medium text-slate-800 mt-0.5">{f.value}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-emergency-contact">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Emergency contact</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Name</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.name}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Relationship</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.relation}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Phone</div>
              <div className="font-medium text-slate-800">{employee.emergencyContact.phone}</div>
            </div>
          </div>
        </div>
      </div>
      <OnboardingChecklist employee={employee} />
    </div>
  );
}

function DocumentsTab({ employee }: { employee: Employee }) {
  const { uploadDocument } = useHR();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const grouped = useMemo(() => {
    const map = new Map<string, typeof employee.documents>();
    employee.documents.forEach((d) => {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    });
    return Array.from(map.entries());
  }, [employee]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Document hub</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Track contracts, policies and training certificates
          </p>
        </div>
        <button
          onClick={() => setUploadOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-upload-document"
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
      </div>
      {uploadOpen && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-2" data-testid="form-upload-document">
          <input
            type="text"
            value={uploadName}
            onChange={(e) => setUploadName(e.target.value)}
            placeholder="Document name"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            data-testid="input-upload-document-name"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setUploadOpen(false); setUploadName(""); }}
              className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg"
              data-testid="button-upload-document-cancel"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const name = uploadName.trim();
                if (!name) return;
                uploadDocument(employee.id, name);
                setUploadName("");
                setUploadOpen(false);
              }}
              disabled={!uploadName.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              data-testid="button-upload-document-confirm"
            >
              Save
            </button>
          </div>
        </div>
      )}
      <div className="space-y-4">
        {grouped.map(([category, docs]) => (
          <div
            key={category}
            className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden"
            data-testid={`card-doc-category-${category.toLowerCase().replace(/\s/g, "-")}`}
          >
            <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-indigo-500" />
              <h4 className="text-sm font-semibold text-slate-800">{category}</h4>
              <span className="text-xs text-slate-400">({docs.length})</span>
            </div>
            <ul className="divide-y divide-slate-100">
              {docs.map((d) => (
                <li
                  key={d.id}
                  className="px-5 py-3 flex items-center gap-4"
                  data-testid={`row-document-${d.id}`}
                >
                  <FileText className="w-4 h-4 text-slate-400 flex-none" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-800 truncate">{d.name}</div>
                    <div className="text-xs text-slate-500">Updated {d.updated}</div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${docStatusBadge(d.status)} flex-none`}
                    data-testid={`status-doc-${d.id}`}
                  >
                    {d.status}
                  </span>
                  <button
                    className="text-slate-400 hover:text-slate-600 p-1"
                    data-testid={`button-doc-more-${d.id}`}
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function HolidayTab({ employee }: { employee: Employee }) {
  const { approveLeave, rejectLeave } = useHR();
  const remaining = employee.holidayAllowance - employee.holidayUsed;
  const pct = Math.round((employee.holidayUsed / employee.holidayAllowance) * 100);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Holiday & absence</h3>
          <p className="text-xs text-slate-500 mt-0.5">Allowance, requests and sick log</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-request-leave"
        >
          <Plus className="w-4 h-4" />
          Request leave
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-allowance">
          <div className="text-xs text-slate-500 mb-1">Holiday allowance</div>
          <div className="text-2xl font-semibold text-slate-900">
            {employee.holidayUsed}
            <span className="text-base font-medium text-slate-400"> / {employee.holidayAllowance} days</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full mt-3 overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <div className="text-xs text-slate-500 mt-2">{remaining} days remaining</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-sick-days">
          <div className="text-xs text-slate-500 mb-1">Sick days YTD</div>
          <div className="text-2xl font-semibold text-slate-900">{employee.sickDaysYTD}</div>
          <div className="text-xs text-slate-500 mt-3">
            {employee.holidays.filter((h) => h.type === "Sick").length} entries logged
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-pending-approvals">
          <div className="text-xs text-slate-500 mb-1">Pending approvals</div>
          <div className="text-2xl font-semibold text-slate-900">
            {employee.holidays.filter((h) => h.status === "Pending").length}
          </div>
          <div className="text-xs text-slate-500 mt-3">Awaiting manager sign-off</div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm" data-testid="card-calendar">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-slate-800">Absence calendar 2026</h4>
          <span className="text-xs text-slate-400">Approved · Pending · Sick</span>
        </div>
        <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {months.map((m, i) => {
            const monthIdx = i + 1;
            const events = employee.holidays.filter((h) => {
              const match = h.from.match(/(\w{3})/);
              return match && months.indexOf(match[1]) + 1 === monthIdx;
            });
            const tone = events[0]
              ? events[0].type === "Sick"
                ? "bg-rose-100 text-rose-700"
                : events[0].status === "Pending"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              : "bg-slate-50 text-slate-400";
            return (
              <div
                key={m}
                className={`rounded-lg px-2 py-3 text-center text-xs font-medium ${tone}`}
                title={events.map((e) => `${e.type} ${e.from}–${e.to}`).join("\n")}
                data-testid={`calendar-month-${m.toLowerCase()}`}
              >
                {m}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <h4 className="text-sm font-semibold text-slate-800">Recent requests</h4>
        </div>
        <ul className="divide-y divide-slate-100">
          {employee.holidays.map((h) => (
            <li
              key={h.id}
              className="px-5 py-3 flex items-center gap-4"
              data-testid={`row-leave-${h.id}`}
            >
              <div
                className={`w-2 h-8 rounded-full flex-none ${
                  h.type === "Sick"
                    ? "bg-rose-400"
                    : h.status === "Pending"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">
                  {h.type} · {h.from} – {h.to}
                </div>
                <div className="text-xs text-slate-500">
                  {h.days} day{h.days === 1 ? "" : "s"}
                  {h.reason ? ` · ${h.reason}` : ""}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                  h.status === "Approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : h.status === "Pending"
                      ? "bg-amber-50 text-amber-700 border-amber-200"
                      : "bg-rose-50 text-rose-700 border-rose-200"
                }`}
                data-testid={`status-leave-${h.id}`}
              >
                {h.status}
              </span>
              {h.status === "Pending" && (
                <div className="flex gap-1.5 flex-none">
                  <button
                    onClick={() => rejectLeave(employee.id, h.id)}
                    className="px-2.5 py-1 text-[11px] font-medium text-rose-700 border border-rose-200 bg-white hover:bg-rose-50 rounded-md"
                    data-testid={`button-leave-reject-${h.id}`}
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => approveLeave(employee.id, h.id)}
                    className="px-2.5 py-1 text-[11px] font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md"
                    data-testid={`button-leave-approve-${h.id}`}
                  >
                    Approve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TrainingTab({ employee }: { employee: Employee }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Training & development</h3>
          <p className="text-xs text-slate-500 mt-0.5">Modules, certificates and progress</p>
        </div>
        <button
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-lg"
          data-testid="button-assign-training"
        >
          <Plus className="w-4 h-4" />
          Assign module
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {employee.training.map((t) => (
          <div
            key={t.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            data-testid={`card-training-${t.id}`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">{t.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{t.status}</div>
              </div>
              {t.status === "Completed" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Award className="w-3 h-3" /> Certified
                </span>
              )}
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  t.progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                }`}
                style={{ width: `${t.progress}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-slate-500">
              <span>{t.progress}% complete</span>
              {t.certificate && <span>{t.certificate}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotesTab({ employee }: { employee: Employee }) {
  const { addNote } = useHR();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const handleSave = () => {
    const body = noteBody.trim();
    if (!body) return;
    addNote(employee.id, body);
    setNoteBody("");
    setNoteOpen(false);
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">HR notes</h3>
          <p className="text-xs text-slate-500 mt-0.5">Private to People team only</p>
        </div>
        <button
          onClick={() => setNoteOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
          data-testid="button-add-note"
        >
          <Plus className="w-4 h-4" />
          Add note
        </button>
      </div>
      {noteOpen && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3" data-testid="form-add-note">
          <textarea
            value={noteBody}
            onChange={(e) => setNoteBody(e.target.value)}
            placeholder="Write a private HR note…"
            rows={3}
            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
            data-testid="input-note-body"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setNoteOpen(false); setNoteBody(""); }}
              className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-lg"
              data-testid="button-note-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!noteBody.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
              data-testid="button-note-save"
            >
              Save note
            </button>
          </div>
        </div>
      )}
      <ul className="space-y-3">
        {employee.notes.map((n) => (
          <li
            key={n.id}
            className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm"
            data-testid={`row-note-${n.id}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-slate-800">{n.author}</div>
              <div className="text-xs text-slate-400">{n.date}</div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{n.body}</p>
          </li>
        ))}
        {employee.notes.length === 0 && (
          <li className="text-sm text-slate-500 text-center py-8 border border-dashed border-slate-200 rounded-2xl bg-white">
            No notes logged yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function TimelineTab({ employee }: { employee: Employee }) {
  const iconFor = (type: string) => {
    switch (type) {
      case "Joined":
        return UserPlus;
      case "Document":
        return FileText;
      case "Leave":
        return CalendarDays;
      case "Training":
        return GraduationCap;
      case "Note":
        return StickyNote;
      case "Review":
        return ShieldCheck;
      default:
        return Clock;
    }
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900 mb-5">Timeline</h3>
      <ol className="relative border-l border-slate-200 ml-2 space-y-6">
        {employee.timeline.map((e) => {
          const Icon = iconFor(e.type);
          return (
            <li key={e.id} className="ml-6" data-testid={`timeline-${e.id}`}>
              <span className="absolute -left-3.5 w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 border border-white flex items-center justify-center">
                <Icon className="w-3.5 h-3.5" />
              </span>
              <div className="text-xs text-slate-400">{e.date}</div>
              <div className="text-sm font-semibold text-slate-800 mt-0.5">{e.title}</div>
              {e.detail && <div className="text-xs text-slate-500 mt-0.5">{e.detail}</div>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function HolidayPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees, approveLeave, rejectLeave } = useHR();
  const allRequests = employees.flatMap((e) =>
    e.holidays.map((h) => ({ ...h, employee: e })),
  );
  const pending = allRequests.filter((r) => r.status === "Pending");
  const approved = allRequests.filter((r) => r.status === "Approved");
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Pending approvals"
          value={pending.length}
          icon={Clock}
          tone="amber"
          testId="card-holiday-pending"
        />
        <StatCard
          label="Approved this year"
          value={approved.length}
          icon={CheckCircle2}
          tone="emerald"
          testId="card-holiday-approved"
        />
        <StatCard
          label="On leave today"
          value={employees.filter((e) => e.status === "On Leave").length}
          icon={CalendarDays}
          tone="indigo"
          testId="card-holiday-on-leave"
        />
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

function DocumentsPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees, uploadDocument } = useHR();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadEmpId, setUploadEmpId] = useState(employees[0]?.id ?? "");
  const [uploadName, setUploadName] = useState("");
  const allDocs = employees.flatMap((e) => e.documents.map((d) => ({ ...d, employee: e })));
  const missing = allDocs.filter((d) => d.status === "Missing");
  const expiring = allDocs.filter((d) => d.status === "Expiring Soon");

  const handleUpload = () => {
    const name = uploadName.trim();
    if (!name || !uploadEmpId) return;
    uploadDocument(uploadEmpId, name);
    setUploadName("");
    setUploadOpen(false);
  };
  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Documents on file"
          value={allDocs.length}
          icon={FileText}
          tone="indigo"
          testId="card-docs-total"
        />
        <StatCard
          label="Missing"
          value={missing.length}
          icon={AlertTriangle}
          tone="rose"
          testId="card-docs-missing"
        />
        <StatCard
          label="Expiring soon"
          value={expiring.length}
          icon={Clock}
          tone="amber"
          testId="card-docs-expiring"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Action required</h2>
          <button
            onClick={() => setUploadOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
            data-testid="button-upload-global"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
        </div>
        {uploadOpen && (
          <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row gap-2" data-testid="form-upload-global">
            <select
              value={uploadEmpId}
              onChange={(e) => setUploadEmpId(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              data-testid="select-upload-employee"
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
            <input
              type="text"
              value={uploadName}
              onChange={(e) => setUploadName(e.target.value)}
              placeholder="Document name"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              data-testid="input-upload-name"
            />
            <div className="flex gap-2">
              <button
                onClick={() => { setUploadOpen(false); setUploadName(""); }}
                className="px-3 py-2 text-sm font-medium text-slate-600 border border-slate-200 hover:bg-white rounded-lg"
                data-testid="button-upload-cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!uploadName.trim()}
                className="px-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                data-testid="button-upload-confirm"
              >
                Save
              </button>
            </div>
          </div>
        )}
        <ul className="divide-y divide-slate-100">
          {[...missing, ...expiring].map((d) => (
            <li
              key={`${d.employee.id}-${d.id}`}
              className="px-5 py-4 flex items-center gap-4"
              data-testid={`row-doc-action-${d.employee.id}-${d.id}`}
            >
              <Avatar employee={d.employee} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-500">
                  {d.employee.name} · {d.category}
                </div>
              </div>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${docStatusBadge(d.status)}`}
              >
                {d.status}
              </span>
              <button
                onClick={() => onOpenProfile(d.employee.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                data-testid={`button-doc-open-${d.employee.id}-${d.id}`}
              >
                Open
              </button>
            </li>
          ))}
          {missing.length + expiring.length === 0 && (
            <li className="p-6 text-center text-sm text-slate-500">All documents are up to date.</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function TrainingPage({ onOpenProfile }: { onOpenProfile: (id: string) => void }) {
  const { employees } = useHR();
  const allModules = employees.flatMap((e) => e.training.map((t) => ({ ...t, employee: e })));
  const completed = allModules.filter((t) => t.status === "Completed").length;
  const inProgress = allModules.filter((t) => t.status === "In progress").length;
  const notStarted = allModules.filter((t) => t.status === "Not started").length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Completed modules"
          value={completed}
          icon={Award}
          tone="emerald"
          testId="card-training-completed"
        />
        <StatCard
          label="In progress"
          value={inProgress}
          icon={Clock}
          tone="indigo"
          testId="card-training-in-progress"
        />
        <StatCard
          label="Not started"
          value={notStarted}
          icon={AlertTriangle}
          tone="amber"
          testId="card-training-not-started"
        />
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-base font-semibold text-slate-900">Training across the team</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {allModules.map((t) => (
            <li
              key={`${t.employee.id}-${t.id}`}
              className="px-5 py-4 flex items-center gap-4"
              data-testid={`row-training-${t.employee.id}-${t.id}`}
            >
              <Avatar employee={t.employee} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-800">{t.title}</div>
                <div className="text-xs text-slate-500">{t.employee.name}</div>
              </div>
              <div className="hidden sm:block w-36">
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      t.progress === 100 ? "bg-emerald-500" : "bg-indigo-500"
                    }`}
                    style={{ width: `${t.progress}%` }}
                  />
                </div>
                <div className="text-[11px] text-slate-400 mt-1">{t.progress}%</div>
              </div>
              <button
                onClick={() => onOpenProfile(t.employee.id)}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                data-testid={`button-training-open-${t.employee.id}-${t.id}`}
              >
                Open
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SettingsPage() {
  const sections: { title: string; description: string; testId: string }[] = [
    {
      title: "Company profile",
      description: "Travana Travel Group · UK & EU operations",
      testId: "card-settings-company",
    },
    {
      title: "Holiday policy",
      description: "Default 25 days + bank holidays · Carry over up to 5 days",
      testId: "card-settings-holiday",
    },
    {
      title: "Document templates",
      description: "Contracts, NDAs, right-to-work and policy templates",
      testId: "card-settings-documents",
    },
    {
      title: "Notifications",
      description: "Probation, document expiry and approval reminders",
      testId: "card-settings-notifications",
    },
    {
      title: "Permissions",
      description: "HR Admin, Manager and Employee role visibility",
      testId: "card-settings-permissions",
    },
    {
      title: "Integrations",
      description: "Connect calendar, e-signature and identity providers",
      testId: "card-settings-integrations",
    },
  ];
  return (
    <div className="p-4 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
      {sections.map((s) => (
        <div
          key={s.title}
          className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-start gap-4"
          data-testid={s.testId}
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-none">
            <Settings className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{s.description}</p>
            <button
              className="text-xs font-medium text-indigo-600 hover:text-indigo-700 mt-3"
              data-testid={`${s.testId}-manage`}
            >
              Manage
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TravanaHR() {
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);

  const updateEmployee = useCallback(
    (empId: string, updater: (emp: Employee) => Employee) => {
      setEmployees((prev) => prev.map((e) => (e.id === empId ? updater(e) : e)));
    },
    [],
  );

  const approveLeave = useCallback(
    (empId: string, leaveId: string) => {
      updateEmployee(empId, (e) => ({
        ...e,
        holidays: e.holidays.map((h) => (h.id === leaveId ? { ...h, status: "Approved" } : h)),
      }));
    },
    [updateEmployee],
  );

  const rejectLeave = useCallback(
    (empId: string, leaveId: string) => {
      updateEmployee(empId, (e) => ({
        ...e,
        holidays: e.holidays.map((h) => (h.id === leaveId ? { ...h, status: "Rejected" } : h)),
      }));
    },
    [updateEmployee],
  );

  const addNote = useCallback(
    (empId: string, body: string) => {
      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      updateEmployee(empId, (e) => ({
        ...e,
        notes: [
          { id: `n-${Date.now()}`, author: "Jordan Pierce", date: today, body },
          ...e.notes,
        ],
      }));
    },
    [updateEmployee],
  );

  const toggleOnboarding = useCallback(
    (empId: string, itemId: string) => {
      updateEmployee(empId, (e) => ({
        ...e,
        onboarding: e.onboarding.map((o) => (o.id === itemId ? { ...o, done: !o.done } : o)),
      }));
    },
    [updateEmployee],
  );

  const uploadDocument = useCallback(
    (empId: string, name: string) => {
      const today = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      updateEmployee(empId, (e) => ({
        ...e,
        documents: [
          ...e.documents,
          {
            id: `d-${Date.now()}`,
            name,
            category: "Policies",
            status: "Uploaded",
            updated: today,
          },
        ],
      }));
    },
    [updateEmployee],
  );

  const ctxValue = useMemo<HRContextValue>(
    () => ({ employees, approveLeave, rejectLeave, addNote, toggleOnboarding, uploadDocument }),
    [employees, approveLeave, rejectLeave, addNote, toggleOnboarding, uploadDocument],
  );

  const employee =
    view.name === "profile" ? employees.find((e) => e.id === view.employeeId) ?? employees[0] : null;
  const profileTab: ProfileTab = view.name === "profile" ? view.tab ?? "overview" : "overview";

  let title = "HR Dashboard";
  let subtitle: string | undefined = "Travana People · Snapshot of the team";
  if (view.name === "directory") {
    title = "Employee Directory";
    subtitle = `${employees.length} people across the business`;
  } else if (view.name === "profile" && employee) {
    title = employee.name;
    subtitle = `${employee.role} · ${employee.team}`;
  } else if (view.name === "holiday") {
    title = "Holiday & Absence";
    subtitle = "Approvals, calendar and sick log";
  } else if (view.name === "documents") {
    title = "Documents";
    subtitle = "Contracts, policies and certificates";
  } else if (view.name === "training") {
    title = "Training";
    subtitle = "Compliance and development modules";
  } else if (view.name === "settings") {
    title = "Settings";
    subtitle = "HR configuration and policies";
  }

  return (
    <HRContext.Provider value={ctxValue}>
    <div className="h-full min-h-screen flex bg-slate-50 text-slate-900 font-sans" data-testid="travana-hr-root">
      <Sidebar
        current={view.name === "profile" ? "directory" : view.name}
        onNavigate={setView}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} subtitle={subtitle} />
        <MobileNav
          current={view.name === "profile" ? "directory" : view.name}
          onNavigate={setView}
        />
        <main className="flex-1 overflow-y-auto">
          {view.name === "dashboard" && <DashboardPage onNavigate={setView} />}
          {view.name === "directory" && (
            <DirectoryPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id })} />
          )}
          {view.name === "profile" && employee && (
            <ProfilePage
              employee={employee}
              tab={profileTab}
              onTabChange={(t) => setView({ name: "profile", employeeId: employee.id, tab: t })}
              onBack={() => setView({ name: "directory" })}
            />
          )}
          {view.name === "holiday" && (
            <HolidayPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "holiday" })} />
          )}
          {view.name === "documents" && (
            <DocumentsPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "documents" })} />
          )}
          {view.name === "training" && (
            <TrainingPage onOpenProfile={(id) => setView({ name: "profile", employeeId: id, tab: "training" })} />
          )}
          {view.name === "settings" && <SettingsPage />}
        </main>
      </div>
    </div>
    </HRContext.Provider>
  );
}
