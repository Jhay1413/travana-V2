import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
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
  Lightbulb,
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
  X,
} from "lucide-react";
import { NotificationsDropdown } from "./notifications-dropdown";
import { useCurrentUser, useNeonClients } from "@/hooks/queries";

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
    "data-import": "/admin/import",
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

const DID_YOU_KNOW_TIPS = [
  {
    title: "CSV Import",
    body: "You can bulk-import clients from a CSV file. Head to the Clients page and click the import button to get started.",
  },
  {
    title: "JSON Quote Upload",
    body: "Speed up quote creation by uploading a JSON file — fields like flights, accommodation, and pricing fill in automatically.",
  },
  {
    title: "Lead Source Tracking",
    body: "Track where your enquiries come from. Set a Lead Source on every quote to see which channels drive the most bookings.",
  },
  {
    title: "Quick Client Search",
    body: "Use the search bar at the top to instantly find any client by name, phone number, or email.",
  },
  {
    title: "Role Switching",
    body: "Switch between Admin, Manager, Agent, Homeworker, and Referer views using the role selector in the sidebar.",
  },
  {
    title: "Commission Breakdown",
    body: "Open any quote and switch to the Costings tab to see a full financial breakdown including net-to-agency figures.",
  },
  {
    title: "Quote Images",
    body: "Attach destination photos to your quotes to give clients a visual preview of their holiday.",
  },
  {
    title: "Ticket System",
    body: "Use the Tickets section under Connect to manage customer support requests and internal tasks.",
  },
  {
    title: "Client Stages",
    body: "Track client progress from New Lead through to Booked using client stage labels on the Clients page.",
  },
  {
    title: "Keyboard Navigation",
    body: "Press the search bar shortcut to quickly jump to client lookup without reaching for the mouse.",
  },
];

const STORAGE_KEY = "dyk-dismissed";
const COOLDOWN_KEY = "dyk-last-shown";
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function DidYouKnowPopup() {
  const [tip, setTip] = useState<typeof DID_YOU_KNOW_TIPS[number] | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const lastShown = localStorage.getItem(COOLDOWN_KEY);
    if (lastShown && Date.now() - parseInt(lastShown, 10) < COOLDOWN_MS) return;

    const dismissed: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const unseen = DID_YOU_KNOW_TIPS.map((t, i) => ({ ...t, idx: i })).filter(
      (t) => !dismissed.includes(t.idx)
    );

    let pick: typeof DID_YOU_KNOW_TIPS[number] & { idx: number };
    if (unseen.length === 0) {
      localStorage.setItem(STORAGE_KEY, "[]");
      const fresh = DID_YOU_KNOW_TIPS.map((t, i) => ({ ...t, idx: i }));
      pick = fresh[Math.floor(Math.random() * fresh.length)];
    } else {
      pick = unseen[Math.floor(Math.random() * unseen.length)];
    }

    const timer = setTimeout(() => {
      setTip(pick);
      setVisible(true);
      localStorage.setItem(COOLDOWN_KEY, String(Date.now()));
      const d: number[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (!d.includes(pick.idx)) {
        d.push(pick.idx);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
      }
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  if (!tip) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-5 right-5 z-[10000] w-[340px] rounded-2xl border border-amber-200/60 bg-amber-50/95 p-4 shadow-xl backdrop-blur-xl dark:border-amber-500/30 dark:bg-amber-950/90"
          data-testid="popup-did-you-know"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-200/60 dark:bg-amber-500/20">
              <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80" data-testid="text-dyk-label">
                  Did you know?
                </span>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg text-amber-500/60 transition hover:bg-amber-200/50 hover:text-amber-700 dark:hover:bg-amber-500/20 dark:hover:text-amber-300"
                  data-testid="button-dyk-dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1 text-sm font-semibold text-amber-900 dark:text-amber-100" data-testid="text-dyk-title">
                {tip.title}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-amber-800/75 dark:text-amber-200/70" data-testid="text-dyk-body">
                {tip.body}
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="mt-2.5 text-[11px] font-semibold text-amber-600 transition hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
                data-testid="button-dyk-got-it"
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
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
  headerExtra,
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
  headerExtra?: React.ReactNode;
}) {
  const [, navigate] = useLocation();
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data: currentUser } = useCurrentUser();

  const { data: searchData } = useNeonClients(
    query?.trim() ? { page: 1, limit: 8, search: query.trim() } : undefined
  );

  const searchResults = useMemo(() => {
    if (!query?.trim() || !searchData?.clients) return [];
    return searchData.clients
      .slice(0, 8)
      .map((c: any) => ({
        id: c.id,
        name: [c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown",
        phone: c.phoneNumber || "",
        email: c.email || "",
        location: [c.city, c.country].filter(Boolean).join(", "),
        clientType: "Client",
      }));
  }, [query, searchData]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
              { key: "data-import", label: "Data Import", icon: <Globe className="h-4 w-4" /> },
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

                  const connectRoute = key === "tickets" ? "/tickets" : "/";
                  const isConnectActive = active === "tickets" && key === "tickets";
                  return (
                    <Link
                      key={key}
                      href={connectRoute}
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
                    </Link>
                  );
                })}
              </div>
            </div>
          </aside>

          <div className="flex flex-col gap-3">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5" data-testid="topbar-command-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h1 className="title-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="text-page-title">
                      {title}
                    </h1>
                    {subtitle ? (
                      <span className="hidden md:inline text-xs text-black/45 dark:text-white/45" data-testid="text-page-hint">
                        {subtitle}
                      </span>
                    ) : null}
                    {headerExtra}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-[360px] z-[9999]" ref={searchRef}>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50 z-10" />
                    <Input
                      value={query ?? ""}
                      onChange={(e) => {
                        onQuery?.(e.target.value);
                        setShowSearchResults(true);
                      }}
                      onFocus={() => query?.trim() && setShowSearchResults(true)}
                      placeholder="Search clients, trips, destinations…"
                      className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
                      data-testid="input-search"
                    />
                    {showSearchResults && searchResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] overflow-hidden">
                        {searchResults.map((client: any) => (
                          <button
                            key={client.id}
                            onClick={() => {
                              navigate(`/clients/${client.id}`);
                              setShowSearchResults(false);
                              onQuery?.("");
                            }}
                            className="w-full px-4 py-3 text-left hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5 last:border-b-0 transition-colors"
                            data-testid={`search-result-${client.id}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium text-sm">{client.name}</div>
                                <div className="text-xs text-black/50 dark:text-white/50">{client.phone}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs px-2 py-0.5 rounded-full bg-[#3b82f6]/10 text-[#3b82f6] border border-[#3b82f6]/30">
                                  {client.clientType || "New Client"}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                    {showSearchResults && query?.trim() && searchResults.length === 0 && (
                      <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] p-4">
                        <p className="text-center text-sm text-black/50 dark:text-white/50 mb-3">
                          No clients found matching "{query}"
                        </p>
                        <Button
                          className="w-full h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                          onClick={() => {
                            setShowSearchResults(false);
                            navigate("/clients?new=true&name=" + encodeURIComponent(query || ""));
                          }}
                          data-testid="button-add-client-from-search"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Client "{query}"
                        </Button>
                      </div>
                    )}
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
                      className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
      <DidYouKnowPopup />
    </div>
  );
}
