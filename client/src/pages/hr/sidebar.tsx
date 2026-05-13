import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Plane,
  Search,
  Bell,
  ChevronDown,
} from "lucide-react";

export type ProfileTab = "overview" | "documents" | "holiday" | "notes";

export type View =
  | { name: "dashboard" }
  | { name: "directory"; team?: string }
  | { name: "profile"; employeeId: string; tab?: ProfileTab }
  | { name: "holiday" }
  | { name: "documents" };

export const navItems = [
  { id: "dashboard", label: "HR Dashboard",      icon: LayoutDashboard },
  { id: "directory", label: "Employee Directory", icon: Users },
  { id: "holiday",   label: "Holiday & Absence",  icon: CalendarDays },
  { id: "documents", label: "Documents",          icon: FileText },
] as const;

export function Sidebar({
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

export function Header({ title, subtitle }: { title: string; subtitle?: string }) {
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

export function MobileNav({
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
