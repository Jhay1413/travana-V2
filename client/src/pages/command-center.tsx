import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchDashboardStats, fetchClients, fetchTourOperators, fetchAirports, type TourOperator, type Airport } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
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
  LogOut,
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
  User2,
  UserRound,
  Users,
  X,
  Moon,
  Sun,
  Camera,
  Smartphone,
  Trash2,
  Upload,
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
  active,
  onActiveChange,
  actualRole,
  rolePreview,
  onRoleChange,
}: {
  role: Role;
  active: string;
  onActiveChange: (k: string) => void;
  actualRole: Role;
  rolePreview: Role | null;
  onRoleChange: (role: Role | null) => void;
}) {
  const [, navigate] = useLocation();
  const nav = useMemo(() => {
    const base = [
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
        { key: "reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
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

  return (
    <aside className="hidden lg:block">
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
              <div className="title-serif truncate text-sm font-semibold" data-testid="text-brand-name">Travana</div>
              <div className="truncate text-xs text-black/55 dark:text-white/55" data-testid="text-brand-sub">
                Command Center
              </div>
            </div>
          </div>

          <select
            value={rolePreview || actualRole}
            onChange={(e) => {
              const newRole = e.target.value as Role;
              onRoleChange(newRole === actualRole ? null : newRole);
            }}
            className="rounded-2xl border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
            data-testid="select-role-nav"
          >
            {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
              <option key={r} value={r} className="text-black bg-white">
                {r}{r === actualRole ? " ✓" : ""}
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
                          const childActive = hasChildren && item.children.some((c: { key: string }) => active === c.key);
                          return (
                            <div key={item.key}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onActiveChange(item.key);
                                }}
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
                              </button>
                              {hasChildren && (isActive || childActive) && (
                                <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                  {item.children.map((child: { key: string; label: string; icon: React.ReactNode }) => (
                                    <button
                                      key={child.key}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        onActiveChange(child.key);
                                      }}
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
          })
          )}
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
                <div className="text-sm font-semibold" data-testid="text-support-title">TheHub</div>
                <div className="text-xs text-black/55 dark:text-white/55" data-testid="text-support-sub">
                  Profile, News & Training
                </div>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
          </button>
        </div>

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
            const isActive = active === `connect-${key}`;

            const awaitingMap: Record<string, number> = {
              whatsapp: 43,
              facebook: 2,
              tickets: 6,
              instagram: 0,
              email: 9,
              "internal-chat": 4,
            };
            const awaiting = awaitingMap[key] ?? 0;

            return (
              <button
                key={key}
                onClick={() => onActiveChange(`connect-${key}`)}
                className={
                  "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                  (isActive
                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                    : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                }
                data-testid={`nav-connect-${key}`}
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
                  <span className="text-sm font-medium" data-testid={`text-connect-label-${key}`}>{item.label}</span>
                </div>

                <div className="flex items-center gap-2">
                  {awaiting > 0 ? (
                    <span
                      className={
                        "inline-flex min-w-[28px] items-center justify-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tabular-nums " +
                        (isActive
                          ? "border-black/10 bg-black/10 text-black dark:border-white/15 dark:bg-white/15 dark:text-white"
                          : "border-black/10 bg-black/5 text-black/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80")
                      }
                      data-testid={`badge-connect-awaiting-${key}`}
                      aria-label={`${awaiting} awaiting`}
                    >
                      {awaiting}
                    </span>
                  ) : null}

                  <ChevronRight
                    className={"h-4 w-4 " + (isActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

const sampleNotifications = [
  {
    id: 1,
    type: "booking",
    title: "New Booking Confirmed",
    message: "Sarah Johnson's Maldives trip has been confirmed for 15th March 2026",
    time: "2 minutes ago",
    read: false,
  },
  {
    id: 2,
    type: "quote",
    title: "Quote Expiring Soon",
    message: "Thompson family's Caribbean cruise quote expires in 24 hours",
    time: "1 hour ago",
    read: false,
  },
  {
    id: 3,
    type: "payment",
    title: "Payment Received",
    message: "£2,450 deposit received from Mr. Williams for Bali package",
    time: "3 hours ago",
    read: true,
  },
  {
    id: 4,
    type: "client",
    title: "New Enquiry",
    message: "Emma Richards submitted an enquiry for honeymoon destinations",
    time: "Yesterday",
    read: true,
  },
  {
    id: 5,
    type: "reminder",
    title: "Follow-up Required",
    message: "Call back scheduled with David Brown regarding safari options",
    time: "Yesterday",
    read: true,
  },
];

function NotificationsPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<"unread" | "all">("unread");
  
  const filteredNotifications = activeTab === "unread" 
    ? sampleNotifications.filter(n => !n.read)
    : sampleNotifications;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 350 }}
            className="fixed right-0 top-0 z-50 h-full w-80 bg-white dark:bg-zinc-900 shadow-2xl border-l border-gray-200 dark:border-zinc-800"
          >
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b border-gray-200 dark:border-zinc-800 px-4 py-4">
                <h2 className="text-base font-semibold text-gray-900 dark:text-white">Notifications</h2>
                <button
                  onClick={onClose}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                  data-testid="button-close-notifications"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="border-b border-gray-200 dark:border-zinc-800 px-4 py-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("unread")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      activeTab === "unread"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                    }`}
                    data-testid="tab-unread"
                  >
                    Unread
                  </button>
                  <button
                    onClick={() => setActiveTab("all")}
                    className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition ${
                      activeTab === "all"
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-zinc-800"
                    }`}
                    data-testid="tab-all"
                  >
                    All
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {filteredNotifications.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500">
                    <Bell className="h-10 w-10 mb-2 opacity-50" />
                    <p className="text-sm">No notifications</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-zinc-800">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                        data-testid={`notification-${notification.id}`}
                      >
                        <div className="flex-shrink-0 mt-0.5">
                          <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                            <Bell className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900 dark:text-white">
                            {notification.message}
                          </p>
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1">
                          {!notification.read && (
                            <span className="h-2 w-2 rounded-full bg-blue-500" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="border-t border-gray-200 dark:border-zinc-800 p-3">
                <button
                  className="w-full rounded-lg bg-gray-100 dark:bg-zinc-800 px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 transition hover:bg-gray-200 dark:hover:bg-zinc-700"
                  data-testid="button-clear-notifications"
                >
                  Clear Notification
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TopBar({
  role,
  active,
  query,
  onQuery,
  theme,
  onToggleTheme,
  userName,
  userAvatar,
  onLogout,
  actualRole,
  rolePreview,
  onRoleChange,
}: {
  role: Role;
  active: string;
  query: string;
  onQuery: (v: string) => void;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  userName?: string;
  userAvatar?: string | null;
  onLogout?: () => void;
  actualRole: Role;
  rolePreview: Role | null;
  onRoleChange: (role: Role | null) => void;
}) {
  const [showNotifications, setShowNotifications] = useState(false);
  
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
      "tour-operators": "Tour Operators",
      airports: "Airports",
      "agent-settings": "Settings",
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
        <div className="flex items-center gap-4">
          <h1 className="title-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="text-page-title">
            {title}
          </h1>
          <div className="relative hidden sm:block w-[320px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50" />
            <Input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search clients, trips, destinations…"
              className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
              data-testid="input-search"
            />
          </div>
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
              onClick={() => setShowNotifications(true)}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 text-black/70 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
              data-testid="button-notifications"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
              {sampleNotifications.filter(n => !n.read).length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                  {sampleNotifications.filter(n => !n.read).length}
                </span>
              )}
            </button>
            <NotificationsPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />

            {userName && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 text-black/70 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                    data-testid="button-user-menu"
                  >
                    {userAvatar ? (
                      <img src={userAvatar} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-medium">
                        {userName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="hidden sm:inline text-sm font-medium">{userName}</span>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-profile">
                    <User2 className="mr-2 h-4 w-4" />
                    Profile
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="cursor-pointer text-red-600 focus:text-red-600"
                    onClick={onLogout}
                    data-testid="menu-item-logout"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const [active, setActive] = useState<string>("overview");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"clients" | "pipeline" | "calendar" | "news">("clients");
  const [socialFilter, setSocialFilter] = useState<"today" | "tomorrow" | "date">("today");
  const [socialDate, setSocialDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [rolePreview, setRolePreview] = useState<Role | null>(null);
  const [settingsTab, setSettingsTab] = useState<"general" | "tour-operators">("general");
  const [tourOperatorSearch, setTourOperatorSearch] = useState("");
  const [airportSearch, setAirportSearch] = useState("");

  const themeClass = theme === "dark" ? "dark" : "";
  const displayName = user?.firstName || user?.name || user?.email || "User";
  
  // Use role preview if set, otherwise use the user's role from database
  const actualRole = (user?.role as Role) || "Agent";
  const role = rolePreview || actualRole;

  // Fetch dashboard stats from API
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: fetchDashboardStats,
  });

  // Fetch clients from API
  const { data: apiClients } = useQuery({
    queryKey: ["/api/clients"],
    queryFn: fetchClients,
  });

  // Fetch users for admin panel
  const queryClient = useQueryClient();
  const { data: apiUsers } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Mutation to update user role
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  // Mutation to delete user
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete user");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });

  // Fetch tour operators
  const { data: tourOperators } = useQuery({
    queryKey: ["/api/tour-operators"],
    queryFn: fetchTourOperators,
  });

  // Tour Operator mutations
  const createTourOperatorMutation = useMutation({
    mutationFn: async (op: Omit<TourOperator, "id" | "createdAt" | "updatedAt">) => {
      const res = await fetch("/api/tour-operators", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(op),
      });
      if (!res.ok) throw new Error("Failed to create tour operator");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-operators"] });
    },
  });

  const updateTourOperatorMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<TourOperator>) => {
      const res = await fetch(`/api/tour-operators/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update tour operator");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-operators"] });
    },
  });

  const deleteTourOperatorMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tour-operators/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete tour operator");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tour-operators"] });
    },
  });

  // Fetch airports
  const { data: airportsList } = useQuery({
    queryKey: ["/api/airports"],
    queryFn: fetchAirports,
  });

  const createAirportMutation = useMutation({
    mutationFn: async (airport: Omit<Airport, "id" | "createdAt">) => {
      const res = await fetch("/api/airports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(airport),
      });
      if (!res.ok) throw new Error("Failed to create airport");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/airports"] });
    },
  });

  const deleteAirportMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/airports/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete airport");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/airports"] });
    },
  });

  // Transform API clients to display format
  const allClients = useMemo(() => {
    if (!apiClients) return seedClients;
    return apiClients.map((c) => ({
      id: c.id,
      name: c.name,
      tier: c.tier as "Platinum" | "Gold" | "Standard",
      stage: c.stage as Stage,
      location: c.location || "",
      nextTrip: c.nextTrip || "",
      value: parseFloat(c.value),
      lastTouch: c.lastTouch || "",
    }));
  }, [apiClients]);

  const clients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allClients;
    return allClients.filter((c) =>
      [c.name, c.id, c.location, c.nextTrip, c.stage, c.tier].join(" ").toLowerCase().includes(q),
    );
  }, [query, allClients]);

  const totals = useMemo(() => {
    if (dashboardStats) {
      // Use API stats if available
      return {
        bookedCount: dashboardStats.wonCount,
        openCount: dashboardStats.inPlayCount + dashboardStats.lostCount,
        bookedValue: dashboardStats.totalRevenue,
        openValue: (dashboardStats.totalQuotes - dashboardStats.wonCount) * dashboardStats.avgDealSize,
        avgDeal: Math.round(dashboardStats.avgDealSize),
      };
    }
    // Fallback to calculating from clients
    const booked = allClients.filter((c) => c.stage === "Booked");
    const open = allClients.filter((c) => c.stage !== "Booked");
    const bookedValue = booked.reduce((sum, c) => sum + c.value, 0);
    const openValue = open.reduce((sum, c) => sum + c.value, 0);
    return {
      bookedCount: booked.length,
      openCount: open.length,
      bookedValue,
      openValue,
      avgDeal: Math.round((bookedValue + openValue) / allClients.length),
    };
  }, [dashboardStats, allClients]);

  const content = useMemo(() => {
    // Agent Overview - dashboard for agent users
    const isAgentOverview = (role === "Agent" && active === "overview") || 
                            (role === "Admin" && active === "agent-overview");
    
    if (isAgentOverview) {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid="text-overview-title">
                  Overview
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-overview-subtitle">
                  Your dashboard at a glance.
                </div>
              </div>

              <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
                <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-overview">
                  <TabsTrigger value="clients" className="rounded-xl" data-testid="tab-overview-clients">
                    Clients
                  </TabsTrigger>
                  <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-overview-pipeline">
                    Pipeline
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-overview-social">
                    Social Posts
                  </TabsTrigger>
                  <TabsTrigger value="news" className="rounded-xl" data-testid="tab-overview-news">
                    News
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
                      data-testid={`card-overview-client-${c.id}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: idx * 0.03 }}
                      onClick={() => navigate(`/clients/${c.id}`)}
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
                                <div className="truncate text-sm font-semibold" data-testid={`text-overview-client-name-${c.id}`}>
                                  {c.name}
                                </div>
                                <span className="text-xs text-black/35 dark:text-white/35">
                                  {c.id.slice(0, 8)}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${tierPill(c.tier)}`}
                                >
                                  {c.tier}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`rounded-full ${stagePill(c.stage)}`}
                                >
                                  {c.stage}
                                </Badge>
                                <div className="inline-flex items-center gap-1 text-xs text-black/60 dark:text-white/60">
                                  <MapPin className="h-3.5 w-3.5" />
                                  <span>{c.location}</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-1">
                            <div className="text-xs text-black/45 dark:text-white/45">
                              Next trip
                            </div>
                            <div className="truncate text-sm">
                              {c.nextTrip}
                            </div>
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div className="text-sm font-semibold">
                            {currency.format(c.value)}
                          </div>
                          <div className="text-xs text-black/45 dark:text-white/45">
                            Last touch: {c.lastTouch}
                          </div>
                          <div className="mt-2 inline-flex items-center gap-1 text-xs text-black/65 dark:text-white/65">
                            <span>Open</span>
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
                    const items = allClients.filter((c) => c.stage === col.stage);
                    const sum = items.reduce((s, i) => s + i.value, 0);
                    return (
                      <div key={col.stage} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold">
                              {col.stage}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {col.hint} · {items.length} items
                            </div>
                          </div>
                          <div className="text-xs text-black/60 dark:text-white/60">
                            {currency.format(sum)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.map((c) => (
                            <div
                              key={c.id}
                              className="rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
                            >
                              <div className="flex items-center justify-between">
                                <div className="truncate text-sm font-medium">{c.name}</div>
                                <div className="text-xs font-medium">{currency.format(c.value)}</div>
                              </div>
                              <div className="mt-1 truncate text-xs text-black/55 dark:text-white/55">
                                {c.nextTrip}
                              </div>
                            </div>
                          ))}
                          {items.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-black/10 p-3 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
                              No items
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="grid gap-3">
                  {[
                    { id: 1, title: "Summer promotion", platform: "Instagram", time: "10:00", status: "scheduled" },
                    { id: 2, title: "Maldives deals", platform: "Facebook", time: "14:00", status: "scheduled" },
                    { id: 3, title: "Client testimonial", platform: "LinkedIn", time: "16:30", status: "draft" },
                  ].map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium">{post.title}</div>
                          <Badge variant="outline" className="rounded-full text-xs">
                            {post.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-black/55 dark:text-white/55">
                          {post.platform} · {post.time}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/40" />
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="news" className="mt-0">
                <div className="grid gap-3">
                  {[
                    { title: "Travel trends 2026", src: "Skift", time: "2h ago" },
                    { title: "New BA routes to Asia", src: "TTG", time: "5h ago" },
                    { title: "ABTA conference highlights", src: "Travel Weekly", time: "1d ago" },
                  ].map((n, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div>
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-xs text-black/55 dark:text-white/55">
                          {n.src} · {n.time}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/40" />
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </Card>

          <div className="flex flex-col gap-4">
            <Card className="glass ringed grain rounded-3xl p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-black/70 dark:text-white/70">Pipeline</div>
                  <div className="title-serif text-2xl font-bold tabular-nums" data-testid="text-pipeline-total">
                    {currency.format(totals.bookedValue + totals.openValue)}
                  </div>
                </div>
                <CircleDollarSign className="h-6 w-6 text-black/40 dark:text-white/40" />
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <div className="text-black/55 dark:text-white/55">Booked</div>
                  <div className="font-medium">{currency.format(totals.bookedValue)}</div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <div className="text-black/55 dark:text-white/55">Open</div>
                  <div className="font-medium">{currency.format(totals.openValue)}</div>
                </div>
              </div>
            </Card>

            <Card className="glass ringed grain rounded-3xl p-4">
              <div className="space-y-1">
                <div className="text-xs text-black/70 dark:text-white/70">Activity</div>
                <div className="title-serif text-lg font-semibold">Recent</div>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { id: 1, action: "Quote sent", client: "Ava Harrington", meta: "2h ago" },
                  { id: 2, action: "Booking confirmed", client: "James Whitmore", meta: "Yesterday" },
                  { id: 3, action: "New enquiry", client: "Emma Richardson", meta: "2d ago" },
                ].map((a) => (
                  <button
                    key={a.id}
                    className="flex w-full items-start gap-3 rounded-2xl border border-black/10 bg-black/5 p-3 text-left hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  >
                    <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      <Activity className="h-4 w-4 text-black/70 dark:text-white/80" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="truncate text-sm font-medium">{a.action}</div>
                        <div className="shrink-0 text-xs text-black/45 dark:text-white/45">{a.meta}</div>
                      </div>
                      <div className="mt-1 truncate text-xs text-black/55 dark:text-white/55">{a.client}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <div className="rounded-3xl border border-black/10 bg-black/5 p-4 ringed dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-xs text-black/70 dark:text-white/70">Assist</div>
                  <div className="title-serif text-lg font-semibold">Next-best actions</div>
                  <div className="text-xs text-black/55 dark:text-white/55">
                    High intent leads and at-risk quotes detected.
                  </div>
                </div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  <Sparkles className="h-5 w-5 text-black/70 dark:text-white/80" />
                </div>
              </div>
              <div className="mt-3 grid gap-2">
                <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  Refresh Noah's quote with alternative departure airport (+£320 margin).
                </div>
                <div className="rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/70 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                  Sofia's enquiry: propose two itineraries, one adventure-forward.
                </div>
              </div>
            </div>
          </div>
        </section>
      );
    }
    
    // Show Agent workspace for Agents, or for Admins when viewing agent sections
    const agentSections = ["clients", "enquiries", "quotes", "bookings"];
    const showAgentContent = (role === "Agent" && agentSections.includes(active)) || 
                             (role === "Admin" && agentSections.includes(active));
    
    if (showAgentContent) {
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
                  <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-social-posts">
                    Social Posts
                  </TabsTrigger>
                  <TabsTrigger value="news" className="rounded-xl" data-testid="tab-news">
                    News
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
                      onClick={() => navigate(`/clients/${c.id}`)}
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
                    const items = allClients.filter((c) => c.stage === col.stage);
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
                <div className="grid gap-3" data-testid="panel-social-posts">
                  <div className="col-span-full flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5" data-testid="group-social-filters">
                      <button
                        type="button"
                        onClick={() => setSocialFilter("today")}
                        className={
                          "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                          (socialFilter === "today"
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                        }
                        data-testid="filter-social-today"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setSocialFilter("tomorrow")}
                        className={
                          "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                          (socialFilter === "tomorrow"
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                        }
                        data-testid="filter-social-tomorrow"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => setSocialFilter("date")}
                        className={
                          "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                          (socialFilter === "date"
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                        }
                        data-testid="filter-social-date"
                      >
                        Date selection
                      </button>
                    </div>

                    <div className={(socialFilter === "date" ? "flex" : "hidden") + " items-center gap-2"} data-testid="wrap-social-date">
                      <Input
                        type="date"
                        value={socialDate}
                        onChange={(e) => setSocialDate(e.target.value)}
                        className="h-9 w-[170px] rounded-2xl border-black/10 bg-black/5 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                        data-testid="input-social-date"
                      />
                      <span className="text-xs text-black/45 dark:text-white/45" data-testid="text-social-date-hint">
                        Showing: {socialDate}
                      </span>
                    </div>
                  </div>

                  {([
                    {
                      id: "post-001",
                      title: "Maldives Winter Escape — £2,495pp",
                      subtitle: "Overwater villa + private transfers",
                      imageSrc: "/attached_assets/Luxury-Coco-Beach-Resort_1769950332124.jpg",
                      hotel: "Soneva Jani",
                      departing: "BAA",
                      nights: 7,
                      board: "Half Board",
                      travelDate: "2026-02-18",
                      createdAt: "2026-02-01",
                      quoteId: "Q-1082",
                      liveHref: "/command-center?quote=Q-1082",
                      audience: "Facebook",
                      status: "Scheduled",
                      scheduledAt: "Today 18:00",
                      time: "Today 18:00",
                      copy:
                        "Limited winter availability. Premium overwater villas + transfers included. Reply ‘MALDIVES’ for a tailored quote.",
                    },
                    {
                      id: "post-002",
                      title: "Rome & Amalfi — £1,349pp",
                      subtitle: "Split-stay with private transfers",
                      imageSrc: "/attached_assets/Luxury-Coco-Beach-Resort_1769950332124.jpg",
                      hotel: "Hotel de la Ville + Il San Pietro",
                      departing: "LGW",
                      nights: 5,
                      board: "B&B",
                      travelDate: "2026-02-10",
                      createdAt: "2026-01-31",
                      quoteId: "Q-1075",
                      liveHref: "/command-center?quote=Q-1075",
                      audience: "Facebook",
                      status: "Draft",
                      scheduledAt: "Tomorrow 10:30",
                      time: "Tomorrow 10:30",
                      copy:
                        "A classic split-stay: 2 nights Rome, 3 nights Amalfi. Add private transfers and a sunset cruise.",
                    },
                    {
                      id: "post-003",
                      title: "Dubai Half-Term — £1,199pp",
                      subtitle: "Family suite + pool access",
                      imageSrc: "/attached_assets/Luxury-Coco-Beach-Resort_1769950332124.jpg",
                      hotel: "Atlantis The Royal",
                      departing: "MAN",
                      nights: 4,
                      board: "Half Board",
                      travelDate: "2026-02-15",
                      createdAt: "2026-01-30",
                      quoteId: "Q-1069",
                      liveHref: "/command-center?quote=Q-1069",
                      audience: "Facebook",
                      status: "Posted",
                      scheduledAt: null,
                      time: "Yesterday",
                      copy:
                        "Family-ready luxury with pool access and late checkout options. Ask for our upgrade shortlist.",
                    },
                    {
                      id: "post-004",
                      title: "New York City Weekend — £899pp",
                      subtitle: "Premium hotel + Broadway options",
                      imageSrc: "/attached_assets/Luxury-Coco-Beach-Resort_1769950332124.jpg",
                      hotel: "The Peninsula New York",
                      departing: "LHR",
                      nights: 3,
                      board: "Room Only",
                      travelDate: "2026-03-01",
                      createdAt: "2026-01-29",
                      quoteId: "Q-1058",
                      liveHref: "/command-center?quote=Q-1058",
                      audience: "Facebook",
                      status: "Draft",
                      scheduledAt: null,
                      time: "In review",
                      copy:
                        "A sharp city break with premium hotel options. Add Broadway tickets and airport lounge access.",
                    },
                  ] as const)
                    .filter((p) => {
                      if (socialFilter === "today") return p.time.toLowerCase().startsWith("today");
                      if (socialFilter === "tomorrow") return p.time.toLowerCase().startsWith("tomorrow");
                      if (socialFilter === "date") return true;
                      return true;
                    })
                    .map((p) => (
                      <button
                        key={p.id}
                        className="group w-full rounded-3xl border border-black/10 bg-black/5 p-4 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                        data-testid={`card-social-post-${p.id}`}
                      >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold" data-testid={`text-social-post-title-${p.id}`}>
                              {p.title}
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span className="truncate text-black/60 dark:text-white/60" data-testid={`text-social-post-subtitle-${p.id}`}>
                                {p.subtitle}
                              </span>
                              <span className="text-black/35 dark:text-white/35" data-testid={`text-social-post-time-${p.id}`}>
                                {p.time}
                              </span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right space-y-1">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={
                                  "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold " +
                                  (p.status === "Posted"
                                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : p.status === "Scheduled"
                                      ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                                      : "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300")
                                }
                                data-testid={`status-social-post-${p.id}`}
                              >
                                {p.status}{p.scheduledAt ? ` · ${p.scheduledAt}` : ""}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-black/55 dark:text-white/55">
                              <span data-testid={`text-social-post-quote-${p.id}`}>Quote #{p.quoteId}</span>
                              <span className="text-black/25 dark:text-white/25">•</span>
                              <span data-testid={`text-social-post-platform-${p.id}`}>{p.audience}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-start gap-3">
                          <div
                            className="hidden sm:block relative shrink-0 self-stretch w-36 overflow-hidden rounded-2xl border border-black/10 bg-black/5 ring-1 ring-black/5 dark:border-white/10 dark:bg-white/5 dark:ring-white/5"
                            data-testid={`img-social-post-${p.id}`}
                          >
                            {p.imageSrc ? (
                              <img
                                src={p.imageSrc}
                                alt=""
                                className="h-full w-full object-cover"
                                loading="lazy"
                              />
                            ) : null}
                            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-black/0 to-black/0 dark:from-black/45" />
                          </div>

                          <div className="min-w-0 flex-1 grid gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs text-black/65 dark:border-white/10 dark:bg-white/5 dark:text-white/65">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                              <div className="truncate" data-testid={`text-social-post-hotel-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Hotel</span>: {p.hotel}
                              </div>
                              <div className="truncate" data-testid={`text-social-post-departing-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Departing</span>: {p.departing}
                              </div>
                              <div className="truncate" data-testid={`text-social-post-nights-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Nights</span>: {p.nights}
                              </div>
                              <div className="truncate" data-testid={`text-social-post-board-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Board</span>: {p.board}
                              </div>
                              <div className="truncate" data-testid={`text-social-post-travel-date-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Travel date</span>: {p.travelDate}
                              </div>
                              <div className="truncate" data-testid={`text-social-post-created-${p.id}`}>
                                <span className="text-black/45 dark:text-white/45">Date created</span>: {p.createdAt}
                              </div>
                            </div>

                            <div className="flex justify-end pt-1">
                              <a
                                href={p.liveHref}
                                className="inline-flex items-center gap-1 rounded-full border border-black/10 bg-black/5 px-2 py-1 text-[11px] font-semibold text-black/75 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white/80 dark:hover:bg-white/10"
                                data-testid={`link-social-post-live-${p.id}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                View live deal
                                <ChevronRight className="h-3.5 w-3.5" />
                              </a>
                            </div>
                          </div>
                        </div>

                      </div>
                    </button>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="news" className="mt-0">
                <div className="space-y-3" data-testid="panel-news">
                  {([
                    {
                      id: "hub-001",
                      title: "Profile badges now supported",
                      source: "TheHub",
                      time: "2h",
                      tag: "Training",
                      body: "New badge packs are available for Agent profiles. Add credibility to your outreach with verified credentials.",
                    },
                    {
                      id: "hub-002",
                      title: "Supplier bulletin: 2026 cabin allocation",
                      source: "TheHub",
                      time: "Yesterday",
                      tag: "News",
                      body: "Early access allocations released for key routes. Review priority clients and prepare pre-quotes.",
                    },
                    {
                      id: "hub-003",
                      title: "SOP update: deposit & payment schedule",
                      source: "TheHub",
                      time: "3d",
                      tag: "SOP",
                      body: "A revised deposit timeline is live. Use the new schedule in all quotes to avoid reconciliation issues.",
                    },
                  ] as const).map((n) => (
                    <button
                      key={n.id}
                      className="w-full rounded-3xl border border-black/10 bg-black/5 p-4 text-left transition hover:bg-black/7 active:scale-[0.99] dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                      data-testid={`card-news-${n.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="truncate text-sm font-semibold" data-testid={`text-news-title-${n.id}`}>
                              {n.title}
                            </div>
                            <span className="text-xs text-black/35 dark:text-white/35" data-testid={`text-news-time-${n.id}`}>
                              {n.time}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55 dark:text-white/55">
                            <span data-testid={`text-news-source-${n.id}`}>{n.source}</span>
                            <span className="text-black/25 dark:text-white/25">•</span>
                            <span data-testid={`text-news-tag-${n.id}`}>{n.tag}</span>
                          </div>
                          <div className="mt-2 text-xs text-black/60 dark:text-white/60" data-testid={`text-news-body-${n.id}`}>
                            {n.body}
                          </div>
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 text-black/40 dark:text-white/45" />
                      </div>
                    </button>
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

    if (active === "agent-settings") {
      return (
        <section className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-settings-title">
                  Settings
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-settings-subtitle">
                  Manage your profile and preferences.
                </div>
              </div>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="text-sm font-semibold">Preview As</div>
                <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      <UserRound className="h-4 w-4 text-black/70 dark:text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">View as Role</div>
                      <div className="text-xs text-black/55 dark:text-white/55">Preview the interface as different user types</div>
                    </div>
                  </div>
                  <select
                    value={rolePreview || actualRole}
                    onChange={(e) => {
                      const newRole = e.target.value as Role;
                      setRolePreview(newRole === actualRole ? null : newRole);
                    }}
                    className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-white/5 dark:text-white min-w-[130px] cursor-pointer"
                    data-testid="select-role-preview"
                  >
                    {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
                      <option key={r} value={r}>
                        {r}{r === actualRole ? " (actual)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">Appearance</div>
                <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      {theme === "dark" ? <Moon className="h-4 w-4 text-black/70 dark:text-white/80" /> : <Sun className="h-4 w-4 text-black/70 dark:text-white/80" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium">Theme</div>
                      <div className="text-xs text-black/55 dark:text-white/55">Switch between light and dark mode</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 text-xs dark:border-white/10 dark:bg-white/5">
                    <span className={theme === "light" ? "text-black font-medium" : "text-black/45 dark:text-white/45"}>Light</span>
                    <Switch checked={theme === "dark"} onCheckedChange={() => setTheme(t => t === "dark" ? "light" : "dark")} data-testid="switch-theme" />
                    <span className={theme === "dark" ? "text-white font-medium" : "text-black/45 dark:text-white/45"}>Dark</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">Profile</div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="" className="h-12 w-12 rounded-2xl" data-testid="img-avatar" />
                      ) : (
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-medium" data-testid="img-avatar-placeholder">
                          {displayName?.charAt(0).toUpperCase() || "U"}
                        </div>
                      )}
                      <div>
                        <div className="text-sm font-medium">Avatar</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Update your profile picture</div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white"
                      data-testid="button-change-avatar"
                    >
                      <Camera className="mr-2 h-4 w-4" />
                      Change
                    </Button>
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <Mail className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Email Address</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Your primary email for notifications</div>
                      </div>
                    </div>
                    <Input
                      type="email"
                      defaultValue={user?.email || ""}
                      placeholder="email@example.com"
                      className="h-10 rounded-xl border-black/10 bg-white/50 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-black/20 dark:text-white"
                      data-testid="input-email"
                    />
                  </div>

                  <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <Phone className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Phone Number</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Contact number for urgent matters</div>
                      </div>
                    </div>
                    <Input
                      type="tel"
                      placeholder="+44 7XXX XXX XXX"
                      className="h-10 rounded-xl border-black/10 bg-white/50 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-black/20 dark:text-white"
                      data-testid="input-phone"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">Notifications</div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <Bell className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">Email Notifications</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Receive updates about enquiries and bookings</div>
                      </div>
                    </div>
                    <Switch defaultChecked data-testid="switch-email-notifications" />
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                        <MessageSquare className="h-4 w-4 text-black/70 dark:text-white/80" />
                      </div>
                      <div>
                        <div className="text-sm font-medium">SMS Notifications</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Get text alerts for urgent bookings</div>
                      </div>
                    </div>
                    <Switch data-testid="switch-sms-notifications" />
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  className="h-10 rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                  data-testid="button-save-settings"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="space-y-1">
                <div className="text-sm font-semibold" data-testid="text-account-title">Account</div>
                <div className="text-xs text-muted-foreground">Manage your account settings</div>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="space-y-2">
                <button
                  className="w-full flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid="button-change-password"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      <Shield className="h-4 w-4 text-black/70 dark:text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Change Password</div>
                      <div className="text-xs text-black/55 dark:text-white/55">Update your security credentials</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/45" />
                </button>

                <button
                  className="w-full flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid="button-two-factor"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      <Smartphone className="h-4 w-4 text-black/70 dark:text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Two-Factor Authentication</div>
                      <div className="text-xs text-black/55 dark:text-white/55">Add an extra layer of security</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/45" />
                </button>

                <button
                  className="w-full flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                  data-testid="button-connected-accounts"
                >
                  <div className="flex items-center gap-3">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                      <Link2 className="h-4 w-4 text-black/70 dark:text-white/80" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Connected Accounts</div>
                      <div className="text-xs text-black/55 dark:text-white/55">Manage linked services</div>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-black/40 dark:text-white/45" />
                </button>
              </div>
            </Card>
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
                {(apiUsers || []).map((u: any, idx: number) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-3xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5"
                    data-testid={`row-user-${u.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 overflow-hidden">
                        {u.avatar || u.profileImageUrl ? (
                          <img src={u.avatar || u.profileImageUrl} alt="" className="h-9 w-9 object-cover" />
                        ) : (
                          <UserRound className="h-4 w-4 text-black/70 dark:text-white/80" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold" data-testid={`text-user-name-${u.id}`}>
                          {u.name}
                        </div>
                        <div className="text-xs text-black/55 dark:text-white/55" data-testid={`text-user-email-${u.id}`}>
                          {u.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={u.role}
                        onChange={(e) => updateUserMutation.mutate({ userId: u.id, role: e.target.value })}
                        className="rounded-xl border border-black/10 bg-black/5 px-2 py-1 text-xs font-medium text-black dark:border-white/10 dark:bg-white/5 dark:text-white cursor-pointer"
                        data-testid={`select-user-role-${u.id}`}
                        disabled={u.id === user?.id}
                      >
                        {["Admin", "Manager", "Agent", "Homeworker", "Referer"].map((r) => (
                          <option key={r} value={r} className="text-black bg-white">{r}</option>
                        ))}
                      </select>
                      {u.id !== user?.id && (
                        <button
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove ${u.name}?`)) {
                              deleteUserMutation.mutate(u.id);
                            }
                          }}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
                          data-testid={`button-delete-user-${u.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {(!apiUsers || apiUsers.length === 0) && (
                  <div className="rounded-2xl border border-dashed border-black/10 p-4 text-center text-sm text-black/45 dark:border-white/10 dark:text-white/45">
                    No users found
                  </div>
                )}
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

      if (active === "tour-operators") {
        const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split("\n").filter(line => line.trim());
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(",").map(v => v.trim());
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
              createTourOperatorMutation.mutate({
                name: row.name || row["operator name"] || "",
                holidayType: row.holidaytype || row["holiday type"] || row.type || "",
                commissionPercent: row.commission || row.commissionpercent || row["commission %"] || "10",
                username: row.username || row.user || "",
                password: row.password || row.pass || "",
                contact: row.contact || row.email || row.phone || "",
              });
            }
          };
          reader.readAsText(file);
          e.target.value = "";
        };

        const filteredTourOperators = (tourOperators || []).filter((op) => {
          const q = tourOperatorSearch.trim().toLowerCase();
          if (!q) return true;
          return [op.name, op.holidayType, op.contact || ""].join(" ").toLowerCase().includes(q);
        });

        return (
          <section>
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-tour-operators-title">Tour Operators</div>
                  <div className="text-xs text-muted-foreground">Manage your tour operator partnerships.</div>
                </div>
                <div className="flex gap-2">
                  <div className="relative z-10">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40 z-0" />
                    <input
                      type="text"
                      placeholder="Search operators..."
                      value={tourOperatorSearch}
                      onChange={(e) => setTourOperatorSearch(e.target.value)}
                      className="w-48 h-9 pl-9 pr-3 rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 relative z-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="input-search-tour-operators"
                    />
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleCsvUpload}
                      data-testid="input-csv-upload"
                    />
                    <span className="inline-flex items-center rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-sm font-medium text-black hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload CSV
                    </span>
                  </label>
                  <Button
                    onClick={() => {
                      const name = prompt("Enter operator name:");
                      if (!name) return;
                      const holidayType = prompt("Holiday type (e.g. Beach, Ski, Adventure):") || "";
                      const commissionPercent = prompt("Commission % (e.g. 10):") || "10";
                      const username = prompt("Login username:") || "";
                      const password = prompt("Login password:") || "";
                      const contact = prompt("Contact info:") || "";
                      createTourOperatorMutation.mutate({ name, holidayType, commissionPercent, username, password, contact });
                    }}
                    className="rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    data-testid="button-add-tour-operator"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Operator
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10">
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Name</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Holiday Type</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Commission %</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Username</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Password</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Contact</th>
                      <th className="py-3 px-2 text-right font-medium text-black/70 dark:text-white/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTourOperators.map((op) => (
                      <tr key={op.id} className="border-b border-black/5 dark:border-white/5" data-testid={`row-tour-operator-${op.id}`}>
                        <td className="py-3 px-2 font-medium">{op.name}</td>
                        <td className="py-3 px-2">{op.holidayType}</td>
                        <td className="py-3 px-2">{op.commissionPercent}%</td>
                        <td className="py-3 px-2 font-mono text-xs">{op.username || "—"}</td>
                        <td className="py-3 px-2 font-mono text-xs">{op.password ? "••••••" : "—"}</td>
                        <td className="py-3 px-2">{op.contact || "—"}</td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteTourOperatorMutation.mutate(op.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            data-testid={`button-delete-tour-operator-${op.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredTourOperators.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-black/50 dark:text-white/50">
                          {tourOperatorSearch ? "No matching operators found." : "No tour operators yet. Add your first operator above."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        );
      }

      if (active === "airports") {
        const handleAirportCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split("\n").filter(line => line.trim());
            const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(",").map(v => v.trim());
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
              createAirportMutation.mutate({
                name: row.name || row["airport name"] || "",
                code: row.code || row["airport code"] || row.iata || "",
                country: row.country || "",
              });
            }
          };
          reader.readAsText(file);
          e.target.value = "";
        };

        console.log("airportSearch:", airportSearch, "airportsList length:", airportsList?.length);
        const filteredAirports = (airportsList || []).filter((airport) => {
          const q = airportSearch.trim().toLowerCase();
          if (!q) return true;
          const matches = airport.name.toLowerCase().includes(q) ||
            airport.code.toLowerCase().includes(q) ||
            airport.country.toLowerCase().includes(q);
          if (q === "man") {
            console.log("Checking:", airport.name, airport.code, "matches:", matches);
          }
          return matches;
        });
        console.log("filteredAirports count:", filteredAirports.length);

        return (
          <section>
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-airports-title">Airports</div>
                  <div className="text-xs text-muted-foreground">Manage airports for quotes and bookings.</div>
                </div>
                <div className="flex gap-2">
                  <div className="relative z-10">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40 z-0" />
                    <input
                      type="text"
                      placeholder="Search airports..."
                      value={airportSearch}
                      onChange={(e) => setAirportSearch(e.target.value)}
                      className="w-48 h-9 pl-9 pr-3 rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5 relative z-20 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      data-testid="input-search-airports"
                    />
                  </div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".csv,.txt"
                      className="hidden"
                      onChange={handleAirportCsvUpload}
                      data-testid="input-airports-csv-upload"
                    />
                    <span className="inline-flex items-center rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-sm font-medium text-black hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload CSV
                    </span>
                  </label>
                  <Button
                    onClick={() => {
                      const name = prompt("Enter airport name:");
                      if (!name) return;
                      const code = prompt("Airport code (e.g. LHR, JFK):") || "";
                      const country = prompt("Country:") || "";
                      createAirportMutation.mutate({ name, code, country });
                    }}
                    className="rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    data-testid="button-add-airport"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Airport
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/10 dark:border-white/10">
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Airport Name</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Airport Code</th>
                      <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Country</th>
                      <th className="py-3 px-2 text-right font-medium text-black/70 dark:text-white/70">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAirports.map((airport) => (
                      <tr key={airport.id} className="border-b border-black/5 dark:border-white/5" data-testid={`row-airport-${airport.id}`}>
                        <td className="py-3 px-2 font-medium">{airport.name}</td>
                        <td className="py-3 px-2 font-mono">{airport.code}</td>
                        <td className="py-3 px-2">{airport.country}</td>
                        <td className="py-3 px-2 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteAirportMutation.mutate(airport.id)}
                            className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                            data-testid={`button-delete-airport-${airport.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {filteredAirports.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-black/50 dark:text-white/50">
                          {airportSearch ? "No matching airports found." : "No airports yet. Add your first airport above."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        );
      }

      if (active === "settings") {
        return (
          <section className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setSettingsTab("general")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  settingsTab === "general"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                }`}
                data-testid="tab-settings-general"
              >
                General
              </button>
              <button
                onClick={() => setSettingsTab("tour-operators")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  settingsTab === "tour-operators"
                    ? "bg-black text-white dark:bg-white dark:text-black"
                    : "bg-black/5 text-black/70 hover:bg-black/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                }`}
                data-testid="tab-settings-tour-operators"
              >
                Tour Operators
              </button>
            </div>

            {settingsTab === "tour-operators" ? (
              <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold" data-testid="text-tour-operators-title">Tour Operators</div>
                    <div className="text-xs text-muted-foreground">Manage your tour operator partnerships.</div>
                  </div>
                  <Button
                    onClick={() => {
                      const name = prompt("Enter operator name:");
                      if (!name) return;
                      const holidayType = prompt("Holiday type (e.g. Beach, Ski, Adventure):") || "";
                      const commissionPercent = prompt("Commission % (e.g. 10):") || "10";
                      const username = prompt("Login username:") || "";
                      const password = prompt("Login password:") || "";
                      const contact = prompt("Contact info:") || "";
                      createTourOperatorMutation.mutate({ name, holidayType, commissionPercent, username, password, contact });
                    }}
                    className="rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    data-testid="button-add-tour-operator"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Operator
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-black/10 dark:border-white/10">
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Name</th>
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Holiday Type</th>
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Commission %</th>
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Username</th>
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Password</th>
                        <th className="py-3 px-2 text-left font-medium text-black/70 dark:text-white/70">Contact</th>
                        <th className="py-3 px-2 text-right font-medium text-black/70 dark:text-white/70">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(tourOperators || []).map((op) => (
                        <tr key={op.id} className="border-b border-black/5 dark:border-white/5" data-testid={`row-tour-operator-${op.id}`}>
                          <td className="py-3 px-2 font-medium">{op.name}</td>
                          <td className="py-3 px-2">{op.holidayType}</td>
                          <td className="py-3 px-2">{op.commissionPercent}%</td>
                          <td className="py-3 px-2 font-mono text-xs">{op.username || "—"}</td>
                          <td className="py-3 px-2 font-mono text-xs">{op.password ? "••••••" : "—"}</td>
                          <td className="py-3 px-2">{op.contact || "—"}</td>
                          <td className="py-3 px-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteTourOperatorMutation.mutate(op.id)}
                              className="h-8 w-8 p-0 text-red-500 hover:bg-red-50 dark:hover:bg-red-950"
                              data-testid={`button-delete-tour-operator-${op.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {(!tourOperators || tourOperators.length === 0) && (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-black/50 dark:text-white/50">
                            No tour operators yet. Add your first operator above.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
            <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-admin-settings-title">
                    Admin Settings
                  </div>
                  <div className="text-xs text-muted-foreground" data-testid="text-admin-settings-subtitle">
                    Configure organisation-wide preferences.
                  </div>
                </div>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="space-y-6">
                <div className="space-y-3">
                  <div className="text-sm font-semibold">Organisation</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <Building2 className="h-4 w-4 text-black/70 dark:text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Company Name</div>
                          <div className="text-xs text-black/55 dark:text-white/55">Displayed across the platform</div>
                        </div>
                      </div>
                      <Input 
                        defaultValue="Travana Travel" 
                        className="w-48 rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        data-testid="input-company-name"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <Mail className="h-4 w-4 text-black/70 dark:text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Support Email</div>
                          <div className="text-xs text-black/55 dark:text-white/55">For customer enquiries</div>
                        </div>
                      </div>
                      <Input 
                        defaultValue="hello@travana.co.uk" 
                        className="w-48 rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        data-testid="input-support-email"
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <Phone className="h-4 w-4 text-black/70 dark:text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Support Phone</div>
                          <div className="text-xs text-black/55 dark:text-white/55">UK business line</div>
                        </div>
                      </div>
                      <Input 
                        defaultValue="+44 20 7946 0958" 
                        className="w-48 rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                        data-testid="input-support-phone"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-black/10 dark:bg-white/10" />

                <div className="space-y-3">
                  <div className="text-sm font-semibold">Defaults</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <CircleDollarSign className="h-4 w-4 text-black/70 dark:text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Currency</div>
                          <div className="text-xs text-black/55 dark:text-white/55">Default for all quotes</div>
                        </div>
                      </div>
                      <select 
                        defaultValue="GBP"
                        className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                        data-testid="select-currency"
                      >
                        <option value="GBP">GBP (£)</option>
                        <option value="EUR">EUR (€)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                          <Ticket className="h-4 w-4 text-black/70 dark:text-white/80" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">Default Commission</div>
                          <div className="text-xs text-black/55 dark:text-white/55">Applied to new bookings</div>
                        </div>
                      </div>
                      <select 
                        defaultValue="10"
                        className="rounded-xl border border-black/10 bg-black/5 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5"
                        data-testid="select-commission"
                      >
                        <option value="5">5%</option>
                        <option value="10">10%</option>
                        <option value="12">12%</option>
                        <option value="15">15%</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <Button 
                    className="w-full rounded-2xl bg-black text-white hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90"
                    data-testid="button-save-org-settings"
                  >
                    Save Changes
                  </Button>
                </div>
              </div>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="glass ringed grain rounded-3xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-black/70 dark:text-white/70">Integrations</div>
                    <div className="title-serif text-lg font-semibold">Connected Services</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <Link2 className="h-5 w-5 text-black/70 dark:text-white/80" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {[
                    { name: "Travelport GDS", status: "connected", icon: "✈️" },
                    { name: "Stripe Payments", status: "connected", icon: "💳" },
                    { name: "Mailchimp", status: "pending", icon: "📧" },
                    { name: "Xero Accounting", status: "disconnected", icon: "📊" },
                  ].map((int, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5"
                      data-testid={`row-integration-${i}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{int.icon}</span>
                        <span className="text-sm font-medium">{int.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`rounded-full text-xs ${
                          int.status === "connected"
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : int.status === "pending"
                            ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                            : "border-black/10 bg-black/5 text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50"
                        }`}
                        data-testid={`status-integration-${i}`}
                      >
                        {int.status}
                      </Badge>
                    </div>
                  ))}
                </div>
                <Button
                  variant="outline"
                  className="mt-3 w-full rounded-2xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                  data-testid="button-manage-integrations"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Integration
                </Button>
              </Card>

              <Card className="glass ringed grain rounded-3xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-black/70 dark:text-white/70">Security</div>
                    <div className="title-serif text-lg font-semibold">Access Controls</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <Shield className="h-5 w-5 text-black/70 dark:text-white/80" />
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <span className="text-sm">Require 2FA for all users</span>
                    <button
                      className="h-6 w-11 rounded-full bg-emerald-500 p-0.5 transition"
                      data-testid="toggle-2fa"
                    >
                      <div className="h-5 w-5 translate-x-5 rounded-full bg-white shadow transition" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <span className="text-sm">Session timeout (hours)</span>
                    <select 
                      defaultValue="8"
                      className="rounded-lg border border-black/10 bg-black/5 px-2 py-1 text-sm dark:border-white/10 dark:bg-white/5"
                      data-testid="select-session-timeout"
                    >
                      <option value="4">4</option>
                      <option value="8">8</option>
                      <option value="24">24</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                    <span className="text-sm">IP Allowlisting</span>
                    <button
                      className="h-6 w-11 rounded-full bg-black/20 p-0.5 transition dark:bg-white/20"
                      data-testid="toggle-ip-allowlist"
                    >
                      <div className="h-5 w-5 translate-x-0 rounded-full bg-white shadow transition" />
                    </button>
                  </div>
                </div>
              </Card>

              <div className="rounded-3xl border border-black/10 bg-black/5 p-4 ringed dark:border-white/10 dark:bg-white/5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs text-black/70 dark:text-white/70">Data</div>
                    <div className="title-serif text-lg font-semibold">Export & Backup</div>
                  </div>
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-3xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <FileText className="h-5 w-5 text-black/70 dark:text-white/80" />
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-2xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    data-testid="button-export-clients"
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Export All Clients (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-2xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    data-testid="button-export-bookings"
                  >
                    <Ticket className="mr-2 h-4 w-4" />
                    Export Bookings (CSV)
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start rounded-2xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    data-testid="button-backup"
                  >
                    <Activity className="mr-2 h-4 w-4" />
                    Create Full Backup
                  </Button>
                </div>
              </div>
            </div>
            </div>
            )}
          </section>
        );
      }

      return (
        <EmptyState
          title="Admin module"
          desc="Select a section from the navigation to configure organisation settings, users, or view audit logs."
          action="Open Settings"
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
  }, [active, clients, role, tab, theme, setTheme, user, displayName, rolePreview, setRolePreview, actualRole, airportSearch, tourOperatorSearch, airportsList, tourOperators]);

  return (
    <div className={themeClass}>
      <div className="app-shell px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4">
        <div className="w-full space-y-3">
          <div className="grid gap-3 lg:grid-cols-[320px_1fr]">
            <ShellNav 
              role={role} 
              active={active} 
              onActiveChange={setActive}
              actualRole={actualRole}
              rolePreview={rolePreview}
              onRoleChange={setRolePreview}
            />

            <div className="flex flex-col gap-3">
              <TopBar
                role={role}
                active={active}
                query={query}
                onQuery={setQuery}
                theme={theme}
                onToggleTheme={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
                userName={displayName}
                userAvatar={user?.profileImageUrl}
                onLogout={() => window.location.href = "/api/logout"}
                actualRole={actualRole}
                rolePreview={rolePreview}
                onRoleChange={setRolePreview}
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
