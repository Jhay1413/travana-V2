import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Bolt,
  Briefcase,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Command,
  Compass,
  FileText,
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
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Ticket,
  UserRound,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Role = "Admin" | "Manager" | "Agent" | "Homeworker" | "Referer";
type Stage = "Enquiry" | "Quote" | "Booked";

type Client = {
  id: string;
  name: string;
  tier: "Platinum" | "Gold" | "Standard";
  nextTrip: string;
  location: string;
  stage: Stage;
  value: number;
  lastTouch: string;
};

type Lead = {
  id: string;
  name: string;
  source: string;
  destination: string;
  value: number;
  status: "New" | "Contacted" | "Qualified" | "Converted";
};

type ActivityItem = {
  id: string;
  time: string;
  label: string;
  meta: string;
  type: "call" | "email" | "note" | "task";
};

const currency = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function stagePill(stage: Stage) {
  if (stage === "Booked")
    return "bg-emerald-500/18 text-emerald-900 border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-200 dark:border-emerald-500/20";
  if (stage === "Quote")
    return "bg-sky-500/18 text-sky-900 border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-200 dark:border-sky-500/20";
  return "bg-violet-500/18 text-violet-950 border-violet-500/30 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/20";
}

function tierPill(tier: Client["tier"]) {
  if (tier === "Platinum")
    return "bg-black/8 text-black border-black/20 dark:bg-white/10 dark:text-white dark:border-white/15";
  if (tier === "Gold")
    return "bg-amber-400/20 text-amber-950 border-amber-400/35 dark:bg-amber-400/15 dark:text-amber-200 dark:border-amber-400/20";
  return "bg-slate-900/8 text-slate-900 border-slate-900/18 dark:bg-slate-400/10 dark:text-slate-200 dark:border-slate-400/15";
}

const seedClients: Client[] = [
  {
    id: "C-1024",
    name: "Ava Chen",
    tier: "Platinum",
    nextTrip: "Kyoto & Hakone — 9 nights",
    location: "Japan",
    stage: "Booked",
    value: 18400,
    lastTouch: "Today",
  },
  {
    id: "C-2081",
    name: "Noah Patel",
    tier: "Gold",
    nextTrip: "Dolomites — 7 nights",
    location: "Italy",
    stage: "Quote",
    value: 9200,
    lastTouch: "Yesterday",
  },
  {
    id: "C-3099",
    name: "Sofia Martínez",
    tier: "Gold",
    nextTrip: "Patagonia — 12 nights",
    location: "Chile",
    stage: "Enquiry",
    value: 13200,
    lastTouch: "2d ago",
  },
  {
    id: "C-4112",
    name: "Ethan Brooks",
    tier: "Standard",
    nextTrip: "New York — 4 nights",
    location: "USA",
    stage: "Quote",
    value: 3800,
    lastTouch: "3d ago",
  },
  {
    id: "C-5120",
    name: "Mia Laurent",
    tier: "Platinum",
    nextTrip: "Bora Bora — 8 nights",
    location: "French Polynesia",
    stage: "Booked",
    value: 24600,
    lastTouch: "1w ago",
  },
];

const seedLeads: Lead[] = [
  {
    id: "L-001",
    name: "Jordan Kim",
    source: "Affiliate — Horizon Travel Blog",
    destination: "Iceland",
    value: 6400,
    status: "New",
  },
  {
    id: "L-002",
    name: "Priya Singh",
    source: "Referral — Existing client",
    destination: "Maldives",
    value: 14800,
    status: "Qualified",
  },
  {
    id: "L-003",
    name: "Liam O'Connor",
    source: "Affiliate — Apple Travel Partners",
    destination: "Barcelona",
    value: 4200,
    status: "Contacted",
  },
];

const seedActivity: ActivityItem[] = [
  {
    id: "A-01",
    time: "09:15",
    label: "Follow-up call — Noah Patel",
    meta: "Quote refresh + flight options",
    type: "call",
  },
  {
    id: "A-02",
    time: "10:40",
    label: "Enquiry received — Sofia Martínez",
    meta: "Two adults, flexible dates",
    type: "task",
  },
  {
    id: "A-03",
    time: "13:05",
    label: "Email sent — Ava Chen",
    meta: "Hotel confirmations + rail passes",
    type: "email",
  },
  {
    id: "A-04",
    time: "15:20",
    label: "Internal note — Mia Laurent",
    meta: "Prefers late checkouts, ocean-view",
    type: "note",
  },
];

function IconForActivity({ type }: { type: ActivityItem["type"] }) {
  const cls = "h-4 w-4";
  if (type === "call") return <Phone className={cls} />;
  if (type === "email") return <Mail className={cls} />;
  if (type === "task") return <Calendar className={cls} />;
  return <FileText className={cls} />;
}

function KpiCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <Card className="glass ringed grain rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-kpi-label-${id}`}>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-xl border border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
              {icon}
            </span>
            {label}
          </div>
          <div className="text-2xl font-semibold tracking-tight" data-testid={`text-kpi-value-${id}`}>
            {value}
          </div>
        </div>
        <div
          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 text-[11px] text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
          data-testid={`text-kpi-delta-${id}`}
        >
          {delta}
        </div>
      </div>
    </Card>
  );
}

function ShellNav({
  role,
  onRoleChange,
  active,
  onActiveChange,
}: {
  role: Role;
  onRoleChange: (r: Role) => void;
  active: string;
  onActiveChange: (k: string) => void;
}) {
  const nav = useMemo(() => {
    const base = [
      { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
      { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
      { key: "enquiries", label: "Enquiries", icon: <ClipboardList className="h-4 w-4" /> },
      { key: "quotes", label: "Quotes", icon: <Sparkles className="h-4 w-4" /> },
      { key: "bookings", label: "Bookings", icon: <Ticket className="h-4 w-4" /> },
    ];

    if (role === "Admin") {
      return [
        { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
        { key: "org", label: "Organisation", icon: <Building2 className="h-4 w-4" /> },
        { key: "users", label: "Users & Roles", icon: <Shield className="h-4 w-4" /> },
        { key: "audit", label: "Audit", icon: <Activity className="h-4 w-4" /> },
        { key: "settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
      ];
    }

    if (role === "Manager") {
      return [
        { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
        { key: "team", label: "Team Pipeline", icon: <BarChart3 className="h-4 w-4" /> },
        { key: "coverage", label: "Coverage", icon: <Compass className="h-4 w-4" /> },
        { key: "coaching", label: "Coaching", icon: <BadgeCheck className="h-4 w-4" /> },
        { key: "reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
      ];
    }

    if (role === "Homeworker") {
      return [
        { key: "overview", label: "Work Queue", icon: <ListChecks className="h-4 w-4" /> },
        { key: "assigned", label: "Assigned Clients", icon: <Users className="h-4 w-4" /> },
        { key: "callbacks", label: "Callbacks", icon: <Phone className="h-4 w-4" /> },
        { key: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
      ];
    }

    if (role === "Referer") {
      return [
        { key: "overview", label: "Affiliate Hub", icon: <Link2 className="h-4 w-4" /> },
        { key: "leads", label: "Leads", icon: <Users className="h-4 w-4" /> },
        { key: "commission", label: "Commission", icon: <CircleDollarSign className="h-4 w-4" /> },
        { key: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
      ];
    }

    return base;
  }, [role]);

  return (
    <aside className="hidden lg:block">
      <div className="space-y-3">
        <div className="glass ringed grain rounded-3xl p-4" data-testid="panel-brand">
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
                <div className="title-serif truncate text-sm font-semibold" data-testid="text-brand-name">
                  Apple Travel
                </div>
                <div className="truncate text-xs text-black/55 dark:text-white/55" data-testid="text-brand-sub">
                  Command Center
                </div>
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs font-medium text-black/70 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                  data-testid="button-role-switch"
                >
                  <span className="inline-flex h-6 items-center rounded-full bg-black/10 px-2 text-[11px] text-black/70 dark:bg-white/10 dark:text-white/80">
                    {role}
                  </span>
                  <ChevronDown className="h-4 w-4 text-black/50 dark:text-white/60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass ringed w-56 rounded-2xl border-black/10 bg-[hsl(var(--popover))] p-2 dark:border-white/10"
                data-testid="menu-role"
              >
              <DropdownMenuLabel className="text-xs text-black/70 dark:text-white/70">Access profile</DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-black/10 dark:bg-white/10" />
              {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
                <DropdownMenuItem
                  key={r}
                  className="cursor-pointer rounded-xl text-sm text-black/85 focus:bg-black/5 focus:text-black dark:text-white/85 dark:focus:bg-white/10 dark:focus:text-white"
                  onSelect={() => onRoleChange(r)}
                  data-testid={`menuitem-role-${r.toLowerCase()}`}
                >
                  {r}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Separator className="my-4 bg-black/10 dark:bg-white/10" />

        <nav className="space-y-1">
          {nav.map((item) => {
            const isActive = active === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onActiveChange(item.key)}
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
              </button>
            );
          })}
        </nav>

        <Separator className="my-4 bg-black/10 dark:bg-white/10" />

        <div className="grid gap-2">
          <button
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
            data-testid="button-support"
          >
            <div className="flex items-center gap-3">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                <LifeBuoy className="h-4 w-4 text-black/70 dark:text-white/80" />
              </div>
              <div>
                <div className="text-sm font-semibold" data-testid="text-support-title">
                  Support
                </div>
                <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-support-sub">
                  Playbooks, SOPs, help.
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
          </button>
        </div>

        <div className="mt-3 glass ringed grain rounded-3xl p-4" data-testid="panel-connect">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" data-testid="text-connect-title">Connect</div>
              <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-sub">All contact channels</div>
            </div>
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
              <MessageSquare className="h-5 w-5 text-black/70 dark:text-white/80" />
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-whatsapp"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <MessageSquare className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-whatsapp-title">WhatsApp</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-whatsapp-sub">Fast client comms</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-facebook"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <Users className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-facebook-title">Facebook</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-facebook-sub">Messenger + Pages</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-instagram"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <Sparkles className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-instagram-title">Instagram</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-instagram-sub">DMs + story replies</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-email"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <Mail className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-email-title">Email</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-email-sub">Templates + tracking</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-internal-chat"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <MessageSquare className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-internal-chat-title">Internal chat</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-internal-chat-sub">Team handoffs + notes</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>

            <button
              className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
              data-testid="button-connect-phone"
            >
              <div className="flex items-center gap-3">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <Phone className="h-4 w-4 text-black/70 dark:text-white/80" />
                </div>
                <div>
                  <div className="text-sm font-semibold" data-testid="text-connect-phone-title">Phone</div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-connect-phone-sub">Click-to-call log</div>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({
  role,
  active,
  query,
  onQuery,
  theme,
  onToggleTheme,
}: {
  role: Role;
  active: string;
  query: string;
  onQuery: (v: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
}) {
  const title = useMemo(() => {
    const map: Record<string, string> = {
      overview: "Overview",
      clients: "Clients",
      enquiries: "Enquiries",
      quotes: "Quotes",
      bookings: "Bookings",
      org: "Organisation",
      users: "Users & Roles",
      audit: "Audit",
      settings: "Settings",
      team: "Team Pipeline",
      coverage: "Coverage",
      coaching: "Coaching",
      reports: "Reports",
      assigned: "Assigned Clients",
      callbacks: "Callbacks",
      messages: "Messages",
      leads: "Leads",
      commission: "Commission",
      payouts: "Payouts",
    };
    return map[active] ?? "Command Center";
  }, [active]);

  return (
    <div className="glass ringed grain rounded-3xl p-4 md:p-5">
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
            <span className="hidden md:inline text-xs text-black/45 dark:text-white/45" data-testid="text-page-hint">
              designed for high-signal selling
            </span>
          </div>
          <p className="text-sm text-muted-foreground" data-testid="text-page-subtitle">
            A calm, premium command surface for clients, enquiries, quotes, and bookings.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50" />
            <Input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search clients, trips, destinations…"
              className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
              data-testid="input-search"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
              <span data-testid="text-theme-label">Light</span>
              <Switch data-testid="switch-theme" checked={theme === "dark"} onCheckedChange={onToggleTheme} />
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
            >
              <Bell className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ title, desc, action }: { title: string; desc: string; action: string }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-black/10 bg-black/5 p-10 text-center dark:border-white/10 dark:bg-white/5">
      <div className="mx-auto max-w-[52ch] space-y-2">
        <div className="title-serif text-xl font-semibold" data-testid="text-empty-title">
          {title}
        </div>
        <div className="text-sm text-black/60 dark:text-white/60" data-testid="text-empty-desc">
          {desc}
        </div>
        <div className="pt-2">
          <Button
            className="rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
            data-testid="button-empty-action"
          >
            <Bolt className="mr-2 h-4 w-4" />
            {action}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function CommandCenterPage() {
  const [role, setRole] = useState<Role>("Agent");
  const [active, setActive] = useState<string>("overview");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"clients" | "pipeline" | "calendar">("clients");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const themeClass = theme === "dark" ? "dark" : "";

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return seedClients;
    return seedClients.filter((c) =>
      [c.name, c.id, c.location, c.nextTrip, c.stage, c.tier].join(" ").toLowerCase().includes(q),
    );
  }, [query]);

  const totals = useMemo(() => {
    const booked = seedClients.filter((c) => c.stage === "Booked");
    const open = seedClients.filter((c) => c.stage !== "Booked");
    const bookedValue = booked.reduce((sum, c) => sum + c.value, 0);
    const openValue = open.reduce((sum, c) => sum + c.value, 0);
    return {
      bookedCount: booked.length,
      openCount: open.length,
      bookedValue,
      openValue,
      avgDeal: Math.round((bookedValue + openValue) / seedClients.length),
    };
  }, []);

  const content = useMemo(() => {
    if (role === "Agent" && ["overview", "clients", "enquiries", "quotes", "bookings"].includes(active)) {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid="text-module-title">
                  Workspace
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-module-subtitle">
                  Clients, pipeline, and calendar — all within reach.
                </div>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-workspace">
                  <TabsTrigger value="clients" className="rounded-xl" data-testid="tab-clients">
                    Clients
                  </TabsTrigger>
                  <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-pipeline">
                    Pipeline
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-calendar">
                    Calendar
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <Tabs value={tab}>
              <TabsContent value="clients" className="mt-0">
                <div className="grid gap-3">
                  {clients.map((c, idx) => (
                    <motion.button
                      key={c.id}
                      className="group relative w-full rounded-3xl border border-black/10 bg-black/5 p-4 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                      data-testid={`card-client-${c.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: idx * 0.03 }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div
                              className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                              aria-hidden
                            >
                              <UserRound className="h-4 w-4 text-black/70 dark:text-white/80" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <div className="truncate text-sm font-semibold" data-testid={`text-client-name-${c.id}`}>
                                  {c.name}
                                </div>
                                <span className="text-xs text-black/35 dark:text-white/35" data-testid={`text-client-id-${c.id}`}>
                                  {c.id}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${tierPill(c.tier)}`}
                                  data-testid={`text-client-tier-${c.id}`}
                                >
                                  {c.tier}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${stagePill(c.stage)}`}
                                  data-testid={`status-client-stage-${c.id}`}
                                >
                                  {c.stage}
                                </Badge>
                                <div className="inline-flex items-center gap-1 text-xs text-black/60 dark:text-white/60">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span data-testid={`text-client-location-${c.id}`}>{c.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-1">
                            <div
                              className="text-xs text-black/45 dark:text-white/45"
                              data-testid={`text-client-nexttrip-label-${c.id}`}
                            >
                              Next trip
                            </div>
                            <div className="truncate text-sm" data-testid={`text-client-nexttrip-${c.id}`}>
                              {c.nextTrip}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="text-sm font-semibold" data-testid={`text-client-value-${c.id}`}>
                            {currency.format(c.value)}
                          </div>
                          <div className="text-xs text-black/45 dark:text-white/45" data-testid={`text-client-lasttouch-${c.id}`}>
                            Last touch: {c.lastTouch}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-black/65 dark:text-white/65">
                            <span data-testid={`text-client-open-${c.id}`}>Open</span>
                            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { stage: "Enquiry" as const, hint: "New inbound" },
                    { stage: "Quote" as const, hint: "In progress" },
                    { stage: "Booked" as const, hint: "Confirmed" },
                  ] as const).map((col) => {
                    const items = seedClients.filter((c) => c.stage === col.stage);
                    const sum = items.reduce((s, i) => s + i.value, 0);
                    return (
                      <div key={col.stage} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold" data-testid={`text-pipeline-stage-${col.stage}`}>
                              {col.stage}
                            </div>
                            <div className="text-xs text-muted-foreground" data-testid={`text-pipeline-hint-${col.stage}`}>
                              {col.hint} · {items.length} items
                            </div>
                          </div>
                          <div className="text-xs text-black/60 dark:text-white/60" data-testid={`text-pipeline-sum-${col.stage}`}>
                            {currency.format(sum)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.map((c) => (
                            <button
                              key={c.id}
                              className="w-full rounded-3xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                              data-testid={`card-pipeline-${col.stage}-${c.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" data-testid={`text-pipeline-name-${c.id}`}>
                                    {c.name}
                                  </div>
                                  <div className="mt-1 truncate text-xs text-black/55 dark:text-white/55" data-testid={`text-pipeline-trip-${c.id}`}>
                                    {c.nextTrip}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold" data-testid={`text-pipeline-value-${c.id}`}>
                                  {currency.format(c.value)}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="grid gap-3 md:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="rounded-3xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
                      data-testid={`card-calendar-${i}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm font-semibold" data-testid={`text-calendar-title-${i}`}>
                          {i % 2 === 0 ? "Client call" : "Quote review"}
                        </div>
                        <Badge
                          variant="outline"
                          className="rounded-full border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                          data-testid={`status-calendar-${i}`}
                        >
                          {i % 2 === 0 ? "Today" : "Tomorrow"}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-black/55 dark:text-white/55" data-testid={`text-calendar-meta-${i}`}>
                        {i % 2 === 0 ? "15 min · high intent lead" : "30 min · adjust inclusions + margin"}
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-black/55 dark:text-white/55" data-testid={`text-calendar-time-${i}`}>
                          {i % 2 === 0 ? "14:30" : "11:00"}
                        </div>
                        <button
                          className="inline-flex items-center gap-1 text-xs text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
                          data-testid={`button-calendar-open-${i}`}
                        >
                          Open
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="space-y-4">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-panel-title">
                    Today
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-panel-subtitle">
                    High-signal focus queue.
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-2xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  data-testid="button-add-task"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add
                </Button>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="space-y-2">
                {seedActivity.map((a) => (
                  <button
                    key={a.id}
                    className="w-full rounded-3xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                    data-testid={`row-activity-${a.id}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80">
                        <IconForActivity type={a.type} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-semibold" data-testid={`text-activity-label-${a.id}`}>
                            {a.label}
                          </div>
                          <div className="text-xs text-black/45 dark:text-white/45" data-testid={`text-activity-time-${a.id}`}>
                            {a.time}
                          </div>
                        </div>
                        <div className="mt-1 truncate text-xs text-black/55 dark:text-white/55" data-testid={`text-activity-meta-${a.id}`}>
                          {a.meta}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <div className="rounded-3xl border border-black/10 bg-black/5 p-4 ringed dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-black/70 dark:text-white/70" data-testid="text-assist-label">
                    Assist
                  </div>
                  <div className="title-serif text-lg font-semibold" data-testid="text-assist-title">
                    Next-best actions
                  </div>
                  <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-assist-sub">
                    High intent leads and at-risk quotes detected.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <Sparkles className="h-5 w-5 text-black/70 dark:text-white/80" />
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <div
                  className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                  data-testid="text-assist-item-1"
                >
                  Refresh Noah’s quote with alternative departure airport (+$320 margin).
                </div>
                <div
                  className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                  data-testid="text-assist-item-2"
                >
                  Sofia’s enquiry: propose two itineraries, one adventure-forward.
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }

    if (role === "Referer") {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-affiliate-title">
                  Leads
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-affiliate-subtitle">
                  Track incoming leads and conversion.
                </div>
              </div>
              <Button
                className="h-10 rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                data-testid="button-share-link"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Share link
              </Button>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <div className="grid gap-3">
              {seedLeads.map((l) => (
                <button
                  key={l.id}
                  className="w-full rounded-3xl border border-black/10 bg-black/5 p-4 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid={`row-lead-${l.id}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" data-testid={`text-lead-name-${l.id}`}>
                        {l.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
                        <span data-testid={`text-lead-source-${l.id}`}>{l.source}</span>
                        <span className="text-black/25 dark:text-white/25">•</span>
                        <span data-testid={`text-lead-dest-${l.id}`}>{l.destination}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-semibold" data-testid={`text-lead-value-${l.id}`}>
                        {currency.format(l.value)}
                      </div>
                      <div className="mt-1 text-xs text-black/55 dark:text-white/55" data-testid={`status-lead-${l.id}`}>
                        {l.status}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-commission-title">
                    Commission
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-commission-subtitle">
                    Rolling 30 days.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <CircleDollarSign className="h-5 w-5 text-black/70 dark:text-white/80" />
                </div>
              </div>
              <Separator className="my-4 bg-black/10 dark:bg-white/10" />
              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="Converted" value="2" delta="+1" icon={<BadgeCheck className="h-4 w-4" />} />
                <KpiCard label="Pending" value={currency.format(860)} delta="Processing" icon={<Banknote className="h-4 w-4" />} />
              </div>
            </Card>
          </div>
        </section>
      );
    }

    if (role === "Admin") {
      if (active === "users") {
        return (
          <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-users-title">
                    Users & Roles
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-users-subtitle">
                    Provision access with principle-of-least-privilege.
                  </div>
                </div>
                <Button
                  className="h-10 rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  data-testid="button-invite-user"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Invite
                </Button>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="grid gap-2">
                {([
                  { name: "Olivia Reed", role: "Manager", status: "Active" },
                  { name: "Kai Nakamura", role: "Agent", status: "Active" },
                  { name: "Amara Mensah", role: "Homeworker", status: "Pending" },
                ] as const).map((u, idx) => (
                  <button
                    key={idx}
                    className="flex items-center justify-between rounded-3xl border border-black/10 bg-black/5 px-4 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                    data-testid={`row-user-${idx}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <UserRound className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold" data-testid={`text-user-name-${idx}`}>
                          {u.name}
                        </div>
                        <div className="text-xs text-black/55 dark:text-white/55" data-testid={`text-user-role-${idx}`}>
                          {u.role}
                        </div>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="rounded-full border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80"
                      data-testid={`status-user-${idx}`}
                    >
                      {u.status}
                    </Badge>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-permissions-title">
                    Permission map
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-permissions-subtitle">
                    Roles are composable policy bundles.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <Shield className="h-5 w-5 text-black/70 dark:text-white/80" />
                </div>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="grid gap-2">
                {([
                  { p: "Manage users", a: true, m: true, ag: false, h: false, r: false },
                  { p: "Approve discounts", a: true, m: true, ag: true, h: false, r: false },
                  { p: "Edit bookings", a: true, m: true, ag: true, h: true, r: false },
                  { p: "View commission", a: true, m: true, ag: true, h: false, r: true },
                ] as const).map((row, idx) => (
                  <div
                    key={idx}
                    className="rounded-3xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
                    data-testid={`row-permission-${idx}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold" data-testid={`text-permission-name-${idx}`}>
                        {row.p}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-black/65 dark:text-white/65">
                        <span
                          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 dark:border-white/10 dark:bg-white/5"
                          data-testid={`pill-perm-admin-${idx}`}
                        >
                          A: {row.a ? "✓" : "—"}
                        </span>
                        <span
                          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 dark:border-white/10 dark:bg-white/5"
                          data-testid={`pill-perm-manager-${idx}`}
                        >
                          M: {row.m ? "✓" : "—"}
                        </span>
                        <span
                          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 dark:border-white/10 dark:bg-white/5"
                          data-testid={`pill-perm-agent-${idx}`}
                        >
                          Ag: {row.ag ? "✓" : "—"}
                        </span>
                        <span
                          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 dark:border-white/10 dark:bg-white/5"
                          data-testid={`pill-perm-homeworker-${idx}`}
                        >
                          H: {row.h ? "✓" : "—"}
                        </span>
                        <span
                          className="rounded-full border border-black/10 bg-black/5 px-2 py-1 dark:border-white/10 dark:bg-white/5"
                          data-testid={`pill-perm-referer-${idx}`}
                        >
                          R: {row.r ? "✓" : "—"}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        );
      }

      return (
        <EmptyState
          title="Admin surfaces, designed first."
          desc="Open Users & Roles to preview the access model UI. Other admin modules can be designed next: audit trails, organisation settings, and policy approvals."
          action="Open Users & Roles"
        />
      );
    }

    if (role === "Manager") {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-manager-title">
                  Team Pipeline
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-manager-subtitle">
                  Coverage, velocity, and risk in one view.
                </div>
              </div>
              <Button
                variant="outline"
                className="h-10 rounded-2xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                data-testid="button-manager-export"
              >
                <FileText className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard label="At-risk quotes" value="3" delta="Needs attention" icon={<Sparkles className="h-4 w-4" />} />
              <KpiCard
                label="Response time"
                value="1h 12m"
                delta="Top quartile"
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <KpiCard label="Win rate" value="41%" delta="+6 pts" icon={<BadgeCheck className="h-4 w-4" />} />
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <div className="grid gap-3">
              {([
                { name: "Kai Nakamura", open: 6, booked: 2, value: 31200 },
                { name: "Maya Ibrahim", open: 4, booked: 1, value: 18400 },
                { name: "Theo Rossi", open: 7, booked: 3, value: 46700 },
              ] as const).map((a, idx) => (
                <div
                  key={idx}
                  className="rounded-3xl border border-black/10 bg-black/5 p-4 dark:border-white/10 dark:bg-white/5"
                  data-testid={`row-agent-${idx}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" data-testid={`text-agent-name-${idx}`}>
                        {a.name}
                      </div>
                      <div className="mt-1 text-xs text-black/55 dark:text-white/55" data-testid={`text-agent-meta-${idx}`}>
                        {a.open} open · {a.booked} booked
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold" data-testid={`text-agent-value-${idx}`}>
                        {currency.format(a.value)}
                      </div>
                      <div className="mt-1 text-xs text-black/55 dark:text-white/55" data-testid={`text-agent-hint-${idx}`}>
                        30d managed
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-risk-title">
                    Risk
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-risk-subtitle">
                    Quotes with churn signals.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <Briefcase className="h-5 w-5 text-black/70 dark:text-white/80" />
                </div>
              </div>
              <Separator className="my-4 bg-black/10 dark:bg-white/10" />
              <div className="grid gap-2">
                {[
                  "No reply 48h — Noah Patel",
                  "Budget mismatch — Ethan Brooks",
                  "Dates shifting — Sofia Martínez",
                ].map((t, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
                    data-testid={`text-risk-item-${i}`}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>
      );
    }

    if (role === "Homeworker") {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-queue-title">
                  Work Queue
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-queue-subtitle">
                  Assigned tasks with clear next steps.
                </div>
              </div>
              <Button
                variant="outline"
                className="h-10 rounded-2xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                data-testid="button-queue-refresh"
              >
                <Activity className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <div className="grid gap-2">
              {([
                { t: "Confirm supplier availability", meta: "Kyoto — 2 hotels", pri: "High" },
                { t: "Draft quote inclusions", meta: "Dolomites — 7 nights", pri: "High" },
                { t: "Send passport checklist", meta: "Patagonia — 12 nights", pri: "Normal" },
              ] as const).map((x, i) => (
                <button
                  key={i}
                  className="w-full rounded-3xl border border-black/10 bg-black/5 p-4 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid={`row-task-${i}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold" data-testid={`text-task-title-${i}`}>
                        {x.t}
                      </div>
                      <div className="mt-1 text-xs text-black/55 dark:text-white/55" data-testid={`text-task-meta-${i}`}>
                        {x.meta}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        "rounded-full border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/80 " +
                        (x.pri === "High" ? "ring-1 ring-rose-400/30" : "")
                      }
                      data-testid={`status-task-priority-${i}`}
                    >
                      {x.pri}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </section>
      );
    }

    return (
      <EmptyState
        title="This module is a designed shell."
        desc="Switch roles to preview role-based navigation and layouts. Next we can design the full client record and the Enquiry → Quote → Booking flow."
        action="Design client record"
      />
    );
  }, [active, clients, role, tab]);

  return (
    <div className={themeClass}>
      <div className="app-shell px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4">
        <div className="w-full space-y-3">
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <ShellNav role={role} onRoleChange={setRole} active={active} onActiveChange={setActive} />

            <div className="flex flex-col gap-3">
              <TopBar
                role={role}
                active={active}
                query={query}
                onQuery={setQuery}
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              />

              <section className="grid gap-3 md:grid-cols-4">
                <KpiCard
                  label="Today's Profit"
                  value={currency.format(totals.bookedValue)}
                  delta="+4.1% DoD"
                  icon={<Ticket className="h-4 w-4" />}
                />
                <KpiCard
                  label="This Week"
                  value={currency.format(totals.openValue)}
                  delta="+2.3% WoW"
                  icon={<Sparkles className="h-4 w-4" />}
                />
                <KpiCard
                  label="This Month"
                  value={currency.format(totals.avgDeal)}
                  delta="+6.8% MoM"
                  icon={<Briefcase className="h-4 w-4" />}
                />
                <KpiCard
                  label="Average Deal"
                  value={currency.format(totals.avgDeal)}
                  delta="+3.0% vs last"
                  icon={<Briefcase className="h-4 w-4" />}
                />
              </section>

              <div className="pr-1" data-testid="panel-scroll">
                {content}

                <div className="mt-3 grid gap-3 md:grid-cols-2" data-testid="section-footer">
                  <div className="glass ringed grain rounded-3xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-black/70 dark:text-white/70" data-testid="text-footer-left-label">
                          Status
                        </div>
                        <div className="text-sm font-semibold" data-testid="text-footer-left-title">
                          System healthy
                        </div>
                        <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-footer-left-sub">
                          Mock data · UI-only prototype
                        </div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <Globe className="h-5 w-5 text-black/70 dark:text-white/80" />
                      </div>
                    </div>
                  </div>

                  <div className="glass ringed grain rounded-3xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-black/70 dark:text-white/70" data-testid="text-footer-right-label">
                          Security
                        </div>
                        <div className="text-sm font-semibold" data-testid="text-footer-right-title">
                          Role-aware surfaces
                        </div>
                        <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-footer-right-sub">
                          Admin, Manager, Agent, Homeworker, Referer
                        </div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <Shield className="h-5 w-5 text-black/70 dark:text-white/80" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
