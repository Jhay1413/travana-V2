import {
  LayoutDashboard,
  Users,
  CalendarDays,
  FileText,
  Sparkles,
  GraduationCap,
  type LucideIcon,
} from "lucide-react";

export type ProfileTab = "overview" | "documents" | "holiday" | "notes";

export type View =
  | { name: "dashboard" }
  | { name: "directory" }
  | { name: "profile"; employeeId: string; tab?: ProfileTab }
  | { name: "holiday" }
  | { name: "documents" }
  | { name: "onboarding" }
  | { name: "training" };

type TabId = "dashboard" | "directory" | "onboarding" | "holiday" | "training" | "documents";

const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "dashboard",  label: "Dashboard",         icon: LayoutDashboard },
  { id: "directory",  label: "Directory",         icon: Users },
  { id: "onboarding", label: "Onboarding",        icon: Sparkles },
  { id: "holiday",    label: "Holiday & Absence", icon: CalendarDays },
  { id: "training",   label: "Training",          icon: GraduationCap },
  { id: "documents",  label: "Documents",         icon: FileText },
];

export function TabStrip({
  current,
  onNavigate,
}: {
  current: TabId;
  onNavigate: (view: View) => void;
}) {
  return (
    <div
      className="flex gap-1 overflow-x-auto border-b border-slate-200"
      data-testid="hr-v2-tabstrip"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = current === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onNavigate({ name: tab.id } as View)}
            data-testid={`tab-${tab.id}`}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              active
                ? "border-indigo-600 text-indigo-700"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <Icon className="w-4 h-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
