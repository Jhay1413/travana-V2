import { useMemo, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Building2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Compass,
  Filter,
  Globe,
  LayoutGrid,
  LifeBuoy,
  Link2,
  ListChecks,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plane,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";
import { NotificationsDropdown } from "./notifications-dropdown";
import { fetchCurrentUser } from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";

import { cn } from "@/lib/utils";

export type Role = "Admin" | "Manager" | "Agent" | "Homeworker" | "Referer";

function getNavRoute(key: string): string {
  const routes: Record<string, string> = {
    overview: "/",
    clients: "/clients",
    tickets: "/tickets",
    enquiries: "/",
    quotes: "/",
    bookings: "/",
    "agent-settings": "/",
    "agent-overview": "/",
    org: "/",
    users: "/",
    audit: "/",
    settings: "/",
    team: "/",
    coverage: "/",
    coaching: "/",
    reports: "/",
    assigned: "/",
    callbacks: "/",
    messages: "/",
    leads: "/",
    commission: "/",
    payouts: "/",
  };
  return routes[key] || "/";
}

const RoleIcon = {
  Admin: Shield,
  Manager: BarChart3,
  Agent: Sparkles,
  Homeworker: ListChecks,
  Referer: Link2,
} as const;

function rolePillLabel(role: Role) {
  if (role === "Admin") return "Admin";
  if (role === "Manager") return "Manager";
  if (role === "Homeworker") return "Homeworker";
  if (role === "Referer") return "Referer";
  return "Agent";
}

export function CommandCenterShell({
  children,
  active = "overview",
  title,
  subtitle,
  query,
  onQuery,
  role,
  onRoleChange,
  theme = "light",
  onToggleTheme,
}: {
  children: React.ReactNode;
  active?: string;
  title: string;
  subtitle?: string;
  query?: string;
  onQuery?: (v: string) => void;
  role: Role;
  onRoleChange: (r: Role) => void;
  theme?: "light" | "dark";
  onToggleTheme?: () => void;
}) {
  const [, navigate] = useLocation();

  const { data: currentUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
  });

  type NavItem = { key: string; label: string; icon: React.ReactNode; children?: NavItem[] };
  type NavSection = { id: string; label: string; icon: React.ReactNode; items: NavItem[] };
  type NavStructure = { grouped: true; sections: NavSection[] } | { grouped: false; items: NavItem[] };

  const nav: NavStructure = useMemo(() => {
    const base: NavItem[] = [
      { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
      { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
      { key: "enquiries", label: "Enquiries", icon: <ClipboardList className="h-4 w-4" /> },
      { key: "quotes", label: "Quotes", icon: <Sparkles className="h-4 w-4" /> },
      { key: "bookings", label: "Bookings", icon: <Ticket className="h-4 w-4" /> },
      { key: "agent-settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
    ];

    if (role === "Admin") {
      return {
        grouped: true,
        sections: [
          {
            id: "admin",
            label: "Admin",
            icon: <Shield className="h-4 w-4" />,
            items: [
              { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
              { key: "org", label: "Organisation", icon: <Building2 className="h-4 w-4" /> },
              { key: "users", label: "Users & Roles", icon: <Shield className="h-4 w-4" /> },
              { key: "audit", label: "Audit", icon: <Activity className="h-4 w-4" /> },
              { key: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" />, children: [
                { key: "tour-operators", label: "Tour Operators", icon: <Plane className="h-4 w-4" /> },
                { key: "airports", label: "Airports", icon: <MapPin className="h-4 w-4" /> },
              ] },
            ],
          },
          {
            id: "agent",
            label: "Agent Tools",
            icon: <Users className="h-4 w-4" />,
            items: [
              { key: "agent-overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
              { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
              { key: "enquiries", label: "Enquiries", icon: <ClipboardList className="h-4 w-4" /> },
              { key: "quotes", label: "Quotes", icon: <Sparkles className="h-4 w-4" /> },
              { key: "bookings", label: "Bookings", icon: <Ticket className="h-4 w-4" /> },
              { key: "agent-settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
            ],
          },
        ],
      };
    }

    if (role === "Manager") {
      return { grouped: false, items: [
        { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
        { key: "team", label: "Team Pipeline", icon: <BarChart3 className="h-4 w-4" /> },
        { key: "coverage", label: "Coverage", icon: <Compass className="h-4 w-4" /> },
        { key: "coaching", label: "Coaching", icon: <BadgeCheck className="h-4 w-4" /> },
        { key: "reports", label: "Reports", icon: <Activity className="h-4 w-4" /> },
      ]};
    }

    if (role === "Homeworker") {
      return { grouped: false, items: [
        { key: "overview", label: "Work Queue", icon: <ListChecks className="h-4 w-4" /> },
        { key: "assigned", label: "Assigned Clients", icon: <Users className="h-4 w-4" /> },
        { key: "callbacks", label: "Callbacks", icon: <Phone className="h-4 w-4" /> },
        { key: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
      ]};
    }

    if (role === "Referer") {
      return { grouped: false, items: [
        { key: "overview", label: "Affiliate Hub", icon: <Link2 className="h-4 w-4" /> },
        { key: "leads", label: "Leads", icon: <Users className="h-4 w-4" /> },
        { key: "commission", label: "Commission", icon: <CircleDollarSign className="h-4 w-4" /> },
        { key: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
      ]};
    }

    return { grouped: false, items: base };
  }, [role]);

  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    const saved = sessionStorage.getItem("admin-nav-expanded");
    return saved ? JSON.parse(saved) : ["admin", "agent"];
  });
  
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const next = prev.includes(sectionId) 
        ? prev.filter(id => id !== sectionId)
        : [...prev, sectionId];
      sessionStorage.setItem("admin-nav-expanded", JSON.stringify(next));
      return next;
    });
  };

  const RoleBadgeIcon = RoleIcon[role] ?? Sparkles;

  return (
    <div className={cn(theme === "dark" ? "dark" : "", "app-shell px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4")}>\
      <div className="w-full space-y-3">
        <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
          <aside className="hidden lg:block" data-testid="nav-command-center">
            <div className="glass ringed grain sticky top-4 rounded-3xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    data-testid="img-brand-mark"
                  >
                    <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
                    <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
                  </div>
                  <div className="min-w-0">
                    <div className="title-serif truncate text-sm font-semibold" data-testid="text-brand-title">
                      Travana
                    </div>
                    <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-brand-subtitle">
                      Command Center
                    </div>
                  </div>
                </div>

                <select
                  value={role}
                  onChange={(e) => onRoleChange(e.target.value as Role)}
                  className="rounded-2xl border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                  data-testid="select-role-nav"
                >
                  {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
                    <option key={r} value={r} className="text-black bg-white">
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <nav className="space-y-1">
                {nav.grouped ? (
                  nav.sections.map((section) => {
                    const isExpanded = expandedSections.includes(section.id);
                    return (
                      <div key={section.id} className="space-y-1">
                        <button
                          type="button"
                          onClick={() => toggleSection(section.id)}
                          className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white"
                          data-testid={`nav-section-${section.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                              <span className="text-black/70 dark:text-white/80">{section.icon}</span>
                            </span>
                            <span className="text-sm font-semibold">{section.label}</span>
                          </div>
                          <motion.div
                            animate={{ rotate: isExpanded ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronRight className="h-4 w-4 text-black/35 dark:text-white/40" />
                          </motion.div>
                        </button>
                        <AnimatePresence initial={false}>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden pl-4"
                            >
                              {section.items.map((item) => {
                                const isActive = active === item.key;
                                const hasChildren = item.children && item.children.length > 0;
                                const childActive = hasChildren && item.children!.some((c) => active === c.key);
                                return (
                                  <div key={item.key}>
                                    <Link
                                      href={getNavRoute(item.key)}
                                      className={
                                        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                                        (isActive || childActive
                                          ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                          : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                                      }
                                      data-testid={`nav-${item.key}`}
                                    >
                                      <div className="flex items-center gap-3">
                                        <span
                                          className={
                                            "inline-flex h-7 w-7 items-center justify-center rounded-lg border " +
                                            (isActive || childActive
                                              ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                                              : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                                          }
                                          aria-hidden
                                        >
                                          <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                                        </span>
                                        <span className="text-sm font-medium">{item.label}</span>
                                      </div>
                                      <ChevronRight
                                        className={"h-4 w-4 " + (isActive || childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")}
                                      />
                                    </Link>
                                    {hasChildren && (isActive || childActive) && (
                                      <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                        {item.children!.map((child) => (
                                          <button
                                            key={child.key}
                                            type="button"
                                            onClick={() => navigate("/")}
                                            className={
                                              "flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition " +
                                              (active === child.key
                                                ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                                : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white")
                                            }
                                            data-testid={`nav-${child.key}`}
                                          >
                                            <span className="text-black/60 dark:text-white/60">{child.icon}</span>
                                            <span>{child.label}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  nav.items.map((item) => {
                    const isActive = active === item.key;
                    return (
                      <Link
                        key={item.key}
                        href={getNavRoute(item.key)}
                        className={
                          "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                          (isActive
                            ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                            : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                        }
                        data-testid={`nav-${item.key}`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={
                              "inline-flex h-8 w-8 items-center justify-center rounded-xl border " +
                              (isActive
                                ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                                : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                            }
                            aria-hidden
                          >
                            <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                          </span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <ChevronRight
                          className={"h-4 w-4 " + (isActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")}
                        />
                      </Link>
                    );
                  })
                )}
              </nav>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <button
                className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                data-testid="button-support"
              >
                <div className="flex items-center gap-3">
                  <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <LifeBuoy className="h-4 w-4 text-black/70 dark:text-white/80" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-support-title">TheHub</div>
                    <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-support-sub">
                      Profile, News & Training
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
              </button>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="flex items-center gap-3 px-3">
                <div
                  className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                  data-testid="img-connect-mark"
                >
                  <MessageSquare className="h-5 w-5 text-black/70 dark:text-white/85" />
                  <span className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5 dark:ring-white/5" />
                </div>
                <div className="min-w-0">
                  <div className="title-serif truncate text-sm font-semibold" data-testid="text-connect-name">
                    Connect
                  </div>
                  <div className="truncate text-xs text-black/55 dark:text-white/55" data-testid="text-connect-sub">
                    Channels & conversations
                  </div>
                </div>
              </div>
              <Separator className="mt-3 mb-1 bg-black/10 dark:bg-white/10" data-testid="separator-connect" />

              <div className="space-y-1" data-testid="section-connect">
                {["whatsapp", "facebook", "tickets", "instagram", "email", "internal-chat"].map((key) => {
                  const map: Record<string, { label: string; icon: React.ReactNode }> = {
                    whatsapp: { label: "WhatsApp", icon: <MessageSquare className="h-4 w-4" /> },
                    facebook: { label: "Facebook", icon: <Users className="h-4 w-4" /> },
                    tickets: { label: "Tickets", icon: <LifeBuoy className="h-4 w-4" /> },
                    instagram: { label: "Instagram", icon: <Sparkles className="h-4 w-4" /> },
                    email: { label: "Email", icon: <Mail className="h-4 w-4" /> },
                    "internal-chat": { label: "Live Chat", icon: <MessageSquare className="h-4 w-4" /> },
                  };
                  const item = map[key];
                  const awaitingMap: Record<string, number> = {
                    whatsapp: 43,
                    facebook: 2,
                    tickets: 6,
                    instagram: 0,
                    email: 9,
                    "internal-chat": 4,
                  };
                  const awaiting = awaitingMap[key] ?? 0;

                  const connectRoutes: Record<string, string> = {
                    whatsapp: "/",
                    facebook: "/",
                    tickets: "/tickets",
                    instagram: "/",
                    email: "/",
                    "internal-chat": "/",
                  };
                  const isConnectActive = active === key || (key === "tickets" && active === "tickets");
                  return (
                    <button
                      key={key}
                      onClick={() => navigate(connectRoutes[key] || "/")}
                      className={
                        "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                        (isConnectActive
                          ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                          : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                      }
                      data-testid={`nav-connect-${key}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={
                          "inline-flex h-7 w-7 items-center justify-center rounded-lg border " +
                          (isConnectActive
                            ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                            : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                        } aria-hidden>
                          <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                        </span>
                        <span className="text-sm font-medium">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {awaiting > 0 && (
                          <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white">
                            {awaiting}
                          </span>
                        )}
                        <ChevronRight className="h-4 w-4 text-black/35 dark:text-white/40" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-3">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="topbar-command-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-baseline gap-3">
                    <h1 className="title-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="text-page-title">
                      {title}
                    </h1>
                    {subtitle ? (
                      <span className="hidden md:inline text-xs text-black/45 dark:text-white/45" data-testid="text-page-hint">
                        {subtitle}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-[360px]">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50" />
                    <Input
                      value={query ?? ""}
                      onChange={(e) => onQuery?.(e.target.value)}
                      placeholder="Search clients, trips, destinations…"
                      className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
                      data-testid="input-search"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      className="h-10 rounded-2xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                      data-testid="button-filter"
                    >
                      <Filter className="mr-2 h-4 w-4" />
                      Filters
                    </Button>

                    <Button
                      className="h-10 rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                      data-testid="button-primary-action"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create
                    </Button>

                    {currentUser && (
                      <NotificationsDropdown userId={currentUser.id} />
                    )}
                  </div>
                </div>
              </div>
            </Card>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
