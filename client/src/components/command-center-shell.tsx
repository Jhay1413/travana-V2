import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  BadgeCheck,
  Banknote,
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  CheckCircle,
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
  Menu,
  MessageSquare,
  MessageSquarePlus,
  Phone,
  Plane,
  Plus,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Ticket,
  Share2,
  Target,
  Trash2,
  TrendingUp,
  Users,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Gift,
} from "lucide-react";
import { NotificationsDropdown } from "./notifications-dropdown";
import { useCurrentUser, useNotifications, useChatConversations } from "@/hooks/queries";
import { useGlobalSearch } from "@/hooks/queries/use-search-queries";
import { useMarkNotificationRead } from "@/hooks/mutations";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
    pipeline: "/pipeline",
    tickets: "/tickets",
    enquiries: "/?s=enquiries",
    quotes: "/?s=quotes",
    bookings: "/?s=bookings",
    "agent-settings": "/?s=agent-settings",
    "agent-overview": "/?s=agent-overview",
    "opportunities": "/?s=opportunities",
    "tour-operators": "/settings/tour-operators",
    "airports": "/settings/airports",
    "countries": "/settings/countries",
    "destinations": "/settings/destinations",
    "resorts-admin": "/settings/resorts",
    "accommodation-types": "/settings/accommodation-types",
    "accommodation-list": "/settings/accommodation-list",
    "board-basis": "/settings/board-basis",
    "package-types": "/settings/package-types",
    "package-commissions": "/settings/package-commissions",
    "parks": "/settings/parks",
    "cottages-admin": "/settings/cottages",
    "lodges-admin": "/settings/lodges",
    "cruise-extras": "/settings/cruise-extras",
    "cruise-lines": "/settings/cruise-lines",
    "cruise-ships": "/settings/cruise-ships",
    "cruise-itineraries": "/settings/cruise-itineraries",
    "cruise-voyages": "/settings/cruise-voyages",
    "room-types": "/settings/room-types",
    "deletion-codes": "/settings/deletion-codes",
    "destination-guru": "/destination-guru",
    "financials": "/?s=financials",
    "financials-targets": "/?s=financials-targets",
    "admin-settings-page": "/?s=admin-settings-page",
    org: "/?s=org",
    users: "/?s=users",
    audit: "/?s=audit",
    settings: "/?s=settings",
    team: "/?s=team",
    coverage: "/?s=coverage",
    coaching: "/?s=coaching",
    reports: "/?s=reports",
    assigned: "/?s=assigned",
    callbacks: "/?s=callbacks",
    messages: "/?s=messages",
    leads: "/?s=leads",
    commission: "/?s=commission",
    payouts: "/?s=payouts",
    hub: "/hub",
    "social-posts": "/social-posts",
    "feedback": "/feedback",
    "connect-internal-chat": "/?s=connect-internal-chat",
    "referrals": "/?s=referrals",
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

const NOTIF_TOAST_SEEN_KEY = "notif-toast-seen-ids";

const NOTIF_STYLE: Record<string, { icon: typeof Bell; label: string; border: string; bg: string; iconBg: string; iconColor: string; labelColor: string; titleColor: string; bodyColor: string; btnColor: string; btnHover: string; dismissColor: string; dismissHover: string }> = {
  chat_message: {
    icon: MessageSquare,
    label: "New Message",
    border: "border-blue-200/60 dark:border-blue-500/30",
    bg: "bg-blue-50/95 dark:bg-blue-950/90",
    iconBg: "bg-blue-200/60 dark:bg-blue-500/20",
    iconColor: "text-blue-600 dark:text-blue-400",
    labelColor: "text-blue-600/80 dark:text-blue-400/80",
    titleColor: "text-blue-900 dark:text-blue-100",
    bodyColor: "text-blue-800/75 dark:text-blue-200/70",
    btnColor: "text-blue-600 dark:text-blue-400",
    btnHover: "hover:text-blue-800 dark:hover:text-blue-200",
    dismissColor: "text-blue-500/60",
    dismissHover: "hover:bg-blue-200/50 hover:text-blue-700 dark:hover:bg-blue-500/20 dark:hover:text-blue-300",
  },
  task_due: {
    icon: CheckCircle,
    label: "Task Due",
    border: "border-orange-200/60 dark:border-orange-500/30",
    bg: "bg-orange-50/95 dark:bg-orange-950/90",
    iconBg: "bg-orange-200/60 dark:bg-orange-500/20",
    iconColor: "text-orange-600 dark:text-orange-400",
    labelColor: "text-orange-600/80 dark:text-orange-400/80",
    titleColor: "text-orange-900 dark:text-orange-100",
    bodyColor: "text-orange-800/75 dark:text-orange-200/70",
    btnColor: "text-orange-600 dark:text-orange-400",
    btnHover: "hover:text-orange-800 dark:hover:text-orange-200",
    dismissColor: "text-orange-500/60",
    dismissHover: "hover:bg-orange-200/50 hover:text-orange-700 dark:hover:bg-orange-500/20 dark:hover:text-orange-300",
  },
  ticket_due: {
    icon: LifeBuoy,
    label: "Ticket Alert",
    border: "border-red-200/60 dark:border-red-500/30",
    bg: "bg-red-50/95 dark:bg-red-950/90",
    iconBg: "bg-red-200/60 dark:bg-red-500/20",
    iconColor: "text-red-600 dark:text-red-400",
    labelColor: "text-red-600/80 dark:text-red-400/80",
    titleColor: "text-red-900 dark:text-red-100",
    bodyColor: "text-red-800/75 dark:text-red-200/70",
    btnColor: "text-red-600 dark:text-red-400",
    btnHover: "hover:text-red-800 dark:hover:text-red-200",
    dismissColor: "text-red-500/60",
    dismissHover: "hover:bg-red-200/50 hover:text-red-700 dark:hover:bg-red-500/20 dark:hover:text-red-300",
  },
};

const DEFAULT_STYLE = NOTIF_STYLE.chat_message;

export function NotificationToast() {
  const { data: currentUser } = useCurrentUser();
  const userId = currentUser?.id || "";
  const { data: notifications = [] } = useNotifications(userId);
  const markReadMutation = useMarkNotificationRead(userId);
  const [, setLocation] = useLocation();

  const [toastQueue, setToastQueue] = useState<Array<{ id: string; type: string; title: string; message: string; link: string | null }>>([]);
  const [visible, setVisible] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !notifications.length) return;

    const unreadToShow = notifications.filter(
      (n) => !n.read && !shownIdsRef.current.has(n.id)
    );

    if (unreadToShow.length > 0) {
      unreadToShow.forEach((n) => shownIdsRef.current.add(n.id));
      setToastQueue((prev) => {
        const existingIds = new Set(prev.map((p) => p.id));
        const newItems = unreadToShow
          .filter((n) => !existingIds.has(n.id))
          .map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, link: n.link }));
        return [...prev, ...newItems];
      });
    }
  }, [notifications, userId]);

  useEffect(() => {
    if (toastQueue.length > 0 && !visible) {
      setVisible(true);
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
      autoHideTimer.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => setToastQueue((prev) => prev.slice(1)), 350);
      }, 6000);
    }
  }, [toastQueue, visible]);

  const currentNotif = toastQueue[0] || null;

  const dismiss = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    setVisible(false);
    if (currentNotif) markReadMutation.mutate(currentNotif.id);
    setTimeout(() => setToastQueue((prev) => prev.slice(1)), 350);
  };

  const handleClick = () => {
    if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    if (currentNotif) {
      markReadMutation.mutate(currentNotif.id);
      if (currentNotif.link) setLocation(currentNotif.link);
    }
    setVisible(false);
    setTimeout(() => setToastQueue((prev) => prev.slice(1)), 350);
  };

  if (!currentNotif) return null;

  const style = NOTIF_STYLE[currentNotif.type] || DEFAULT_STYLE;
  const Icon = style.icon;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={currentNotif.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={`fixed bottom-5 right-5 z-[10001] w-[360px] rounded-2xl border ${style.border} ${style.bg} p-4 shadow-xl backdrop-blur-xl cursor-pointer`}
          data-testid="popup-notification-toast"
          onClick={handleClick}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBg}`}>
              <Icon className={`h-4 w-4 ${style.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold uppercase tracking-wider ${style.labelColor}`} data-testid="text-notif-toast-label">
                  {style.label}
                </span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); dismiss(); }}
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${style.dismissColor} transition ${style.dismissHover}`}
                  data-testid="button-notif-toast-dismiss"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className={`mt-1 text-sm font-semibold ${style.titleColor}`} data-testid="text-notif-toast-title">
                {currentNotif.title}
              </div>
              <p className={`mt-1 text-xs leading-relaxed ${style.bodyColor} line-clamp-2`} data-testid="text-notif-toast-body">
                {currentNotif.message}
              </p>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); dismiss(); }}
                className={`mt-2.5 text-[11px] font-semibold ${style.btnColor} transition ${style.btnHover}`}
                data-testid="button-notif-toast-dismiss-text"
              >
                Dismiss
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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

const QUOTE_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "QUOTE_IN_PROGRESS", label: "Quote in Progress" },
  { value: "QUOTE_CALL", label: "Quote Call" },
  { value: "AWAITING_DECISION", label: "Awaiting Decision" },
  { value: "HOT_QUOTE", label: "Hot Quote" },
];

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
  filterSlot,
  quoteStatusFilter,
  onQuoteStatusFilterChange,
  createActions,
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
  filterSlot?: React.ReactNode;
  quoteStatusFilter?: string;
  onQuoteStatusFilterChange?: (v: string) => void;
  createActions?: Array<{ label: string; icon?: React.ReactNode; onClick: () => void }>;
}) {
  const [, navigate] = useLocation();
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });
  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }, []);
  const searchRef = useRef<HTMLDivElement>(null);

  const [localSearchText, setLocalSearchText] = useState(query ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const trimmed = localSearchText.trim();
    if (!trimmed) {
      setDebouncedSearch("");
      return;
    }
    const timer = setTimeout(() => setDebouncedSearch(trimmed), 250);
    return () => clearTimeout(timer);
  }, [localSearchText]);

  useEffect(() => {
    if (query !== undefined && query !== localSearchText) {
      setLocalSearchText(query);
    }
  }, [query]);

  const { data: currentUser } = useCurrentUser();

  const { data: sidebarChats } = useChatConversations();
  const unreadChatCount = useMemo(() => {
    if (!sidebarChats || !Array.isArray(sidebarChats)) return 0;
    return sidebarChats.filter((c: any) => c.unreadCount > 0).reduce((sum: number, c: any) => sum + c.unreadCount, 0);
  }, [sidebarChats]);

  const { data: searchResults } = useGlobalSearch(debouncedSearch);

  type GlobalSearchResult = {
    id: string;
    category: "client" | "quote" | "booking";
    title: string;
    subtitle: string;
    link: string;
    badge: string;
    badgeColor: string;
  };

  const globalSearchResults = useMemo(() => {
    if (!debouncedSearch || !searchResults) return [] as GlobalSearchResult[];
    const results: GlobalSearchResult[] = [];

    for (const c of searchResults.clients) {
      results.push({
        id: c.id,
        category: "client",
        title: c.name,
        subtitle: c.subtitle,
        link: `/clients/${c.id}`,
        badge: "Client",
        badgeColor: "bg-blue-500/10 text-blue-600 border-blue-500/30",
      });
    }

    const searchLower = debouncedSearch.toLowerCase();
    const clientNameMatches = (name: string) =>
      name.toLowerCase().split(/\s+/).some((word) => word.startsWith(searchLower) || searchLower.startsWith(word));

    const quoteResults = searchResults.quotes.map((q) => {
      const dest = q.destination || q.country || q.holidayType || "Quote";
      const formattedPrice = q.salesPrice ? `£${parseFloat(q.salesPrice).toLocaleString("en-GB")}` : "";
      const formattedDate = q.travelDate ? new Date(q.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
      return {
        id: `quote-${q.id}`,
        category: "quote" as const,
        title: `${dest}${q.clientName ? ` — ${q.clientName}` : ""}`,
        subtitle: [q.accommodation, formattedPrice, formattedDate].filter(Boolean).join(" · "),
        link: q.clientId ? `/clients/${q.clientId}/quotes/${q.id}` : `/quotes/${q.id}`,
        badge: "Quote",
        badgeColor: "bg-amber-500/10 text-amber-600 border-amber-500/30",
        _clientNameMatch: q.clientName ? clientNameMatches(q.clientName) : false,
      };
    });
    quoteResults.sort((a, b) => (b._clientNameMatch ? 1 : 0) - (a._clientNameMatch ? 1 : 0));
    results.push(...quoteResults.map(({ _clientNameMatch: _, ...r }) => r));

    const bookingResults = searchResults.bookings.map((b) => {
      const dest = b.destination || b.country || b.holidayType || "Booking";
      const formattedPrice = b.salesPrice ? `£${parseFloat(b.salesPrice).toLocaleString("en-GB")}` : "";
      const formattedDate = b.travelDate ? new Date(b.travelDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "";
      return {
        id: `booking-${b.id}`,
        category: "booking" as const,
        title: `${dest}${b.clientName ? ` — ${b.clientName}` : ""}`,
        subtitle: [b.haysRef && `Ref: ${b.haysRef}`, b.accommodation, formattedPrice, formattedDate].filter(Boolean).join(" · "),
        link: b.clientId ? `/clients/${b.clientId}/bookings/${b.id}` : `/bookings/${b.id}`,
        badge: "Booking",
        badgeColor: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
        _clientNameMatch: b.clientName ? clientNameMatches(b.clientName) : false,
      };
    });
    bookingResults.sort((a, b) => (b._clientNameMatch ? 1 : 0) - (a._clientNameMatch ? 1 : 0));
    results.push(...bookingResults.map(({ _clientNameMatch: _, ...r }) => r));

    return results;
  }, [debouncedSearch, searchResults]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  type NavItem = { key: string; label: string; icon: React.ReactNode; badge?: number; children?: NavItem[]; subGroups?: { label: string; items: NavItem[] }[] };
  type NavSection = { id: string; label: string; icon: React.ReactNode; items: NavItem[] };
  type NavStructure = { grouped: true; sections: NavSection[] } | { grouped: false; items: NavItem[] };

  const nav: NavStructure = useMemo(() => {
    const settingsSubGroups: NavItem["subGroups"] = [
      {
        label: "Admin Settings",
        items: [
          { key: "package-types", label: "Package Types", icon: <Ticket className="h-4 w-4" /> },
          { key: "package-commissions", label: "Package Commissions", icon: <CircleDollarSign className="h-4 w-4" /> },
          { key: "board-basis", label: "Board Basis", icon: <ListChecks className="h-4 w-4" /> },
          { key: "deletion-codes", label: "Deletion Codes", icon: <Trash2 className="h-4 w-4" /> },
        ],
      },
      {
        label: "Database Data",
        items: [
          { key: "tour-operators", label: "Tour Operators", icon: <Plane className="h-4 w-4" /> },
          { key: "airports", label: "Airports", icon: <MapPin className="h-4 w-4" /> },
          { key: "countries", label: "Countries", icon: <Globe className="h-4 w-4" /> },
          { key: "destinations", label: "Destinations", icon: <Compass className="h-4 w-4" /> },
          { key: "resorts-admin", label: "Resorts", icon: <MapPin className="h-4 w-4" /> },
          { key: "accommodation-types", label: "Accommodation Types", icon: <Building2 className="h-4 w-4" /> },
          { key: "accommodation-list", label: "Accommodation List", icon: <Building2 className="h-4 w-4" /> },
          { key: "parks", label: "Parks", icon: <Compass className="h-4 w-4" /> },
          { key: "cottages-admin", label: "Cottages", icon: <Building2 className="h-4 w-4" /> },
          { key: "lodges-admin", label: "Lodges", icon: <Building2 className="h-4 w-4" /> },
          { key: "cruise-extras", label: "Cruise Extras", icon: <LifeBuoy className="h-4 w-4" /> },
          { key: "cruise-lines", label: "Cruise Lines", icon: <LifeBuoy className="h-4 w-4" /> },
          { key: "cruise-ships", label: "Cruise Ships", icon: <LifeBuoy className="h-4 w-4" /> },
          { key: "cruise-itineraries", label: "Cruise Itineraries", icon: <LifeBuoy className="h-4 w-4" /> },
          { key: "cruise-voyages", label: "Cruise Voyage Days", icon: <LifeBuoy className="h-4 w-4" /> },
          { key: "room-types", label: "Room Types", icon: <Building2 className="h-4 w-4" /> },
        ],
      },
    ];

    const base: NavItem[] = [
      { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
      { key: "pipeline", label: "Pipeline", icon: <TrendingUp className="h-4 w-4" /> },
      { key: "tickets", label: "Tickets", icon: <LifeBuoy className="h-4 w-4" /> },
      { key: "connect-internal-chat", label: "Live Chat", icon: <MessageSquare className="h-4 w-4" />, badge: unreadChatCount },
      { key: "social-posts", label: "Social Posts", icon: <Share2 className="h-4 w-4" /> },
      { key: "destination-guru", label: "Destination Guru", icon: <Sparkles className="h-4 w-4" /> },
      { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
      { key: "opportunities", label: "Opportunities", icon: <Target className="h-4 w-4" /> },
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
              { key: "financials", label: "Revenue Dashboard", icon: <Banknote className="h-4 w-4" />, subGroups: [
                { label: "Revenue Dashboard", items: [
                  { key: "financials-targets", label: "Targets Admin", icon: <Target className="h-4 w-4" /> },
                ] },
              ] },
              { key: "referrals", label: "Referrals", icon: <Gift className="h-4 w-4" /> },
              { key: "admin-settings-page", label: "Admin Settings", icon: <Settings2 className="h-4 w-4" /> },
              { key: "settings", label: "Data Settings", icon: <ClipboardList className="h-4 w-4" />, subGroups: settingsSubGroups },
            ],
          },
          {
            id: "agent",
            label: "Agent Tools",
            icon: <Users className="h-4 w-4" />,
            items: [
              { key: "agent-overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
              { key: "pipeline", label: "Pipeline", icon: <TrendingUp className="h-4 w-4" /> },
              { key: "tickets", label: "Tickets", icon: <LifeBuoy className="h-4 w-4" /> },
              { key: "connect-internal-chat", label: "Live Chat", icon: <MessageSquare className="h-4 w-4" />, badge: unreadChatCount },
              { key: "social-posts", label: "Social Posts", icon: <Share2 className="h-4 w-4" /> },
              { key: "destination-guru", label: "Destination Guru", icon: <Sparkles className="h-4 w-4" /> },
              { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
              { key: "opportunities", label: "Opportunities", icon: <Target className="h-4 w-4" /> },
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
  }, [role, unreadChatCount]);

  const [expandedSections, setExpandedSections] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("admin-nav-expanded");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [expandedNavItems, setExpandedNavItems] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem("nav-items-expanded");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
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

  const toggleNavItem = (key: string) => {
    setExpandedNavItems(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key];
      sessionStorage.setItem("nav-items-expanded", JSON.stringify(next));
      return next;
    });
  };

  const RoleBadgeIcon = RoleIcon[role] ?? Sparkles;

  const renderNavItems = (onNavigate?: () => void) => (
    <>
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
                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
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
                        const hasSubGroups = item.subGroups && item.subGroups.length > 0;
                        const childActive = hasChildren && item.children!.some((c) => active === c.key);
                        const subGroupActive = hasSubGroups && item.subGroups!.some(g => g.items.some(c => active === c.key));
                        const isItemExpanded = expandedNavItems.includes(item.key) || subGroupActive;
                        return (
                          <div key={item.key}>
                            {hasSubGroups ? (
                              <button
                                type="button"
                                onClick={() => toggleNavItem(item.key)}
                                className={
                                  "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                                  (subGroupActive
                                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                    : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                                }
                                data-testid={`nav-${item.key}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={"inline-flex h-7 w-7 items-center justify-center rounded-lg border " + (subGroupActive ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10" : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")} aria-hidden>
                                    <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                                  </span>
                                  <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                <motion.div animate={{ rotate: isItemExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                  <ChevronRight className={"h-4 w-4 " + (subGroupActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                                </motion.div>
                              </button>
                            ) : (
                              <Link
                                href={getNavRoute(item.key)}
                                onClick={() => onNavigate?.()}
                                className={
                                  "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                                  (isActive || childActive
                                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                    : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                                }
                                data-testid={`nav-${item.key}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span className={"inline-flex h-7 w-7 items-center justify-center rounded-lg border " + (isActive || childActive ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10" : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")} aria-hidden>
                                    <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                                  </span>
                                  <span className="text-sm font-medium">{item.label}</span>
                                  {item.badge != null && item.badge > 0 && (
                                    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">{item.badge}</span>
                                  )}
                                </div>
                                <ChevronRight className={"h-4 w-4 " + (isActive || childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                              </Link>
                            )}
                            <AnimatePresence initial={false}>
                              {hasSubGroups && isItemExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="ml-6 mt-1 space-y-2 border-l border-black/10 pl-3 dark:border-white/10">
                                    {item.subGroups!.map((group) => (
                                      <div key={group.label}>
                                        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                                          {group.label}
                                        </div>
                                        {group.items.map((child) => (
                                          <Link key={child.key} href={getNavRoute(child.key)} onClick={() => onNavigate?.()} className={"flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition " + (active === child.key ? "bg-black/5 text-black dark:bg-white/10 dark:text-white" : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white")} data-testid={`nav-${child.key}`}>
                                            <span className="text-black/60 dark:text-white/60">{child.icon}</span>
                                            <span>{child.label}</span>
                                          </Link>
                                        ))}
                                      </div>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                            {hasChildren && (
                              <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                {item.children!.map((child) => (
                                  <Link key={child.key} href={getNavRoute(child.key)} onClick={() => onNavigate?.()} className={"flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition " + (active === child.key ? "bg-black/5 text-black dark:bg-white/10 dark:text-white" : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white")} data-testid={`nav-${child.key}`}>
                                    <span className="text-black/60 dark:text-white/60">{child.icon}</span>
                                    <span>{child.label}</span>
                                  </Link>
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
            const hasChildren = item.children && item.children.length > 0;
            const childActive = hasChildren && item.children!.some((c) => active === c.key);
            const isItemExpanded = expandedNavItems.includes(item.key) || childActive;
            return (
              <div key={item.key}>
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggleNavItem(item.key)}
                    className={
                      "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                      (childActive
                        ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                        : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                    }
                    data-testid={`nav-${item.key}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={"inline-flex h-8 w-8 items-center justify-center rounded-xl border " + (childActive ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10" : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")} aria-hidden>
                        <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                    </div>
                    <motion.div animate={{ rotate: isItemExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className={"h-4 w-4 " + (childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                    </motion.div>
                  </button>
                ) : (
                  <Link
                    href={getNavRoute(item.key)}
                    onClick={() => onNavigate?.()}
                    className={
                      "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                      (isActive
                        ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                        : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                    }
                    data-testid={`nav-${item.key}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={"inline-flex h-8 w-8 items-center justify-center rounded-xl border " + (isActive ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10" : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")} aria-hidden>
                        <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                      </span>
                      <span className="text-sm font-medium">{item.label}</span>
                      {item.badge != null && item.badge > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">{item.badge}</span>
                      )}
                    </div>
                    <ChevronRight className={"h-4 w-4 " + (isActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                  </Link>
                )}
                <AnimatePresence initial={false}>
                  {hasChildren && isItemExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                        {item.children!.map((child) => (
                          <Link key={child.key} href={getNavRoute(child.key)} onClick={() => onNavigate?.()} className={"flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-xs transition " + (active === child.key ? "bg-black/5 text-black dark:bg-white/10 dark:text-white" : "text-black/60 hover:bg-black/5 hover:text-black dark:text-white/60 dark:hover:bg-white/5 dark:hover:text-white")} data-testid={`nav-${child.key}`}>
                            <span className="text-black/60 dark:text-white/60">{child.icon}</span>
                            <span>{child.label}</span>
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        )}
      </nav>

      <Separator className="my-4 bg-black/10 dark:bg-white/10" />

      <div className="grid gap-2">
        <Link href="/hub" onClick={() => onNavigate?.()} className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7 no-underline" data-testid="link-hub">
          <div className="flex items-center gap-3">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
              <LifeBuoy className="h-4 w-4 text-black/70 dark:text-white/80" />
            </div>
            <div>
              <div className="text-sm font-semibold">TheHub</div>
              <div className="text-xs text-black/55 dark:text-white/55">Profile, News & Training</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-black/45 dark:text-white/60" />
        </Link>
      </div>

      <Separator className="my-4 bg-black/10 dark:bg-white/10" />

      <div className="space-y-1">
        <div className="flex items-center gap-3 px-3 mb-2">
          <div className="relative grid h-9 w-9 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
            <MessageSquare className="h-4 w-4 text-black/70 dark:text-white/85" />
          </div>
          <div className="min-w-0">
            <div className="title-serif truncate text-sm font-semibold">Connect</div>
            <div className="truncate text-xs text-black/55 dark:text-white/55">Channels & conversations</div>
          </div>
        </div>
        {["whatsapp", "facebook", "instagram", "email"].map((key) => {
          const map: Record<string, { label: string; icon: React.ReactNode }> = {
            whatsapp: { label: "WhatsApp", icon: <MessageSquare className="h-4 w-4" /> },
            facebook: { label: "Facebook", icon: <Users className="h-4 w-4" /> },
            instagram: { label: "Instagram", icon: <Sparkles className="h-4 w-4" /> },
            email: { label: "Email", icon: <Mail className="h-4 w-4" /> },
          };
          const item = map[key];
          const connectRoute = key === "tickets" ? "/tickets" : "/";
          return (
            <Link
              key={key}
              href={connectRoute}
              onClick={() => onNavigate?.()}
              className="flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white"
              data-testid={`nav-connect-${key}`}
            >
              <div className="flex items-center gap-3">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" aria-hidden>
                  <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                </span>
                <span className="text-sm font-medium">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-black/35 dark:text-white/40" />
            </Link>
          );
        })}
      </div>

      <Separator className="my-4 bg-black/10 dark:bg-white/10" />

      <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-3 dark:border-white/10 dark:bg-white/5">
        <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
          {currentUser?.profileImageUrl ? (
            <img src={currentUser.profileImageUrl} alt={currentUser.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-black/70 dark:text-white/80">
              {currentUser?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{currentUser?.name ?? "—"}</div>
          {role === "Admin" && <div className="truncate text-xs text-black/55 dark:text-white/55">{currentUser?.email ?? ""}</div>}
        </div>
        <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
          {currentUser?.role ?? role}
        </span>
      </div>
    </>
  );

  return (
    <div className={cn(theme === "dark" ? "dark" : "", "app-shell px-2 py-2 md:px-3 md:py-3 lg:px-4 lg:py-4")}>

      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[9998] bg-black/40 backdrop-blur-sm xl:hidden"
              onClick={() => setMobileNavOpen(false)}
              data-testid="mobile-nav-backdrop"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 35 }}
              className="fixed inset-y-0 left-0 z-[9999] w-[300px] overflow-y-auto bg-white/95 dark:bg-black/95 backdrop-blur-xl shadow-2xl p-4 xl:hidden"
              data-testid="mobile-nav-drawer"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="relative grid h-10 w-10 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                    <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
                  </div>
                  <div className="min-w-0">
                    <div className="title-serif truncate text-sm font-semibold">Travana</div>
                    <div className="text-xs text-black/55 dark:text-white/55">Pipeline</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-black/5 transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  data-testid="button-close-mobile-nav"
                >
                  <X className="h-4 w-4 text-black/70 dark:text-white/80" />
                </button>
              </div>

              <select
                value={role}
                onChange={(e) => onRoleChange(e.target.value as Role)}
                className="mb-4 w-full rounded-2xl border border-blue-500/50 bg-blue-500/10 px-3 py-2 text-xs font-medium text-blue-700 dark:text-blue-300 cursor-pointer"
                data-testid="select-role-mobile"
              >
                {(["Admin", "Manager", "Agent", "Homeworker", "Referer"] as Role[]).map((r) => (
                  <option key={r} value={r} className="text-black bg-white">{r}</option>
                ))}
              </select>

              {renderNavItems(() => setMobileNavOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="w-full space-y-3">
        <div className={cn("grid gap-3", sidebarCollapsed ? "xl:grid-cols-[72px_1fr]" : "xl:grid-cols-[320px_1fr]")} style={{ transition: "grid-template-columns 0.25s ease" }}>
          <aside className="hidden xl:block" data-testid="nav-command-center">
            <div className={cn("glass ringed grain sticky top-4 rounded-3xl transition-all duration-250", sidebarCollapsed ? "p-2" : "p-4")}>
              {sidebarCollapsed ? (
                <div className="flex flex-col items-center gap-1">
                  <div
                    className="relative grid h-11 w-11 place-items-center rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5"
                    data-testid="img-brand-mark"
                  >
                    <Command className="h-5 w-5 text-black/70 dark:text-white/85" />
                  </div>
                </div>
              ) : (
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
                        Pipeline
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
              )}

              <Separator className={cn("bg-black/10 dark:bg-white/10", sidebarCollapsed ? "my-2" : "my-4")} />

              {sidebarCollapsed ? (
                <nav className="flex flex-col items-center gap-1">
                  {nav.grouped
                    ? nav.sections.flatMap((section) => section.items).map((item) => {
                        const isActive = active === item.key;
                        return (
                          <Link
                            key={item.key}
                            href={getNavRoute(item.key)}
                            className={cn(
                              "grid h-10 w-10 place-items-center rounded-xl transition",
                              isActive
                                ? "bg-black/10 text-black dark:bg-white/15 dark:text-white"
                                : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
                            )}
                            title={item.label}
                            data-testid={`nav-${item.key}`}
                          >
                            <span className="text-current">{item.icon}</span>
                          </Link>
                        );
                      })
                    : (nav as any).items?.map((item: any) => {
                        const isActive = active === item.key;
                        return (
                          <Link
                            key={item.key}
                            href={getNavRoute(item.key)}
                            className={cn(
                              "grid h-10 w-10 place-items-center rounded-xl transition",
                              isActive
                                ? "bg-black/10 text-black dark:bg-white/15 dark:text-white"
                                : "text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
                            )}
                            title={item.label}
                            data-testid={`nav-${item.key}`}
                          >
                            <span className="text-current">{item.icon}</span>
                          </Link>
                        );
                      })
                  }
                  <Separator className="my-1 w-8 bg-black/10 dark:bg-white/10" />
                  <button
                    type="button"
                    onClick={toggleSidebarCollapsed}
                    className="grid h-10 w-10 place-items-center rounded-xl text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/7 dark:hover:text-white transition"
                    title="Expand sidebar"
                    data-testid="button-expand-sidebar"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </button>
                </nav>
              ) : (
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
                                const hasSubGroups = item.subGroups && item.subGroups.length > 0;
                                const childActive = hasChildren && item.children!.some((c) => active === c.key);
                                const subGroupActive = hasSubGroups && item.subGroups!.some(g => g.items.some(c => active === c.key));
                                const isItemExpanded = expandedNavItems.includes(item.key) || subGroupActive;
                                return (
                                  <div key={item.key}>
                                    {hasSubGroups ? (
                                      <button
                                        type="button"
                                        onClick={() => toggleNavItem(item.key)}
                                        className={
                                          "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                                          (subGroupActive
                                            ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                            : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                                        }
                                        data-testid={`nav-${item.key}`}
                                      >
                                        <div className="flex items-center gap-3">
                                          <span
                                            className={
                                              "inline-flex h-7 w-7 items-center justify-center rounded-lg border " +
                                              (subGroupActive
                                                ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                                                : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                                            }
                                            aria-hidden
                                          >
                                            <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                                          </span>
                                          <span className="text-sm font-medium">{item.label}</span>
                                        </div>
                                        <motion.div animate={{ rotate: isItemExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                          <ChevronRight className={"h-4 w-4 " + (subGroupActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                                        </motion.div>
                                      </button>
                                    ) : (
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
                                    )}
                                    <AnimatePresence initial={false}>
                                      {hasSubGroups && isItemExpanded && (
                                        <motion.div
                                          initial={{ height: 0, opacity: 0 }}
                                          animate={{ height: "auto", opacity: 1 }}
                                          exit={{ height: 0, opacity: 0 }}
                                          transition={{ duration: 0.2 }}
                                          className="overflow-hidden"
                                        >
                                          <div className="ml-6 mt-1 space-y-2 border-l border-black/10 pl-3 dark:border-white/10">
                                            {item.subGroups!.map((group) => (
                                              <div key={group.label}>
                                                <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-black/40 dark:text-white/40">
                                                  {group.label}
                                                </div>
                                                {group.items.map((child) => (
                                                  <Link
                                                    key={child.key}
                                                    href={getNavRoute(child.key)}
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
                                                  </Link>
                                                ))}
                                              </div>
                                            ))}
                                          </div>
                                        </motion.div>
                                      )}
                                    </AnimatePresence>
                                    {hasChildren && (
                                      <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                        {item.children!.map((child) => (
                                          <Link
                                            key={child.key}
                                            href={getNavRoute(child.key)}
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
                                          </Link>
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
                    const hasChildren = item.children && item.children.length > 0;
                    const childActive = hasChildren && item.children!.some((c) => active === c.key);
                    const isItemExpanded = expandedNavItems.includes(item.key) || childActive;
                    return (
                      <div key={item.key}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleNavItem(item.key)}
                            className={
                              "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                              (childActive
                                ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                            }
                            data-testid={`nav-${item.key}`}
                          >
                            <div className="flex items-center gap-3">
                              <span
                                className={
                                  "inline-flex h-8 w-8 items-center justify-center rounded-xl border " +
                                  (childActive
                                    ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                                    : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                                }
                                aria-hidden
                              >
                                <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                              </span>
                              <span className="text-sm font-medium">{item.label}</span>
                            </div>
                            <motion.div animate={{ rotate: isItemExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                              <ChevronRight className={"h-4 w-4 " + (childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                            </motion.div>
                          </button>
                        ) : (
                          <Link
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
                            <ChevronRight className={"h-4 w-4 " + (isActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                          </Link>
                        )}
                        <AnimatePresence initial={false}>
                          {hasChildren && isItemExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                {item.children!.map((child) => (
                                  <Link
                                    key={child.key}
                                    href={getNavRoute(child.key)}
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
                                  </Link>
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                )}
              </nav>
              )}

              {!sidebarCollapsed && (
              <>
              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="grid gap-2">
                <Link
                  href="/hub"
                  className="flex w-full items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7 no-underline"
                  data-testid="link-hub"
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
                </Link>
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
                {["whatsapp", "facebook", "instagram", "email"].map((key) => {
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

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />

              <div className="flex items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-3 dark:border-white/10 dark:bg-white/5">
                <div className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-2xl border border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5">
                  {currentUser?.profileImageUrl ? (
                    <img src={currentUser.profileImageUrl} alt={currentUser.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-black/70 dark:text-white/80">
                      {currentUser?.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{currentUser?.name ?? "—"}</div>
                  {role === "Admin" && <div className="truncate text-xs text-black/55 dark:text-white/55">{currentUser?.email ?? ""}</div>}
                </div>
                <span className="shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                  {currentUser?.role ?? role}
                </span>
              </div>

              <Separator className="my-4 bg-black/10 dark:bg-white/10" />
              <button
                type="button"
                onClick={toggleSidebarCollapsed}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition text-black/50 hover:bg-black/5 hover:text-black dark:text-white/50 dark:hover:bg-white/7 dark:hover:text-white"
                data-testid="button-collapse-sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
                <span className="text-sm font-medium">Minimise</span>
              </button>
              </>
              )}
            </div>
          </aside>

          <div className="flex flex-col gap-3">
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5 relative z-[40]" data-testid="topbar-command-center">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMobileNavOpen(true)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-black/10 bg-black/5 transition hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 xl:hidden"
                      data-testid="button-hamburger-menu"
                    >
                      <Menu className="h-5 w-5 text-black/70 dark:text-white/80" />
                    </button>
                    <h1 className="title-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="text-page-title">
                      {title}
                    </h1>
                    {headerExtra}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <div className="relative w-full sm:w-[360px] z-[9999]" ref={searchRef}>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50 z-10" />
                    <Input
                      value={localSearchText}
                      onChange={(e) => {
                        setLocalSearchText(e.target.value);
                        onQuery?.(e.target.value);
                        setShowSearchResults(true);
                      }}
                      onFocus={() => localSearchText.trim() && setShowSearchResults(true)}
                      placeholder="Search clients, quotes, bookings…"
                      className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
                      data-testid="input-search"
                    />
                    {showSearchResults && localSearchText.trim() && (
                      <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] overflow-hidden max-h-[420px] overflow-y-auto" data-testid="global-search-dropdown">
                        {globalSearchResults.length > 0 ? (
                          <>
                            {["client", "quote", "booking"].map((cat) => {
                              const items = globalSearchResults.filter((r) => r.category === cat);
                              if (items.length === 0) return null;
                              const catLabel = cat === "client" ? "Clients" : cat === "quote" ? "Quotes" : "Bookings";
                              const CatIcon = cat === "client" ? Users : cat === "quote" ? Compass : Briefcase;
                              return (
                                <div key={cat}>
                                  <div className="flex items-center gap-2 px-4 py-2 bg-black/[0.03] dark:bg-white/[0.03] border-b border-black/5 dark:border-white/5">
                                    <CatIcon className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{catLabel}</span>
                                    <span className="text-[10px] text-muted-foreground/60">({items.length})</span>
                                  </div>
                                  {items.map((result) => (
                                    <button
                                      key={result.id}
                                      onClick={() => {
                                        navigate(result.link);
                                        setShowSearchResults(false);
                                        setLocalSearchText("");
                                        onQuery?.("");
                                      }}
                                      className="w-full px-4 py-2.5 text-left hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5 last:border-b-0 transition-colors"
                                      data-testid={`search-result-${result.id}`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0 flex-1">
                                          <div className="font-medium text-sm truncate">{result.title}</div>
                                          {result.subtitle && (
                                            <div className="text-xs text-black/50 dark:text-white/50 truncate mt-0.5">{result.subtitle}</div>
                                          )}
                                        </div>
                                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${result.badgeColor}`}>
                                          {result.badge}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              );
                            })}
                          </>
                        ) : (
                          <div className="p-4">
                            <p className="text-center text-sm text-black/50 dark:text-white/50 mb-3">
                              No results found for "{localSearchText}"
                            </p>
                            <Button
                              className="w-full h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                              onClick={() => {
                                setShowSearchResults(false);
                                navigate("/clients?new=true&name=" + encodeURIComponent(localSearchText || ""));
                              }}
                              data-testid="button-add-client-from-search"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Add Client "{localSearchText}"
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {filterSlot || (
                      <Select
                        value={quoteStatusFilter || "all"}
                        onValueChange={(v) => onQuoteStatusFilterChange?.(v)}
                      >
                        <SelectTrigger
                          className="h-10 w-full sm:w-[200px] rounded-2xl border-black/10 bg-black/5 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
                          data-testid="select-quote-status"
                        >
                          <Filter className="mr-2 h-4 w-4 shrink-0 opacity-60" />
                          <SelectValue placeholder="Quote Status" />
                        </SelectTrigger>
                        <SelectContent>
                          {QUOTE_STATUS_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value} data-testid={`select-quote-status-${opt.value}`}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {active !== "pipeline" && (
                      createActions && createActions.length > 0 ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                              data-testid="button-primary-action"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-[400] w-44">
                            {createActions.map((action) => (
                              <DropdownMenuItem
                                key={action.label}
                                onClick={action.onClick}
                                className="flex cursor-pointer items-center gap-2"
                              >
                                {action.icon}
                                {action.label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Button
                          className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                          data-testid="button-primary-action"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Create
                        </Button>
                      )
                    )}

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
      <NotificationToast />
    </div>
  );
}
