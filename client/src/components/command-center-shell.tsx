import { useMemo, useState } from "react";
import { useLocation } from "wouter";
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
  Link2,
  ListChecks,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Ticket,
  Users,
} from "lucide-react";

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

  const nav = useMemo(() => {
    const base = [
      { key: "overview", label: "Overview", icon: LayoutGrid },
      { key: "clients", label: "Clients", icon: Users },
      { key: "enquiries", label: "Enquiries", icon: ClipboardList },
      { key: "quotes", label: "Quotes", icon: Sparkles },
      { key: "bookings", label: "Bookings", icon: Ticket },
    ];

    if (role === "Admin") {
      return [
        { key: "overview", label: "Overview", icon: LayoutGrid },
        { key: "org", label: "Organisation", icon: Building2 },
        { key: "users", label: "Users & Roles", icon: Shield },
        { key: "audit", label: "Audit", icon: Activity },
        { key: "settings", label: "Settings", icon: Settings2 },
      ];
    }

    if (role === "Manager") {
      return [
        { key: "overview", label: "Overview", icon: LayoutGrid },
        { key: "team", label: "Team Pipeline", icon: BarChart3 },
        { key: "coverage", label: "Coverage", icon: Compass },
        { key: "coaching", label: "Coaching", icon: BadgeCheck },
        { key: "reports", label: "Reports", icon: Activity },
      ];
    }

    if (role === "Homeworker") {
      return [
        { key: "overview", label: "Work Queue", icon: ListChecks },
        { key: "assigned", label: "Assigned Clients", icon: Users },
        { key: "callbacks", label: "Callbacks", icon: Phone },
        { key: "messages", label: "Messages", icon: MessageSquare },
      ];
    }

    if (role === "Referer") {
      return [
        { key: "overview", label: "Affiliate Hub", icon: Link2 },
        { key: "leads", label: "Leads", icon: Users },
        { key: "commission", label: "Commission", icon: CircleDollarSign },
        { key: "payouts", label: "Payouts", icon: Banknote },
      ];
    }

    return base;
  }, [role]);

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
                    <div className="truncate text-sm font-semibold" data-testid="text-brand-title">
                      Apple Travel
                    </div>
                    <div className="text-xs text-black/45 dark:text-white/45" data-testid="text-brand-subtitle">
                      Command Center
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs font-semibold text-black/70 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/7"
                      data-testid="button-role"
                      type="button"
                    >
                      <RoleBadgeIcon className="h-4 w-4" />
                      {rolePillLabel(role)}
                      <ChevronDown className="h-4 w-4 opacity-60" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end">
                    <DropdownMenuLabel>Role</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
                      <DropdownMenuItem key={r} onSelect={() => onRoleChange(r)} data-testid={`menu-role-${r.toLowerCase()}`}>
                        {r}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-4 grid gap-2" data-testid="menu-primary">
                {nav.map((item) => {
                  const isActive = item.key === active;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => {
                        if (item.key === "clients") navigate("/clients");
                        else navigate("/");
                      }}
                      className={
                        "group flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition active:scale-[0.99] " +
                        (isActive
                          ? "border-black/15 bg-black/7 text-black dark:border-white/15 dark:bg-white/10 dark:text-white"
                          : "border-black/10 bg-black/5 text-black/70 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/7")
                      }
                      data-testid={`link-nav-${item.key}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="text-sm font-semibold">{item.label}</span>
                      </div>
                      <ChevronRight className={"h-4 w-4 opacity-40 transition " + (isActive ? "translate-x-0.5" : "group-hover:translate-x-0.5")} />
                    </button>
                  );
                })}
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="grid gap-2" data-testid="menu-secondary">
                {[
                  { key: "whatsapp", label: "WhatsApp" },
                  { key: "email", label: "Email" },
                  { key: "phone", label: "Phone" },
                  { key: "calendar", label: "Calendar" },
                  { key: "tasks", label: "Tasks" },
                  { key: "notes", label: "Notes" },
                ].map((x) => (
                  <div
                    key={x.key}
                    className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                    data-testid={`row-connect-${x.key}`}
                  >
                    <span>{x.label}</span>
                    <span className="rounded-full border border-black/10 bg-black/5 px-2 py-0.5 text-[11px] dark:border-white/10 dark:bg-white/5">0</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-3">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="topbar-command-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div
                    className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-black/5 px-3 py-1 text-xs text-black/80 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                    data-testid="status-command-center"
                  >
                    <Globe className="h-4 w-4" />
                    Apple Travel · {role}
                  </div>
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
                    <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                      <span data-testid="text-theme-label">Light</span>
                      <Switch
                        data-testid="switch-theme"
                        checked={theme === "dark"}
                        onCheckedChange={() => onToggleTheme?.()}
                      />
                      <span className="text-black/45 dark:text-white/45" data-testid="text-theme-label-dark">
                        Dark
                      </span>
                    </div>

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

                    <button
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                      data-testid="button-notifications"
                      aria-label="Notifications"
                      type="button"
                    >
                      <Bell className="h-4 w-4" />
                    </button>
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
