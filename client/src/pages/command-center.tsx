import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "@/api/client/axios-client";
import { authApi, opportunitiesApi } from "@/api";
import { useAuth } from "@/hooks/use-auth";
import { useRole } from "@/hooks/use-role";
import { useDashboardStats, useNeonClients, useUsers, useTourOperators, useAirports, useTransactions, useAllTasks, useTickets, useChatConversations, useChatMessages, authKeys } from "@/hooks/queries";
import { useCreateClient, useUpdateUser, useDeleteUser, useCreateTourOperator, useUpdateTourOperator, useDeleteTourOperator, useCreateAirport, useDeleteAirport, useCreateTask, useSendMessage, useSendMessageWithFile, useStartDirectChat, useCreateGroupChat, useMarkChatRead } from "@/hooks/mutations";
import { useFavorites } from "@/hooks/queries/use-favorite-queries";
import { useRemoveFavorite, useToggleFavorite } from "@/hooks/mutations/use-favorite-mutations";
import CsvImportDialog from "@/components/csv-import-dialog";
import EmailInbox from "@/components/email-inbox";
import AdminOverview from "@/components/admin-overview";
import ChatRichInput from "@/components/chat-rich-input";
import { NotificationsDropdown } from "@/components/notifications-dropdown";
import { NotificationToast } from "@/components/command-center-shell";
import type { TourOperator } from "@/types/tour-operator";
import type { Airport } from "@/types/airport";
import type { CreateClientData } from "@/types/client";
import type { EnrichedQuote } from "@/types/quote";
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
  TrendingUp,
  Upload,
  Pin,
  PinOff,
  Star,
  StickyNote,
  Share2,
  Hotel,
  UtensilsCrossed,
  Eye,
  EyeOff,
  Lock,
  CalendarClock,
  Target,
  Send,
  Check,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Spinner } from "@/components/ui/spinner";
import { useCurrentUser } from "@/hooks/queries";
import { DatePicker } from "@/components/ui/date-picker";

const TASK_PRESETS_BY_ENTITY: Record<string, string[]> = {
  general: ["Follow up", "Phone call", "Send email", "Research", "Admin"],
  enquiry: ["New Enquiry", "Start Quote"],
  quote: ["Quote Call", "Start Quote", "Call Supplier", "Quote In Progress", "Re-Quote", "Quote Follow-Up", "Book or Ditch!!!"],
  booking: ["Booking confirmation call", "Send booking confirmation", "Request passport details", "Online Visa", "Final payment", "Send travel documents", "Online check-in", "Holiday change", "Amend booking", "Cancellation"],
};

const TASK_CATEGORIES = [
  { value: "general", label: "General Task" },
  { value: "enquiry", label: "Enquiry" },
  { value: "quote", label: "Quote" },
  { value: "booking", label: "Booking" },
];

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
  phone?: string | null;
  email?: string | null;
  clientType?: string | null;
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

const currencyFull = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function StatBox({
  label,
  value,
  icon: Icon,
  color,
  subtext,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  subtext?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="glass ringed grain rounded-2xl p-4" data-testid={`stat-box-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold tracking-tight" data-testid={`stat-value-${label.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}>{value}</p>
            {subtext && (
              <p className="text-[10px] text-muted-foreground">{subtext}</p>
            )}
          </div>
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", color)}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

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
  targetValue,
}: {
  label: string;
  value: string;
  delta: string;
  icon: React.ReactNode;
  targetValue?: string;
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
            {targetValue && <span className="text-lg font-normal text-muted-foreground"> / {targetValue}</span>}
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
  type NavItem = { key: string; label: string; icon: React.ReactNode; route?: string; children?: NavItem[]; subGroups?: { label: string; items: NavItem[] }[] };
  type NavSection = { id: string; label: string; icon: React.ReactNode; items: NavItem[] };
  const nav = useMemo(() => {
    const settingsChildren: NavItem[] = [
      { key: "tour-operators", label: "Tour Operators", icon: <Plane className="h-4 w-4" />, route: "/settings/tour-operators" },
      { key: "airports", label: "Airports", icon: <MapPin className="h-4 w-4" />, route: "/settings/airports" },
      { key: "countries", label: "Countries", icon: <Globe className="h-4 w-4" />, route: "/settings/countries" },
      { key: "destinations", label: "Destinations", icon: <Compass className="h-4 w-4" />, route: "/settings/destinations" },
      { key: "resorts-admin", label: "Resorts", icon: <MapPin className="h-4 w-4" />, route: "/settings/resorts" },
      { key: "accommodation-types", label: "Accommodation Types", icon: <Building2 className="h-4 w-4" />, route: "/settings/accommodation-types" },
      { key: "accommodation-list", label: "Accommodation List", icon: <Building2 className="h-4 w-4" />, route: "/settings/accommodation-list" },
      { key: "board-basis", label: "Board Basis", icon: <ListChecks className="h-4 w-4" />, route: "/settings/board-basis" },
      { key: "package-types", label: "Package Types", icon: <Ticket className="h-4 w-4" />, route: "/settings/package-types" },
      { key: "package-commissions", label: "Package Commissions", icon: <CircleDollarSign className="h-4 w-4" />, route: "/settings/package-commissions" },
      { key: "parks", label: "Parks", icon: <Compass className="h-4 w-4" />, route: "/settings/parks" },
      { key: "cottages-admin", label: "Cottages", icon: <Building2 className="h-4 w-4" />, route: "/settings/cottages" },
      { key: "lodges-admin", label: "Lodges", icon: <Building2 className="h-4 w-4" />, route: "/settings/lodges" },
      { key: "cruise-extras", label: "Cruise Extras", icon: <LifeBuoy className="h-4 w-4" />, route: "/settings/cruise-extras" },
      { key: "room-types", label: "Room Types", icon: <Building2 className="h-4 w-4" />, route: "/settings/room-types" },
      { key: "deletion-codes", label: "Deletion Codes", icon: <Trash2 className="h-4 w-4" />, route: "/settings/deletion-codes" },
    ];

    const settingsSubGroups: { label: string; items: NavItem[] }[] = [
      {
        label: "Admin Settings",
        items: [
          { key: "package-types", label: "Package Types", icon: <Ticket className="h-4 w-4" />, route: "/settings/package-types" },
          { key: "package-commissions", label: "Package Commissions", icon: <CircleDollarSign className="h-4 w-4" />, route: "/settings/package-commissions" },
          { key: "board-basis", label: "Board Basis", icon: <ListChecks className="h-4 w-4" />, route: "/settings/board-basis" },
          { key: "deletion-codes", label: "Deletion Codes", icon: <Trash2 className="h-4 w-4" />, route: "/settings/deletion-codes" },
        ],
      },
      {
        label: "Database Data",
        items: [
          { key: "tour-operators", label: "Tour Operators", icon: <Plane className="h-4 w-4" />, route: "/settings/tour-operators" },
          { key: "airports", label: "Airports", icon: <MapPin className="h-4 w-4" />, route: "/settings/airports" },
          { key: "countries", label: "Countries", icon: <Globe className="h-4 w-4" />, route: "/settings/countries" },
          { key: "destinations", label: "Destinations", icon: <Compass className="h-4 w-4" />, route: "/settings/destinations" },
          { key: "resorts-admin", label: "Resorts", icon: <MapPin className="h-4 w-4" />, route: "/settings/resorts" },
          { key: "accommodation-types", label: "Accommodation Types", icon: <Building2 className="h-4 w-4" />, route: "/settings/accommodation-types" },
          { key: "accommodation-list", label: "Accommodation List", icon: <Building2 className="h-4 w-4" />, route: "/settings/accommodation-list" },
          { key: "parks", label: "Parks", icon: <Compass className="h-4 w-4" />, route: "/settings/parks" },
          { key: "cottages-admin", label: "Cottages", icon: <Building2 className="h-4 w-4" />, route: "/settings/cottages" },
          { key: "lodges-admin", label: "Lodges", icon: <Building2 className="h-4 w-4" />, route: "/settings/lodges" },
          { key: "cruise-extras", label: "Cruise Extras", icon: <LifeBuoy className="h-4 w-4" />, route: "/settings/cruise-extras" },
          { key: "room-types", label: "Room Types", icon: <Building2 className="h-4 w-4" />, route: "/settings/room-types" },
        ],
      },
    ];

    const base: NavItem[] = [
      { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
      { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
      { key: "pipeline", label: "Pipeline", icon: <TrendingUp className="h-4 w-4" />, route: "/pipeline" },
      { key: "opportunities", label: "Opportunities", icon: <Target className="h-4 w-4" /> },
      { key: "social-posts", label: "Social Posts", icon: <Share2 className="h-4 w-4" />, route: "/social-posts" },
      { key: "tickets", label: "Tickets", icon: <LifeBuoy className="h-4 w-4" />, route: "/tickets" },
      { key: "connect-internal-chat", label: "Live Chat", icon: <MessageSquare className="h-4 w-4" /> },
      { key: "agent-settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
    ];

    if (role === "Admin") {
      return {
        grouped: true as const,
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
              { key: "admin-settings-page", label: "Admin Settings", icon: <Settings2 className="h-4 w-4" /> },
              { key: "settings", label: "Data Settings", icon: <ClipboardList className="h-4 w-4" />, subGroups: settingsSubGroups },
            ] as NavItem[],
          },
          {
            id: "agent",
            label: "Agent Tools",
            icon: <Users className="h-4 w-4" />,
            items: [
              { key: "agent-overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
              { key: "clients", label: "Clients", icon: <Users className="h-4 w-4" /> },
              { key: "pipeline", label: "Pipeline", icon: <TrendingUp className="h-4 w-4" />, route: "/pipeline" },
              { key: "opportunities", label: "Opportunities", icon: <Target className="h-4 w-4" /> },
              { key: "social-posts", label: "Social Posts", icon: <Share2 className="h-4 w-4" />, route: "/social-posts" },
              { key: "tickets", label: "Tickets", icon: <LifeBuoy className="h-4 w-4" />, route: "/tickets" },
              { key: "connect-internal-chat", label: "Live Chat", icon: <MessageSquare className="h-4 w-4" /> },
              { key: "agent-settings", label: "Settings", icon: <Settings2 className="h-4 w-4" /> },
            ] as NavItem[],
          },
        ] as NavSection[],
        items: undefined as NavItem[] | undefined,
      };
    }

    if (role === "Manager") {
      return { grouped: false as const, items: [
        { key: "overview", label: "Overview", icon: <LayoutGrid className="h-4 w-4" /> },
        { key: "team", label: "Team Pipeline", icon: <BarChart3 className="h-4 w-4" /> },
        { key: "coverage", label: "Coverage", icon: <Compass className="h-4 w-4" /> },
        { key: "coaching", label: "Coaching", icon: <BadgeCheck className="h-4 w-4" /> },
        { key: "reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
      ] as NavItem[], sections: undefined as NavSection[] | undefined };
    }

    if (role === "Homeworker") {
      return { grouped: false as const, items: [
        { key: "overview", label: "Work Queue", icon: <ListChecks className="h-4 w-4" /> },
        { key: "assigned", label: "Assigned Clients", icon: <Users className="h-4 w-4" /> },
        { key: "callbacks", label: "Callbacks", icon: <Phone className="h-4 w-4" /> },
        { key: "messages", label: "Messages", icon: <MessageSquare className="h-4 w-4" /> },
      ] as NavItem[], sections: undefined as NavSection[] | undefined };
    }

    if (role === "Referer") {
      return { grouped: false as const, items: [
        { key: "overview", label: "Affiliate Hub", icon: <Link2 className="h-4 w-4" /> },
        { key: "leads", label: "Leads", icon: <Users className="h-4 w-4" /> },
        { key: "commission", label: "Commission", icon: <CircleDollarSign className="h-4 w-4" /> },
        { key: "payouts", label: "Payouts", icon: <Banknote className="h-4 w-4" /> },
      ] as NavItem[], sections: undefined as NavSection[] | undefined };
    }

    return { grouped: false as const, items: base, sections: undefined as NavSection[] | undefined };
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

  const [expandedNavItems, setExpandedNavItems] = useState<string[]>(() => {
    const saved = sessionStorage.getItem("admin-nav-items-expanded");
    return saved ? JSON.parse(saved) : [];
  });

  const toggleNavItem = (key: string) => {
    setExpandedNavItems(prev => {
      const next = prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key];
      sessionStorage.setItem("admin-nav-items-expanded", JSON.stringify(next));
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
                          const hasSubGroups = item.subGroups && item.subGroups.length > 0;
                          const childActive = hasChildren && item.children!.some((c: { key: string }) => active === c.key);
                          const subGroupActive = hasSubGroups && item.subGroups!.some(g => g.items.some(c => active === c.key));
                          const isItemExpanded = expandedNavItems.includes(item.key) || subGroupActive;
                          return (
                            <div key={item.key}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (item.route) { navigate(item.route); return; }
                                  if (hasSubGroups) { toggleNavItem(item.key); return; }
                                  onActiveChange(item.key);
                                }}
                                className={
                                  "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-left transition " +
                                  (isActive || childActive || subGroupActive
                                    ? "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                                    : "bg-transparent text-black/65 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/7 dark:hover:text-white")
                                }
                                data-testid={`nav-${item.key}`}
                              >
                                <div className="flex items-center gap-3">
                                  <span
                                    className={
                                      "inline-flex h-7 w-7 items-center justify-center rounded-lg border " +
                                      (isActive || childActive || subGroupActive
                                        ? "border-black/10 bg-black/5 dark:border-white/15 dark:bg-white/10"
                                        : "border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5")
                                    }
                                    aria-hidden
                                  >
                                    <span className="text-black/70 dark:text-white/80">{item.icon}</span>
                                  </span>
                                  <span className="text-sm font-medium">{item.label}</span>
                                </div>
                                {hasSubGroups ? (
                                  <motion.div animate={{ rotate: isItemExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronRight className={"h-4 w-4 " + (subGroupActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                                  </motion.div>
                                ) : (
                                  <ChevronRight
                                    className={"h-4 w-4 " + (isActive || childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")}
                                  />
                                )}
                              </button>
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
                                          {group.items.map((child) => {
                                            if (child.route) {
                                              return (
                                                <Link
                                                  key={child.key}
                                                  href={child.route}
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
                                              );
                                            }
                                            return (
                                              <button
                                                key={child.key}
                                                onClick={(e) => { e.stopPropagation(); onActiveChange(child.key); }}
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
                                            );
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                              {hasChildren && (
                                <div className="ml-6 mt-1 space-y-1 border-l border-black/10 pl-3 dark:border-white/10">
                                  {item.children!.map((child: { key: string; label: string; icon: React.ReactNode; route?: string }) => {
                                    const route = child.route;
                                    if (route) {
                                      return (
                                        <Link
                                          key={child.key}
                                          href={route}
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
                                      );
                                    }
                                    return (
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
                                    );
                                  })}
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
            const hasChildren = item.children && item.children.length > 0;
            const isActive = active === item.key;
            const childActive = hasChildren && item.children!.some((c) => active === c.key);
            const isOpen = isActive || childActive || expandedSections.includes(item.key);
            return (
              <div key={item.key}>
                <button
                  onClick={() => {
                    if (item.route) { navigate(item.route); return; }
                    if (hasChildren) { toggleSection(item.key); return; }
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
                        "inline-flex h-8 w-8 items-center justify-center rounded-xl border " +
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
                  {hasChildren ? (
                    <ChevronDown className={"h-4 w-4 transition-transform " + (isOpen ? "rotate-0" : "-rotate-90") + " " + (isActive || childActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                  ) : (
                    <ChevronRight className={"h-4 w-4 " + (isActive ? "text-black/50 dark:text-white/70" : "text-black/35 dark:text-white/40")} />
                  )}
                </button>
                {hasChildren && isOpen && (
                  <div className="ml-6 mt-1 space-y-0.5 border-l border-black/10 pl-3 dark:border-white/10">
                    {item.children!.map((child) => (
                      <button
                        key={child.key}
                        onClick={() => { if (child.route) { navigate(child.route); return; } onActiveChange(child.key); }}
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
          })
          )}
        </nav>

        <Separator className="my-4 bg-black/10 dark:bg-white/10" />

        <div className="grid gap-2">
          <Link
            href="/hub"
            className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/5 px-3 py-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7 no-underline"
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

            const handleConnectClick = () => {
              if (key === "tickets") {
                navigate("/tickets");
              } else {
                onActiveChange(`connect-${key}`);
              }
            };
            return (
              <button
                key={key}
                onClick={handleConnectClick}
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
  clients,
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
  clients?: Array<{ id: string; name: string; email: string; tier: string; stage: string; nextTrip?: string; phone?: string; clientType?: string }>;
}) {
  const { user: currentUser } = useAuth();
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [showNewClientDialog, setShowNewClientDialog] = useState(false);
  const [newClientForm, setNewClientForm] = useState({
    clientType: "New Client",
    title: "",
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    houseNumber: "",
    street: "",
    city: "",
    country: "",
    postcode: "",
  });
  const [postcodeSearch, setPostcodeSearch] = useState("");
  const [postcodeLoading, setPostcodeLoading] = useState(false);
  const [postcodeError, setPostcodeError] = useState("");
  const [addressResults, setAddressResults] = useState<Array<{ line1: string; line2: string; city: string; postcode: string }>>([]);
  const [showAddressResults, setShowAddressResults] = useState(false);

  const lookupPostcode = async () => {
    if (!postcodeSearch.trim()) return;
    setPostcodeLoading(true);
    setPostcodeError("");
    setAddressResults([]);
    
    try {
      const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcodeSearch.trim())}`);
      const data = await response.json();
      
      if (data.status === 200 && data.result) {
        const result = data.result;
        setNewClientForm({
          ...newClientForm,
          city: result.admin_district || result.primary_care_trust || result.admin_county || "",
          country: result.country || "United Kingdom",
          postcode: result.postcode || postcodeSearch.trim(),
        });
        setPostcodeError("Postcode found! Please enter house number and street manually.");
      } else {
        setPostcodeError("Postcode not found. Please enter address manually.");
      }
    } catch (error) {
      setPostcodeError("Failed to lookup postcode. Please enter address manually.");
    } finally {
      setPostcodeLoading(false);
    }
  };
  const [, navigate] = useLocation();
  const searchRef = useRef<HTMLDivElement>(null);
  const createClientMutation = useCreateClient();

  const handleCreateClient = () => {
    if (!newClientForm.firstName || !newClientForm.lastName || !newClientForm.phone) {
      return;
    }
    createClientMutation.mutate({
      clientType: newClientForm.clientType,
      title: newClientForm.title || undefined,
      firstName: newClientForm.firstName,
      lastName: newClientForm.lastName,
      phone: newClientForm.phone,
      email: newClientForm.email || undefined,
      houseNumber: newClientForm.houseNumber || undefined,
      street: newClientForm.street || undefined,
      city: newClientForm.city || undefined,
      country: newClientForm.country || undefined,
      postcode: newClientForm.postcode || undefined,
    }, {
      onSuccess: (newClient) => {
        setShowNewClientDialog(false);
        setNewClientForm({
          clientType: "New Client",
          title: "",
          firstName: "",
          lastName: "",
          phone: "",
          email: "",
          houseNumber: "",
          street: "",
          city: "",
          country: "",
          postcode: "",
        });
        setPostcodeSearch("");
        setPostcodeError("");
        navigate(`/clients/${newClient.id}`);
      },
    });
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchResults = useMemo(() => {
    if (!query.trim() || !clients) return [];
    const q = query.toLowerCase();
    return clients
      .filter(c => 
        (c.name && c.name.toLowerCase().includes(q)) || 
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q))
      )
      .slice(0, 8);
  }, [query, clients]);
  
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
    <div className="glass ringed grain rounded-3xl p-4 md:p-5 relative z-[100]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="title-serif text-2xl font-semibold tracking-tight md:text-3xl" data-testid="text-page-title">
            {title}
          </h1>
          <div className="relative hidden sm:block w-[320px] z-[9999]" ref={searchRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/50 z-10" />
            <Input
              value={query}
              onChange={(e) => {
                onQuery(e.target.value);
                setShowSearchResults(true);
              }}
              onFocus={() => query.trim() && setShowSearchResults(true)}
              placeholder="Search clients, trips, destinations…"
              className="h-10 rounded-2xl border-black/10 bg-black/5 pl-10 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/45"
              data-testid="input-search"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] overflow-hidden">
                {searchResults.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      navigate(`/clients/${client.id}`);
                      setShowSearchResults(false);
                      onQuery("");
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
            {showSearchResults && query.trim() && searchResults.length === 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl border border-black/10 bg-white/95 dark:bg-black/95 dark:border-white/10 shadow-xl backdrop-blur-xl z-[9999] p-4">
                <p className="text-center text-sm text-black/50 dark:text-white/50 mb-3">
                  No clients found matching "{query}"
                </p>
                <Button
                  className="w-full h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                  onClick={() => {
                    setShowSearchResults(false);
                    navigate("/clients?new=true&name=" + encodeURIComponent(query));
                  }}
                  data-testid="button-add-client-from-search"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Client "{query}"
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
              <DropdownMenuContent align="end" className="w-48 rounded-xl z-[200]">
                <DropdownMenuItem 
                  className="cursor-pointer" 
                  data-testid="menu-item-new-client"
                  onClick={() => setShowNewClientDialog(true)}
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  New Client
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-enquiry">
                  <Sparkles className="mr-2 h-4 w-4" />
                  Enquiry
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-quote">
                  <FileText className="mr-2 h-4 w-4" />
                  Quote
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-booking">
                  <Ticket className="mr-2 h-4 w-4" />
                  Booking
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" data-testid="menu-item-task">
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {currentUser && (
              <NotificationsDropdown userId={currentUser.id} />
            )}

            <Dialog open={showNewClientDialog} onOpenChange={setShowNewClientDialog}>
              <DialogContent className="sm:max-w-[500px] rounded-2xl z-[300]">
                <DialogHeader>
                  <DialogTitle>New Client</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="clientType">Client Type</Label>
                    <Select
                      value={newClientForm.clientType}
                      onValueChange={(value) => setNewClientForm({ ...newClientForm, clientType: value })}
                    >
                      <SelectTrigger id="clientType" className="rounded-xl" data-testid="select-client-type">
                        <SelectValue placeholder="Select client type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Time Waster">Time Waster</SelectItem>
                        <SelectItem value="New Client">New Client</SelectItem>
                        <SelectItem value="Repeat Client">Repeat Client</SelectItem>
                        <SelectItem value="VIP Client">VIP Client</SelectItem>
                        <SelectItem value="Family Member">Family Member</SelectItem>
                        <SelectItem value="Banned">Banned</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="title">Title</Label>
                    <Select
                      value={newClientForm.title}
                      onValueChange={(value) => setNewClientForm({ ...newClientForm, title: value })}
                    >
                      <SelectTrigger id="title" className="rounded-xl" data-testid="select-title">
                        <SelectValue placeholder="Select title" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Mr.">Mr.</SelectItem>
                        <SelectItem value="Mrs">Mrs</SelectItem>
                        <SelectItem value="Ms">Ms</SelectItem>
                        <SelectItem value="Miss">Miss</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={newClientForm.firstName}
                        onChange={(e) => setNewClientForm({ ...newClientForm, firstName: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-first-name"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={newClientForm.lastName}
                        onChange={(e) => setNewClientForm({ ...newClientForm, lastName: e.target.value })}
                        className="rounded-xl"
                        data-testid="input-last-name"
                      />
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      value={newClientForm.phone}
                      onChange={(e) => setNewClientForm({ ...newClientForm, phone: e.target.value })}
                      className="rounded-xl"
                      data-testid="input-phone"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newClientForm.email}
                      onChange={(e) => setNewClientForm({ ...newClientForm, email: e.target.value })}
                      className="rounded-xl"
                      data-testid="input-email"
                    />
                  </div>

                  <Separator />

                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">Address (optional)</Label>
                    <div className="grid gap-4">
                      <div className="grid gap-2">
                        <Label htmlFor="postcodeSearch" className="text-xs">Postcode Search</Label>
                        <div className="flex gap-2">
                          <Input
                            id="postcodeSearch"
                            value={postcodeSearch}
                            onChange={(e) => setPostcodeSearch(e.target.value.toUpperCase())}
                            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), lookupPostcode())}
                            placeholder="Enter postcode (e.g. SW1A 1AA)"
                            className="rounded-xl flex-1"
                            data-testid="input-postcode-search"
                          />
                          <Button
                            type="button"
                            onClick={lookupPostcode}
                            disabled={postcodeLoading || !postcodeSearch.trim()}
                            className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                            data-testid="button-lookup-postcode"
                          >
                            {postcodeLoading ? (
                              <span className="flex items-center gap-2">
                                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                Looking up...
                              </span>
                            ) : (
                              <>
                                <Search className="mr-2 h-4 w-4" />
                                Find
                              </>
                            )}
                          </Button>
                        </div>
                        {postcodeError && (
                          <p className={`text-xs ${postcodeError.includes("found!") ? "text-green-600" : "text-red-500"}`}>{postcodeError}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="houseNumber" className="text-xs">House Number</Label>
                          <Input
                            id="houseNumber"
                            value={newClientForm.houseNumber}
                            onChange={(e) => setNewClientForm({ ...newClientForm, houseNumber: e.target.value })}
                            className="rounded-xl"
                            data-testid="input-house-number"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="street" className="text-xs">Street</Label>
                          <Input
                            id="street"
                            value={newClientForm.street}
                            onChange={(e) => setNewClientForm({ ...newClientForm, street: e.target.value })}
                            className="rounded-xl"
                            data-testid="input-street"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="grid gap-2">
                          <Label htmlFor="city" className="text-xs">City</Label>
                          <Input
                            id="city"
                            value={newClientForm.city}
                            onChange={(e) => setNewClientForm({ ...newClientForm, city: e.target.value })}
                            className="rounded-xl"
                            data-testid="input-city"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="country" className="text-xs">Country</Label>
                          <Input
                            id="country"
                            value={newClientForm.country}
                            onChange={(e) => setNewClientForm({ ...newClientForm, country: e.target.value })}
                            className="rounded-xl"
                            data-testid="input-country"
                          />
                        </div>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor="postcode" className="text-xs">Postcode</Label>
                        <Input
                          id="postcode"
                          value={newClientForm.postcode}
                          onChange={(e) => setNewClientForm({ ...newClientForm, postcode: e.target.value })}
                          className="rounded-xl w-1/2"
                          data-testid="input-postcode"
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setShowNewClientDialog(false)}
                    className="rounded-xl"
                    data-testid="button-cancel-client"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateClient}
                    disabled={!newClientForm.firstName || !newClientForm.lastName || !newClientForm.phone || createClientMutation.isPending}
                    className="rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                    data-testid="button-save-client"
                  >
                    {createClientMutation.isPending ? "Creating..." : "Create Client"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                <DropdownMenuContent align="end" className="w-48 rounded-xl z-[200]">
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

function spFormatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function spFormatPrice(price: string | null | undefined): string {
  if (!price) return "—";
  const num = parseFloat(price);
  if (isNaN(num)) return "—";
  return `£${num.toFixed(2)}`;
}

function spIsSameDay(dateStr: string | null | undefined, target: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === target.getFullYear() && d.getMonth() === target.getMonth() && d.getDate() === target.getDate();
}

function spGetHotelName(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].accomodation_name || "—";
  return "—";
}

function spGetDepartingAirport(q: EnrichedQuote): string {
  const outbound = q.flights?.find((f) => f.flight_type === "outbound" && (f.leg_order === 0 || f.leg_order === null));
  return outbound?.departing_airport_name || "—";
}

function spGetBoardBasis(q: EnrichedQuote): string {
  if (q.accommodations && q.accommodations.length > 0) return q.accommodations[0].board_basis_name || "—";
  return "—";
}

function spGetFirstImage(q: EnrichedQuote): string | null {
  if (q.images && q.images.length > 0) {
    const primary = q.images.find((img) => img.isPrimary);
    return (primary || q.images[0]).image_url || null;
  }
  return null;
}

function spGetSubtitle(q: EnrichedQuote): string {
  const parts: string[] = [];
  if (q.country_name) parts.push(q.country_name);
  if (q.destination_name) parts.push(q.destination_name);
  return parts.join(" · ") || "—";
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
            className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
  const [location, navigate] = useLocation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [active, setActive] = useState<string>(() => {
    if (location === "/clients") return "clients";
    return "overview";
  });
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"whats-on" | "pipeline" | "calendar" | "news">("whats-on");
  const [whatsOnFilter, setWhatsOnFilter] = useState<"today" | "tomorrow" | "this-week" | "custom">("today");
  const [whatsOnDate, setWhatsOnDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [socialFilter, setSocialFilter] = useState<"today" | "tomorrow" | "date">("today");
  const [socialDate, setSocialDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [clientsTab, setClientsTab] = useState<"clients-list" | "pipeline" | "calendar" | "news">("clients-list");
  const [liveClientsDateRange, setLiveClientsDateRange] = useState<"today" | "this-week" | "this-month" | "last-month" | "last-7" | "this-year">("this-month");
  const [liveClientsSearch, setLiveClientsSearch] = useState("");
  const [liveClientsStatusFilter, setLiveClientsStatusFilter] = useState<"all" | "enquiry" | "quote">("all");
  const [clientsListPage, setClientsListPage] = useState(1);
  const [topClientsFilter, setTopClientsFilter] = useState<"total_spend" | "profit" | "bookings">("total_spend");
  const [opportunitiesTab, setOpportunitiesTab] = useState<"enquiries" | "quotes" | "bookings">("enquiries");
  const [opportunitiesSearch, setOpportunitiesSearch] = useState("");
  const [opportunitiesStatusFilter, setOpportunitiesStatusFilter] = useState("all");
  const [opportunitiesDateRange, setOpportunitiesDateRange] = useState<"this-month" | "last-month" | "this-week" | "last-7" | "last-30" | "last-90" | "this-year" | "all-time">("this-month");
  const [opportunitiesSortBy, setOpportunitiesSortBy] = useState<"newest" | "oldest" | "price-high" | "price-low">("newest");
  const [opportunitiesAgentFilter, setOpportunitiesAgentFilter] = useState("all");
  const [opportunitiesPage, setOpportunitiesPage] = useState(1);
  const [debouncedOpportunitiesSearch, setDebouncedOpportunitiesSearch] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const { role, setRole: setRoleFromHook, actualRole } = useRole();
  const rolePreview = role !== actualRole ? role : null;
  const setRolePreview = (r: Role | null) => {
    setRoleFromHook(r || actualRole);
  };
  const [settingsTab, setSettingsTab] = useState<"general" | "tour-operators">("general");
  const [tourOperatorSearch, setTourOperatorSearch] = useState("");
  const [airportSearch, setAirportSearch] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [dashTaskCategory, setDashTaskCategory] = useState<string>("general");
  const [dashNewTitle, setDashNewTitle] = useState("");
  const [dashNewDueDate, setDashNewDueDate] = useState("");
  const [dashNewDueTime, setDashNewDueTime] = useState("09:00");
  const { data: currentUser } = useCurrentUser();
  const { toast } = useToast();
  const dashCreateTaskMutation = useCreateTask("quote", "");
  const dashTaskPresets = TASK_PRESETS_BY_ENTITY[dashTaskCategory] || TASK_PRESETS_BY_ENTITY.general;
  const [chatSelectedConversation, setChatSelectedConversation] = useState<string | null>(null);
  const [chatMessageInput, setChatMessageInput] = useState("");
  const [chatNewChatUserId, setChatNewChatUserId] = useState<string | null>(null);

  const [settingsPhone, setSettingsPhone] = useState("");
  const [settingsEmail, setSettingsEmail] = useState("");
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) {
      setSettingsPhone(user.phoneNumber || "");
      setSettingsEmail(user.email || "");
    }
  }, [user]);

  const handleDashAddTask = () => {
    if (!dashNewTitle || !dashNewDueDate || !currentUser?.id) return;
    const dueDate = new Date(`${dashNewDueDate}T${dashNewDueTime || "09:00"}`);
    dashCreateTaskMutation.mutate(
      {
        entityType: dashTaskCategory === "booking" ? "quote" : dashTaskCategory,
        entityId: "",
        userId: currentUser.id,
        title: dashNewTitle,
        dueDate: dueDate,
        completed: false,
      },
      {
        onSuccess: () => {
          setShowAddTaskDialog(false);
          setDashNewTitle("");
          setDashNewDueDate("");
          setDashNewDueTime("09:00");
          setDashTaskCategory("general");
          toast({ title: "Task added" });
        },
        onError: () => toast({ title: "Failed to add task", variant: "destructive" }),
      }
    );
  };

  const themeClass = theme === "dark" ? "dark" : "";
  const displayName = user?.firstName || user?.name || user?.email || "User";

  const { data: dashboardStats } = useDashboardStats();
  const isRestrictedRole = role !== "Admin" && role !== "Manager";
  const { data: transactionsData } = useTransactions(isRestrictedRole && currentUser?.id ? { agentId: currentUser.id } : undefined);

  const overviewSocialPosts = useMemo(() => {
    if (!transactionsData) return [];
    const posts: { quote: EnrichedQuote; clientId: string }[] = [];
    for (const txn of transactionsData) {
      if (!txn.client_id || !txn.quotes) continue;
      for (const q of txn.quotes) {
        if (q.is_active === false) continue;
        posts.push({ quote: q as EnrichedQuote, clientId: txn.client_id });
      }
    }
    posts.sort((a, b) => {
      const da = a.quote.date_created ? new Date(a.quote.date_created).getTime() : 0;
      const db = b.quote.date_created ? new Date(b.quote.date_created).getTime() : 0;
      return db - da;
    });
    return posts;
  }, [transactionsData]);

  const filteredOverviewSocialPosts = useMemo(() => {
    let result = overviewSocialPosts;
    if (socialFilter === "today") {
      const today = new Date();
      result = result.filter(({ quote: q }) => spIsSameDay(q.date_created, today));
    } else if (socialFilter === "tomorrow") {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      result = result.filter(({ quote: q }) => spIsSameDay(q.date_created, tomorrow));
    } else if (socialFilter === "date" && socialDate) {
      const target = new Date(socialDate + "T00:00:00");
      result = result.filter(({ quote: q }) => spIsSameDay(q.date_created, target));
    }
    return result;
  }, [overviewSocialPosts, socialFilter, socialDate]);

  const { data: userFavorites } = useFavorites();
  const removeFavoriteMutation = useRemoveFavorite();
  const toggleFavoriteMutation = useToggleFavorite();
  const [clientsPage, setClientsPage] = useState(1);
  const [clientsListSearch, setClientsListSearch] = useState("");
  const { data: paginatedNeonClients } = useNeonClients({ page: clientsPage, limit: 10, search: query.trim() || undefined });
  const { data: clientsListData } = useNeonClients({ page: clientsListPage, limit: 15, search: clientsListSearch.trim() || undefined });
  const { data: allNeonClientsData } = useNeonClients({ page: 1, limit: 500 });
  const { data: apiUsers } = useUsers();
  const updateUserMutation = useUpdateUser();
  const deleteUserMutation = useDeleteUser();
  const { data: tourOperators } = useTourOperators();
  const createTourOperatorMutation = useCreateTourOperator();
  const updateTourOperatorMutation = useUpdateTourOperator();
  const deleteTourOperatorMutation = useDeleteTourOperator();
  const { data: airportsList } = useAirports();
  const createAirportMutation = useCreateAirport();
  const deleteAirportMutation = useDeleteAirport();
  const { data: chatConversations } = useChatConversations();
  const { data: chatMessages } = useChatMessages(chatSelectedConversation || "");
  const sendMessageMutation = useSendMessage();
  const sendMessageWithFileMutation = useSendMessageWithFile();
  const startDirectChatMutation = useStartDirectChat();
  const { data: countriesData } = useQuery({
    queryKey: ["admin", "data", "country"],
    queryFn: async () => {
      const res = await axios.get("/api/admin/data/country?limit=200");
      return res.data as { rows: Array<{ id: string; country_name: string; country_code?: string }> };
    },
  });
  const countryMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (countriesData?.rows) {
      for (const c of countriesData.rows) {
        map[c.id] = c.country_name;
      }
    }
    return map;
  }, [countriesData]);

  const { data: allTasksData } = useAllTasks();
  const { data: allTicketsData } = useTickets();

  const whatsOnDateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const endOfTomorrow = new Date(tomorrow);
    endOfTomorrow.setDate(endOfTomorrow.getDate() + 1);
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - ((dayOfWeek + 6) % 7));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    switch (whatsOnFilter) {
      case "today":
        return { start: today, end: tomorrow };
      case "tomorrow":
        return { start: tomorrow, end: endOfTomorrow };
      case "this-week":
        return { start: startOfWeek, end: endOfWeek };
      case "custom": {
        const d = new Date(whatsOnDate);
        d.setHours(0, 0, 0, 0);
        const next = new Date(d);
        next.setDate(next.getDate() + 1);
        return { start: d, end: next };
      }
    }
  }, [whatsOnFilter, whatsOnDate]);

  const filteredTasks = useMemo(() => {
    if (!allTasksData) return [];
    return allTasksData
      .filter((t) => {
        if (!t.dueDate) return false;
        const due = new Date(t.dueDate);
        return due >= whatsOnDateRange.start && due < whatsOnDateRange.end;
      })
      .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
  }, [allTasksData, whatsOnDateRange]);

  const filteredTickets = useMemo(() => {
    if (!allTicketsData) return [];
    return allTicketsData
      .filter((t) => {
        const created = new Date(t.createdAt);
        return created >= whatsOnDateRange.start && created < whatsOnDateRange.end;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allTicketsData, whatsOnDateRange]);

  const allClients = useMemo(() => {
    const neonClients = paginatedNeonClients?.clients;
    if (!neonClients || neonClients.length === 0) return [] as Array<{ id: string; name: string; tier: "Platinum" | "Gold" | "Standard"; stage: Stage; location: string; nextTrip: string; value: number; lastTouch: string; phone: string; email: string; clientType: string }>;
    return neonClients.map((c) => ({
      id: c.id,
      name: [c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown",
      tier: "Standard" as "Platinum" | "Gold" | "Standard",
      stage: "Enquiry" as Stage,
      location: [c.city, c.country].filter(Boolean).join(", "),
      nextTrip: "",
      value: 0,
      lastTouch: "",
      phone: c.phoneNumber || "",
      email: c.email || "",
      clientType: "New Client",
    }));
  }, [paginatedNeonClients]);

  const clients = allClients;
  const clientsTotalPages = paginatedNeonClients?.totalPages ?? 1;
  const clientsTotal = paginatedNeonClients?.total ?? 0;

  const pipelineStages = useMemo(() => {
    type PStage = "New Lead" | "In Play" | "Booked";
    const stages: Record<PStage, any[]> = {
      "New Lead": [],
      "In Play": [],
      "Booked": [],
    };
    if (!transactionsData) return stages;
    for (const t of transactionsData) {
      if (t.status === "on_booking" || t.booking) {
        stages["Booked"].push({ ...t, title: t.enquiry?.title || t.booking?.title || "Untitled", travel_date: t.booking?.travel_date || t.enquiry?.travel_date || t.created_at, sales_price: t.booking?.sales_price || t.quotes?.[0]?.sales_price, package_commission: t.booking?.package_commission || t.quotes?.[0]?.package_commission, transaction_id: t.client_id });
      } else if (t.status === "on_quote" && t.quotes && t.quotes.length > 0) {
        stages["In Play"].push({ ...t, title: t.quotes[0]?.title || t.enquiry?.title || "Untitled", travel_date: t.quotes[0]?.travel_date || t.enquiry?.travel_date || t.created_at, sales_price: t.quotes[0]?.sales_price, package_commission: t.quotes[0]?.package_commission, transaction_id: t.client_id });
      } else {
        stages["New Lead"].push({ ...t, title: t.enquiry?.title || "New Enquiry", travel_date: t.enquiry?.travel_date || t.created_at, sales_price: null, package_commission: null, transaction_id: t.client_id });
      }
    }
    return stages;
  }, [transactionsData]);

  const allClientNames = useMemo(() => {
    const map = new Map<string, string>();
    const sources = [paginatedNeonClients?.clients, allNeonClientsData?.clients];
    for (const list of sources) {
      if (list) {
        for (const c of list) {
          if (!map.has(c.id)) {
            const title = c.title && c.title !== "NULL" ? c.title : "";
            map.set(c.id, [title, c.firstName, c.surename].filter(Boolean).join(" "));
          }
        }
      }
    }
    return map;
  }, [paginatedNeonClients, allNeonClientsData]);
  const pipelineClientNames = allClientNames;

  const pinnedClientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (transactionsData) {
      for (const t of transactionsData as any[]) {
        if (t.client_id && allClientNames.has(t.client_id)) {
          map.set(t.id, allClientNames.get(t.client_id)!);
        }
      }
    }
    return map;
  }, [transactionsData, allClientNames]);

  const getQuoteProfit = (q: any): number => {
    return parseFloat(q.package_commission) || 0;
  };

  const topClients = useMemo(() => {
    if (!transactionsData || !allNeonClientsData?.clients) return [];
    const clientMap = new Map<string, { id: string; name: string; phone: string; totalSpend: number; profit: number; bookings: number; lastBookingDate: string | null }>();
    const neonMap = new Map<string, { name: string; phone: string }>();
    for (const c of allNeonClientsData.clients) {
      const title = c.title && c.title !== "NULL" ? c.title : "";
      neonMap.set(c.id, {
        name: [title, c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown",
        phone: c.phoneNumber || "",
      });
    }
    for (const t of transactionsData as any[]) {
      if (!t.client_id) continue;
      const info = neonMap.get(t.client_id);
      if (!info) continue;
      if (!clientMap.has(t.client_id)) {
        clientMap.set(t.client_id, { id: t.client_id, name: info.name, phone: info.phone, totalSpend: 0, profit: 0, bookings: 0, lastBookingDate: null });
      }
      const entry = clientMap.get(t.client_id)!;
      if (t.quotes) {
        for (const q of t.quotes) {
          if (q.is_active === false) continue;
          const sp = parseFloat(q.sales_price) || 0;
          entry.totalSpend += sp;
          entry.profit += getQuoteProfit(q);
        }
      }
      if (t.booking) {
        entry.bookings += 1;
        const bd = t.booking.date_created || t.booking.createdAt;
        if (bd && (!entry.lastBookingDate || new Date(bd) > new Date(entry.lastBookingDate))) {
          entry.lastBookingDate = bd;
        }
      }
    }
    const arr = Array.from(clientMap.values());
    if (topClientsFilter === "profit") arr.sort((a, b) => b.profit - a.profit);
    else if (topClientsFilter === "bookings") arr.sort((a, b) => b.bookings - a.bookings);
    else arr.sort((a, b) => b.totalSpend - a.totalSpend);
    return arr.slice(0, 10);
  }, [transactionsData, allNeonClientsData, topClientsFilter]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedOpportunitiesSearch(opportunitiesSearch), 300);
    return () => clearTimeout(timer);
  }, [opportunitiesSearch]);

  useEffect(() => {
    setOpportunitiesPage(1);
  }, [opportunitiesTab, opportunitiesStatusFilter, debouncedOpportunitiesSearch, opportunitiesDateRange, opportunitiesSortBy, opportunitiesAgentFilter]);

  const opportunitiesFilters = useMemo(() => ({
    page: opportunitiesPage,
    limit: 25,
    status: opportunitiesStatusFilter,
    search: debouncedOpportunitiesSearch,
    dateRange: opportunitiesDateRange,
    agentId: opportunitiesAgentFilter,
    sortBy: opportunitiesSortBy,
  }), [opportunitiesPage, opportunitiesStatusFilter, debouncedOpportunitiesSearch, opportunitiesDateRange, opportunitiesSortBy, opportunitiesAgentFilter]);

  const opportunitiesFetcher = opportunitiesTab === "enquiries" ? opportunitiesApi.getEnquiries : opportunitiesTab === "quotes" ? opportunitiesApi.getQuotes : opportunitiesApi.getBookings;
  const { data: opportunitiesResult, isLoading: opportunitiesLoading } = useQuery({
    queryKey: ["opportunities", opportunitiesTab, opportunitiesFilters],
    queryFn: () => opportunitiesFetcher(opportunitiesFilters),
    enabled: active === "opportunities",
    keepPreviousData: true,
  } as any);

  const filteredOpportunities = opportunitiesResult?.items || [];
  const opportunitiesTotal = opportunitiesResult?.total || 0;
  const opportunitiesTotalPages = opportunitiesResult?.totalPages || 1;

  const { data: opportunitiesAgentListRaw } = useQuery({
    queryKey: ["opportunities", "agents"],
    queryFn: opportunitiesApi.getAgents,
    enabled: active === "opportunities",
  });
  const opportunitiesAgentList = useMemo(() => {
    if (!opportunitiesAgentListRaw) return [];
    return opportunitiesAgentListRaw.map((a) => ({ id: a.id, name: a.firstName || a.name || "Agent" }));
  }, [opportunitiesAgentListRaw]);

  const liveClientsData = useMemo(() => {
    if (!transactionsData || !allNeonClientsData?.clients) return [];
    const neonMap = new Map<string, { name: string; phone: string; email: string }>();
    for (const c of allNeonClientsData.clients) {
      const title = c.title && c.title !== "NULL" ? c.title : "";
      neonMap.set(c.id, { name: [title, c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown", phone: c.phoneNumber || "", email: c.email || "" });
    }
    const agentMap = new Map<string, string>();
    if (apiUsers) {
      for (const u of apiUsers as any[]) {
        agentMap.set(u.id, u.firstName || u.name || u.email || "Agent");
      }
    }
    const clientMap = new Map<string, { clientId: string; clientName: string; phone: string; email: string; agentName: string; enquiries: number; quotes: number; totalValue: number; latestDate: string; latestTitle: string; status: "enquiry" | "quote" }>();
    for (const t of transactionsData as any[]) {
      if (t.status === "on_booking" || t.booking) continue;
      const clientInfo = t.client_id ? neonMap.get(t.client_id) : null;
      if (!clientInfo) continue;
      const agentName = (t.agent_id && agentMap.get(t.agent_id)) || (t.user_id && agentMap.get(t.user_id)) || "";
      const hasQuotes = t.quotes && t.quotes.length > 0 && t.quotes.some((q: any) => q.is_active !== false);
      const hasEnquiry = !!t.enquiry;
      if (!hasQuotes && !hasEnquiry) continue;
      const dateCreated = t.enquiry?.date_created || t.quotes?.[0]?.date_created || t.created_at;
      const existing = clientMap.get(t.client_id);
      const quoteValue = hasQuotes ? t.quotes.filter((q: any) => q.is_active !== false).reduce((s: number, q: any) => s + (parseFloat(q.sales_price) || 0), 0) : 0;
      const enquiryCount = hasEnquiry ? 1 : 0;
      const quoteCount = hasQuotes ? t.quotes.filter((q: any) => q.is_active !== false).length : 0;
      const txnTitle = hasQuotes ? (t.quotes[0]?.title || t.enquiry?.title || "Untitled") : (t.enquiry?.title || "Untitled");
      const txnStatus: "enquiry" | "quote" = hasQuotes ? "quote" : "enquiry";
      if (existing) {
        existing.enquiries += enquiryCount;
        existing.quotes += quoteCount;
        existing.totalValue += quoteValue;
        if (new Date(dateCreated || 0).getTime() > new Date(existing.latestDate || 0).getTime()) {
          existing.latestDate = dateCreated;
          existing.latestTitle = txnTitle;
          existing.status = txnStatus;
        }
      } else {
        clientMap.set(t.client_id, { clientId: t.client_id, clientName: clientInfo.name, phone: clientInfo.phone, email: clientInfo.email, agentName, enquiries: enquiryCount, quotes: quoteCount, totalValue: quoteValue, latestDate: dateCreated, latestTitle: txnTitle, status: txnStatus });
      }
    }
    return Array.from(clientMap.values());
  }, [transactionsData, allNeonClientsData, apiUsers]);

  const filteredLiveClients = useMemo(() => {
    let result = liveClientsData;
    const now = new Date();
    let rangeStart: Date;
    let rangeEnd: Date | null = null;
    if (liveClientsDateRange === "today") {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (liveClientsDateRange === "this-month") {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (liveClientsDateRange === "last-month") {
      rangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      rangeEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (liveClientsDateRange === "this-week") {
      const day = now.getDay();
      rangeStart = new Date(now); rangeStart.setDate(now.getDate() - (day === 0 ? 6 : day - 1)); rangeStart.setHours(0, 0, 0, 0);
    } else if (liveClientsDateRange === "last-7") {
      rangeStart = new Date(now); rangeStart.setDate(now.getDate() - 7); rangeStart.setHours(0, 0, 0, 0);
    } else {
      rangeStart = new Date(now.getFullYear(), 0, 1);
    }
    result = result.filter((item) => {
      const d = new Date(item.latestDate || 0);
      return d >= rangeStart && (rangeEnd ? d <= rangeEnd : true);
    });
    if (liveClientsStatusFilter !== "all") {
      result = result.filter((item) => item.status === liveClientsStatusFilter);
    }
    if (liveClientsSearch.trim()) {
      const q = liveClientsSearch.toLowerCase().trim();
      result = result.filter((item) => item.clientName.toLowerCase().includes(q) || item.phone.includes(q) || item.email.toLowerCase().includes(q) || item.latestTitle.toLowerCase().includes(q));
    }
    result = [...result].sort((a, b) => new Date(b.latestDate || 0).getTime() - new Date(a.latestDate || 0).getTime());
    return result;
  }, [liveClientsData, liveClientsDateRange, liveClientsStatusFilter, liveClientsSearch]);

  const totals = useMemo(() => {
    if (dashboardStats) {
      // Use API stats if available
      return {
        bookedCount: dashboardStats.bookedCount,
        openCount: dashboardStats.quotedCount + dashboardStats.enquiryCount,
        bookedValue: dashboardStats.totalRevenue,
        openValue: (dashboardStats.totalTransactions - dashboardStats.bookedCount) * dashboardStats.avgDealSize,
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

  const profitStats = useMemo(() => {
    if (!transactionsData) return { todayProfit: 0, weekProfit: 0, monthProfit: 0, salesTarget: 150000, avgBookingValue: 0, totalOpenQuotesValue: 0, bookingsCount: 0, quotesCount: 0 };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - (dayOfWeek - 1));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    let todayProfit = 0, weekProfit = 0, monthProfit = 0, totalBookingValue = 0, bookingsCount = 0, totalOpenQuotesValue = 0, quotesCount = 0;
    for (const t of transactionsData as any[]) {
      if (t.booking) {
        const profit = getQuoteProfit(t.booking);
        const created = new Date(t.booking.date_created || t.created_at);
        totalBookingValue += profit;
        bookingsCount += 1;
        if (created >= todayStart) todayProfit += profit;
        if (created >= weekStart) weekProfit += profit;
        if (created >= monthStart) monthProfit += profit;
      }
      if (t.quotes) {
        for (const q of t.quotes) {
          if (q.is_active === false) continue;
          const qStatus = (q.quote_status || "").toUpperCase();
          if (qStatus !== "BOOKED" && qStatus !== "BOOKING_CONFIRMED") {
            totalOpenQuotesValue += getQuoteProfit(q);
            quotesCount += 1;
          }
        }
      }
    }
    return { todayProfit, weekProfit, monthProfit, salesTarget: 150000, avgBookingValue: bookingsCount > 0 ? totalBookingValue / bookingsCount : 0, totalOpenQuotesValue, bookingsCount, quotesCount };
  }, [transactionsData]);

  const targetPct = profitStats.salesTarget > 0 ? Math.round((profitStats.monthProfit / profitStats.salesTarget) * 100) : 0;

  const profitStatBoxes = (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatBox label="Today's Total Profit" value={currency.format(profitStats.todayProfit)} icon={CircleDollarSign} color="bg-emerald-500" subtext="Profit from today's bookings" />
      <StatBox label="This Week's Total" value={currency.format(profitStats.weekProfit)} icon={TrendingUp} color="bg-blue-500" subtext="Mon – Sun rolling total" />
      <StatBox label="This Month's Total" value={currency.format(profitStats.monthProfit)} icon={BarChart3} color="bg-purple-500" subtext={`${targetPct}% of sales target`} />
      <StatBox label="Agency Sales Target" value={currency.format(profitStats.salesTarget)} icon={Target} color="bg-amber-500" subtext={`${currency.format(profitStats.monthProfit)} achieved`} />
    </div>
  );

  const content = useMemo(() => {
    if (role === "Admin" && active === "overview") {
      return (
        <AdminOverview
          apiUsers={apiUsers as any[] | undefined}
        />
      );
    }

    // Agent Overview - dashboard for agent users
    const isAgentOverview = (role === "Agent" && active === "overview") || 
                            (role === "Admin" && active === "agent-overview");
    
    if (isAgentOverview) {
      return (
        <section className="space-y-4">
          {profitStatBoxes}
          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
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
                  <TabsTrigger value="whats-on" className="rounded-xl" data-testid="tab-overview-whats-on">
                    What's On!
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
              <TabsContent value="whats-on" className="mt-0">
                <div className="grid gap-4" data-testid="panel-whats-on-overview">
                  <div className="flex flex-wrap items-center gap-2" data-testid="whats-on-filters">
                    {(["today", "tomorrow", "this-week", "custom"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setWhatsOnFilter(f)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          whatsOnFilter === f
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                        }`}
                        data-testid={`button-whats-on-${f}`}
                      >
                        {f === "today" ? "Today" : f === "tomorrow" ? "Tomorrow" : f === "this-week" ? "This Week" : "Select Date"}
                      </button>
                    ))}
                    {whatsOnFilter === "custom" && (
                      <DatePicker
                        value={whatsOnDate}
                        onChange={(v) => setWhatsOnDate(v)}
                        placeholder="Pick a date"
                        data-testid="input-whats-on-date"
                      />
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-black/50 dark:text-white/50" />
                      <div className="text-sm font-semibold" data-testid="text-whats-on-tasks-title">Tasks ({filteredTasks.length})</div>
                    </div>
                    {filteredTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-whats-on-tasks">
                        No tasks due {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                      </div>
                    ) : (
                      filteredTasks.map((task, idx) => {
                        const taskHref = task.clientId
                          ? task.entityType === "enquiry"
                            ? `/clients/${task.clientId}/enquiries/${task.entityId}`
                            : task.entityType === "booking"
                              ? `/clients/${task.clientId}/bookings/${task.entityId}`
                              : task.entityType === "quote"
                                ? `/clients/${task.clientId}/quotes/${task.entityId}`
                                : `/clients/${task.clientId}`
                          : null;
                        return (
                        <motion.button
                          key={task.id}
                          type="button"
                          className={`group w-full rounded-2xl border p-3 text-left transition ${task.completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-black/10 bg-black/5 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"}`}
                          data-testid={`card-whats-on-task-${task.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          onClick={() => taskHref && navigate(taskHref)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 shrink-0 rounded-full ${task.completed ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(task.dueDate || 0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                                <div className={`truncate text-sm font-medium ${task.completed ? "text-black/40 line-through dark:text-white/40" : ""}`} data-testid={`text-whats-on-task-title-${task.id}`}>
                                  {task.clientName && <span className="text-blue-600 dark:text-blue-400">{task.clientName} — </span>}
                                  {task.title}
                                </div>
                              </div>
                              <div className="mt-1 ml-4 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                {task.tags?.map((tag: string) => (
                                  <span key={tag} className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" data-testid={`pill-whats-on-task-tag-${task.id}-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${task.completed ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                                {task.completed ? "Done" : "Pending"}
                              </span>
                              {taskHref && <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />}
                            </div>
                          </div>
                        </motion.button>
                        );
                      })
                    )}
                  </div>

                  <Separator className="bg-black/10 dark:bg-white/10" />

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-black/50 dark:text-white/50" />
                      <div className="text-sm font-semibold" data-testid="text-whats-on-tickets-title">Tickets ({filteredTickets.length})</div>
                    </div>
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-whats-on-tickets">
                        No tickets {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                      </div>
                    ) : (
                      filteredTickets.map((ticket, idx) => (
                        <motion.button
                          key={ticket.id}
                          type="button"
                          className="group w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                          data-testid={`card-whats-on-ticket-${ticket.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(ticket.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className="truncate text-sm font-medium" data-testid={`text-whats-on-ticket-subject-${ticket.id}`}>
                                  {ticket.subject}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                {ticket.clientName && <span>{ticket.clientName}</span>}
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ticket.priority === "Urgent" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                  ticket.priority === "High" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                  "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                                }`} data-testid={`pill-whats-on-ticket-priority-${ticket.id}`}>
                                  {ticket.priority}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ticket.status === "Open" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                  ticket.status === "In Progress" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                  ticket.status === "Resolved" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" :
                                  "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                                }`} data-testid={`pill-whats-on-ticket-status-${ticket.id}`}>
                                  {ticket.status}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { stage: "New Lead" as const, hint: "No commission yet", color: "blue" },
                    { stage: "In Play" as const, hint: "Commission added", color: "amber" },
                    { stage: "Booked" as const, hint: "Confirmed", color: "emerald" },
                  ] as const).map((col) => {
                    const items = pipelineStages[col.stage] || [];
                    const sum = items.reduce((s: number, q: any) => s + getQuoteProfit(q), 0);
                    const dotColor = col.color === "blue" ? "bg-blue-500" : col.color === "amber" ? "bg-amber-500" : "bg-emerald-500";
                    const textColor = col.color === "blue" ? "text-blue-700" : col.color === "amber" ? "text-amber-700" : "text-emerald-700";
                    return (
                      <div key={col.stage} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                              <div className={`text-sm font-semibold ${textColor}`}>
                                {col.stage}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {col.hint} · {items.length} quotes
                            </div>
                          </div>
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            {currency.format(sum)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.slice(0, 5).map((q: any) => (
                            <button
                              key={q.id}
                              onClick={() => navigate(col.stage === "Booked" ? `/clients/${q.transaction_id}/bookings/${q.booking?.id || q.id}` : col.stage === "In Play" ? `/clients/${q.transaction_id}/quotes/${q.quotes?.[0]?.id || q.id}` : `/clients/${q.transaction_id}/enquiries/${q.enquiry?.id || q.id}`)}
                              className="w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                              data-testid={`card-pipeline-${col.stage}-${q.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" data-testid={`text-pipeline-name-${q.id}`}>
                                    {q.title}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-black/55 dark:text-white/55">
                                    {pipelineClientNames.get(q.transaction_id) || "Client"}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-black/40 dark:text-white/40">
                                    {new Date(q.travel_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-emerald-700" data-testid={`text-pipeline-value-${q.id}`}>
                                  {getQuoteProfit(q) > 0 ? currency.format(getQuoteProfit(q)) : "TBC"}
                                </div>
                              </div>
                            </button>
                          ))}
                          {items.length > 5 && (
                            <button
                              onClick={() => navigate("/pipeline")}
                              className="w-full rounded-2xl border border-dashed border-black/10 p-2 text-center text-xs text-black/50 hover:bg-black/5 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                            >
                              +{items.length - 5} more · View full pipeline
                            </button>
                          )}
                          {items.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-black/10 p-3 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
                              No quotes
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate("/pipeline")}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    data-testid="link-view-full-pipeline"
                  >
                    View full pipeline →
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="space-y-3" data-testid="panel-overview-social-posts">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5" data-testid="group-overview-social-filters">
                      {(["today", "tomorrow", "date"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setSocialFilter(f)}
                          className={
                            "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                            (socialFilter === f
                              ? "bg-[#3b82f6] text-white"
                              : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                          }
                          data-testid={`filter-overview-social-${f}`}
                        >
                          {f === "date" ? "Date selection" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className={(socialFilter === "date" ? "flex" : "hidden") + " items-center gap-2"} data-testid="wrap-overview-social-date">
                      <DatePicker
                        value={socialDate}
                        onChange={(v) => setSocialDate(v)}
                        placeholder="Pick a date"
                        data-testid="input-overview-social-date"
                      />
                      <span className="text-xs text-black/45 dark:text-white/45" data-testid="text-overview-social-date-hint">
                        Showing: {socialDate}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-black/50 dark:text-white/50">
                    {filteredOverviewSocialPosts.length} {filteredOverviewSocialPosts.length === 1 ? "post" : "posts"} found
                  </p>

                  {filteredOverviewSocialPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
                      <CalendarClock className="w-10 h-10 mx-auto text-black/15 dark:text-white/15 mb-2" />
                      <p className="text-sm text-black/50 dark:text-white/50">No posts for this filter</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence mode="popLayout">
                        {filteredOverviewSocialPosts.slice(0, 6).map(({ quote, clientId }) => {
                          const imageUrl = spGetFirstImage(quote);
                          const tourOp = quote.main_tour_operator_name;
                          const pricePerPerson = quote.price_per_person
                            ? `${spFormatPrice(quote.price_per_person)}pp`
                            : spFormatPrice(quote.sales_price);
                          return (
                            <motion.div
                              key={quote.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
                              data-testid={`card-overview-social-post-${quote.id}`}
                            >
                              <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                                <img
                                  src={imageUrl || "/images/default-hotel.jpg"}
                                  alt={quote.title || "Deal image"}
                                  className="w-full h-full object-cover"
                                  data-testid={`img-overview-social-post-${quote.id}`}
                                />
                                {tourOp && (
                                  <Badge
                                    className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full"
                                    data-testid={`badge-tour-op-overview-${quote.id}`}
                                  >
                                    {tourOp}
                                  </Badge>
                                )}
                              </div>

                              <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate" data-testid={`text-overview-title-${quote.id}`}>
                                      Title: <span className="font-semibold">{quote.title || "Untitled"}</span>
                                    </h3>
                                    <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate" data-testid={`text-overview-subtitle-${quote.id}`}>
                                      Sub: {spGetSubtitle(quote)}
                                    </p>
                                  </div>
                                  <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow" data-testid={`badge-price-overview-${quote.id}`}>
                                    {pricePerPerson}
                                  </Badge>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Hotel:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-overview-hotel-${quote.id}`}>{spGetHotelName(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Departing:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-overview-departing-${quote.id}`}>{spGetDepartingAirport(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Nights:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-overview-nights-${quote.id}`}>{quote.num_of_nights}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Board:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-overview-board-${quote.id}`}>{spGetBoardBasis(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-overview-travel-date-${quote.id}`}>{spFormatDate(quote.travel_date)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date Created:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-overview-created-${quote.id}`}>{spFormatDate(quote.date_created)}</span>
                                  </div>
                                </div>

                                <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8 flex flex-col gap-3">
                                  <Link href={`/clients/${clientId}/quotes/${quote.id}`}>
                                    <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2" data-testid={`button-view-quote-overview-${quote.id}`}>
                                      <Eye className="w-4 h-4" />
                                      View Quote
                                    </Button>
                                  </Link>
                                  <Button className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white" data-testid={`button-schedule-post-overview-${quote.id}`}>
                                    <CalendarClock className="w-4 h-4" />
                                    Schedule Post
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}

                  {filteredOverviewSocialPosts.length > 6 && (
                    <div className="text-center pt-2">
                      <Link href="/social-posts">
                        <Button variant="outline" size="sm" className="rounded-xl text-xs" data-testid="link-view-all-social-posts">
                          View all {filteredOverviewSocialPosts.length} posts →
                        </Button>
                      </Link>
                    </div>
                  )}
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
              <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-pinned-section">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500/10">
                      <Star className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-black/80 dark:text-white/80">Pinned</div>
                      <div className="text-[10px] text-black/45 dark:text-white/45">
                        {userFavorites && userFavorites.length > 0
                          ? `${userFavorites.length} item${userFavorites.length !== 1 ? "s" : ""}`
                          : "No items pinned yet"}
                      </div>
                    </div>
                  </div>
                </div>
                {userFavorites && userFavorites.length > 0 ? (
                  <div className="space-y-1.5">
                    {userFavorites.map((fav: any) => {
                      const icon = fav.itemType === "client" ? <UserRound className="h-3.5 w-3.5" /> : fav.itemType === "quote" ? <Sparkles className="h-3.5 w-3.5" /> : fav.itemType === "note" ? <StickyNote className="h-3.5 w-3.5" /> : <ClipboardList className="h-3.5 w-3.5" />;
                      const noteQuoteId = fav.itemType === "note" && fav.subtitle?.startsWith("quoteId:") ? fav.subtitle.split("|")[0].replace("quoteId:", "") : null;
                      const href = fav.itemType === "client" ? `/clients/${fav.itemId}` : fav.itemType === "quote" ? `/clients/_/quotes/${fav.itemId}` : fav.itemType === "enquiry" ? `/clients/_/enquiries/${fav.itemId}` : noteQuoteId ? `/clients/_/quotes/${noteQuoteId}` : "#";
                      const resolvedClientName = (fav.itemType === "quote" || fav.itemType === "note") ? pinnedClientNameMap.get(fav.itemType === "note" ? (noteQuoteId || "") : fav.itemId) : null;
                      let displaySubtitle = fav.itemType === "note" && fav.subtitle?.includes("|") ? fav.subtitle.split("|").slice(1).join("|") : fav.subtitle;
                      if (fav.itemType !== "client" && resolvedClientName && !displaySubtitle?.includes(resolvedClientName)) {
                        displaySubtitle = resolvedClientName + (displaySubtitle ? " · " + displaySubtitle : "");
                      }
                      return (
                        <motion.div
                          key={fav.id}
                          className="group flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          data-testid={`card-pinned-${fav.id}`}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            onClick={() => navigate(fav.itemType === "client" ? `/clients/${fav.itemId}` : href)}
                            data-testid={`link-pinned-${fav.id}`}
                          >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                              {icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-xs font-semibold">{fav.label}</div>
                              {displaySubtitle && <div className="truncate text-[10px] text-black/50 dark:text-white/50">{displaySubtitle}</div>}
                            </div>
                          </button>
                          <button
                            type="button"
                            className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-black/30 opacity-0 transition hover:bg-black/[0.06] hover:text-black/60 group-hover:opacity-100 dark:text-white/30 dark:hover:bg-white/10 dark:hover:text-white/60"
                            onClick={() => removeFavoriteMutation.mutate(fav.id)}
                            title="Unpin"
                            data-testid={`button-unpin-${fav.id}`}
                          >
                            <PinOff className="h-3 w-3" />
                          </button>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-3 py-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
                    <Pin className="mx-auto h-5 w-5 text-black/20 dark:text-white/20 mb-1.5" />
                    <div className="text-[11px] text-black/40 dark:text-white/40">
                      Pin clients, quotes, or enquiries for quick access. Use the pin icon on any client card.
                    </div>
                  </div>
                )}
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
          </div>
        </section>
      );
    }
    
    if (active === "connect-email") {
      return <EmailInbox />;
    }

    if (active === "connect-internal-chat") {
      const currentUserId = currentUser?.id;
      return (
        <section className="grid h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[320px_1fr]" data-testid="section-live-chat">
          <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-black/10 px-4 py-3 dark:border-white/10">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold" data-testid="text-chat-title">Conversations</div>
                <div className="text-xs text-muted-foreground">{(chatConversations || []).length} chats</div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl border-black/10 bg-black/5 dark:border-white/10 dark:bg-white/5" data-testid="button-new-chat">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56 rounded-2xl">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">Start new chat with</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(apiUsers || []).filter((u: any) => u.id !== currentUserId).map((u: any) => (
                    <DropdownMenuItem
                      key={u.id}
                      onClick={() => {
                        startDirectChatMutation.mutate(u.id, {
                          onSuccess: (data) => setChatSelectedConversation(data.conversationId),
                        });
                      }}
                      className="rounded-xl"
                      data-testid={`chat-user-${u.id}`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6]/10 text-[#3b82f6] text-xs font-semibold">
                          {(u.name || "?").charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm">{u.name}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex-1 overflow-y-auto" data-testid="chat-conversation-list">
              {(chatConversations || []).length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <MessageSquare className="h-10 w-10 text-black/20 dark:text-white/20 mb-3" />
                  <div className="text-sm font-medium text-black/50 dark:text-white/50">No conversations yet</div>
                  <div className="text-xs text-black/40 dark:text-white/40 mt-1">Start a new chat with a team member</div>
                </div>
              ) : (
                (chatConversations || []).map((conv: any) => {
                  const otherParticipants = (conv.participants || []).filter((p: any) => p.userId !== currentUserId);
                  const displayName = conv.type === "group" ? (conv.name || "Group Chat") : (otherParticipants[0]?.userName || "Unknown");
                  const initials = displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase();
                  const isSelected = chatSelectedConversation === conv.id;
                  const lastMsg = conv.lastMessage;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setChatSelectedConversation(conv.id)}
                      className={`flex w-full items-center gap-3 border-b border-black/5 px-4 py-3 text-left transition dark:border-white/5 ${
                        isSelected ? "bg-[#3b82f6]/5 dark:bg-[#3b82f6]/10" : "hover:bg-black/3 dark:hover:bg-white/3"
                      }`}
                      data-testid={`chat-conv-${conv.id}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        isSelected ? "bg-[#3b82f6] text-white" : "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
                      }`}>
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate text-sm font-medium">{displayName}</span>
                          {lastMsg && (
                            <span className="shrink-0 text-[10px] text-black/40 dark:text-white/40">
                              {new Date(lastMsg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs text-black/50 dark:text-white/50">
                            {lastMsg ? lastMsg.content.replace(/<[^>]*>/g, "") : "No messages yet"}
                          </span>
                          {(conv.unreadCount || 0) > 0 && (
                            <span className="ml-2 inline-flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-[#3b82f6] px-1.5 text-[10px] font-bold text-white" data-testid={`chat-unread-${conv.id}`}>
                              {conv.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </Card>

          <Card className="glass ringed grain flex flex-col rounded-3xl p-0 overflow-hidden">
            {!chatSelectedConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#3b82f6]/10">
                  <MessageSquare className="h-8 w-8 text-[#3b82f6]" />
                </div>
                <div className="text-lg font-semibold" data-testid="text-chat-empty">Live Chat</div>
                <div className="mt-1 text-sm text-muted-foreground">Select a conversation or start a new one</div>
              </div>
            ) : (
              <>
                {(() => {
                  const conv = (chatConversations || []).find((c: any) => c.id === chatSelectedConversation);
                  const otherParticipants = (conv?.participants || []).filter((p: any) => p.userId !== currentUserId);
                  const displayName = conv?.type === "group" ? (conv.name || "Group Chat") : (otherParticipants[0]?.userName || "Unknown");
                  return (
                    <div className="flex items-center gap-3 border-b border-black/10 px-4 py-3 dark:border-white/10">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3b82f6] text-sm font-semibold text-white">
                        {displayName.split(" ").map((w: string) => w[0]).join("").substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate" data-testid="text-chat-header-name">{displayName}</div>
                        <div className="text-xs text-muted-foreground">
                          {conv?.type === "group" ? `${(conv.participants || []).length} members` : "Direct message"}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setChatSelectedConversation(null)}
                        className="rounded-xl"
                        data-testid="button-close-chat"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })()}

                <div className="flex-1 overflow-y-auto p-4 space-y-3" data-testid="chat-messages-area">
                  {(chatMessages || []).length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <div className="text-sm text-black/40 dark:text-white/40">No messages yet. Say hello!</div>
                    </div>
                  ) : (
                    (chatMessages || []).map((msg: any) => {
                      const isOwn = msg.senderId === currentUserId;
                      const isImage = msg.fileType?.startsWith("image/");
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"}`} data-testid={`chat-msg-${msg.id}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${
                            isOwn
                              ? "bg-[#3b82f6] text-white"
                              : "bg-black/5 text-black dark:bg-white/10 dark:text-white"
                          }`}>
                            {!isOwn && (
                              <div className="mb-0.5 text-[11px] font-semibold text-[#3b82f6]">{msg.senderName || "Unknown"}</div>
                            )}
                            {msg.fileUrl && (
                              <div className="mb-1.5">
                                {isImage ? (
                                  <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer">
                                    <img src={msg.fileUrl} alt={msg.fileName || "image"} className="max-w-full rounded-lg max-h-[200px] object-cover" data-testid={`chat-img-${msg.id}`} />
                                  </a>
                                ) : (
                                  <a
                                    href={msg.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${isOwn ? "bg-white/10 hover:bg-white/20" : "bg-black/5 hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10"}`}
                                    data-testid={`chat-file-${msg.id}`}
                                  >
                                    <FileText className="h-4 w-4 shrink-0" />
                                    <span className="truncate">{msg.fileName}</span>
                                    {msg.fileSize && (
                                      <span className="shrink-0 opacity-60">
                                        {msg.fileSize < 1024 * 1024 ? `${(msg.fileSize / 1024).toFixed(0)} KB` : `${(msg.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                      </span>
                                    )}
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.content && msg.content !== "<p></p>" && (
                              <div
                                className="text-sm break-words chat-message-content"
                                dangerouslySetInnerHTML={{ __html: msg.content }}
                              />
                            )}
                            <div className={`mt-1 text-[10px] ${isOwn ? "text-white/60" : "text-black/40 dark:text-white/40"}`}>
                              {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <ChatRichInput
                  onSend={(content) => {
                    if (!chatSelectedConversation) return;
                    sendMessageMutation.mutate({ conversationId: chatSelectedConversation, content });
                  }}
                  onSendWithFile={(content, file) => {
                    if (!chatSelectedConversation) return;
                    sendMessageWithFileMutation.mutate({ conversationId: chatSelectedConversation, content, file });
                  }}
                  disabled={sendMessageMutation.isPending || sendMessageWithFileMutation.isPending}
                />
              </>
            )}
          </Card>
        </section>
      );
    }

    // Clients section - UI-only copy of Overview for separate customization
    if (active === "clients") {
      return (
        <section className="space-y-4">
          {profitStatBoxes}
          <div className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="space-y-1">
                <div className="text-sm font-medium" data-testid="text-clients-title">
                  Clients
                </div>
                <div className="text-xs text-muted-foreground" data-testid="text-clients-subtitle">
                  Your clients at a glance.
                </div>
              </div>

              <Tabs value={clientsTab} onValueChange={(v) => setClientsTab(v as any)}>
                <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-clients">
                  <TabsTrigger value="clients-list" className="rounded-xl" data-testid="tab-clients-list">
                    Clients List
                  </TabsTrigger>
                  <TabsTrigger value="pipeline" className="rounded-xl" data-testid="tab-clients-pipeline">
                    Live Clients
                  </TabsTrigger>
                  <TabsTrigger value="calendar" className="rounded-xl" data-testid="tab-clients-social">
                    Social Posts
                  </TabsTrigger>
                  <TabsTrigger value="news" className="rounded-xl" data-testid="tab-clients-news">
                    News
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Separator className="my-4 bg-black/10 dark:bg-white/10" />

            <Tabs value={clientsTab}>
              <TabsContent value="clients-list" className="mt-0">
                <div className="grid gap-4" data-testid="panel-clients-list">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
                      <input
                        type="text"
                        value={clientsListSearch}
                        onChange={(e) => { setClientsListSearch(e.target.value); setClientsListPage(1); }}
                        placeholder="Search clients..."
                        className="w-full rounded-xl border border-black/10 bg-black/5 py-2 pl-9 pr-3 text-sm text-black/90 placeholder:text-black/40 outline-none transition focus:border-blue-500/50 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:bg-white/5"
                        data-testid="input-clients-list-search"
                      />
                    </div>
                    <div className="text-xs text-black/50 dark:text-white/50 shrink-0" data-testid="text-clients-list-count">
                      {clientsListData?.total ?? 0} clients
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {(!clientsListData?.clients || clientsListData.clients.length === 0) ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]" data-testid="empty-clients-list">
                        <Users className="mx-auto h-8 w-8 text-black/15 dark:text-white/15 mb-2" />
                        <p className="text-sm text-black/50 dark:text-white/50">
                          {clientsListSearch ? "No clients match your search" : "No clients found"}
                        </p>
                      </div>
                    ) : (
                      clientsListData.clients.map((client: any, idx: number) => {
                        const fullName = [client.title && client.title !== "NULL" ? client.title : "", client.firstName, client.surename].filter(Boolean).join(" ") || "Unknown";
                        return (
                          <motion.button
                            key={client.id}
                            type="button"
                            className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                            data-testid={`card-clients-list-${client.id}`}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.2) }}
                            onClick={() => navigate(`/clients/${client.id}`)}
                          >
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-sm font-bold text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                              {(client.firstName?.[0] || "?").toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-semibold" data-testid={`text-clients-list-name-${client.id}`}>{fullName}</div>
                              <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-white/50">
                                {client.email && <span className="truncate">{client.email}</span>}
                                {client.email && client.phoneNumber && <span>·</span>}
                                {client.phoneNumber && <span className="shrink-0">{client.phoneNumber}</span>}
                              </div>
                            </div>
                            {client.badge && (
                              <span className="shrink-0 inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" data-testid={`badge-clients-list-${client.id}`}>
                                {client.badge}
                              </span>
                            )}
                            <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                          </motion.button>
                        );
                      })
                    )}
                  </div>

                  {clientsListData && clientsListData.totalPages > 1 && (
                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        disabled={clientsListPage <= 1}
                        onClick={() => setClientsListPage((p) => Math.max(1, p - 1))}
                        className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        data-testid="button-clients-list-prev"
                      >
                        Previous
                      </button>
                      <span className="text-xs text-black/50 dark:text-white/50" data-testid="text-clients-list-page">
                        Page {clientsListPage} of {clientsListData.totalPages}
                      </span>
                      <button
                        type="button"
                        disabled={clientsListPage >= clientsListData.totalPages}
                        onClick={() => setClientsListPage((p) => Math.min(clientsListData.totalPages, p + 1))}
                        className="rounded-xl border border-black/10 bg-black/5 px-3 py-1.5 text-xs font-semibold transition hover:bg-black/10 disabled:opacity-30 disabled:cursor-not-allowed dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                        data-testid="button-clients-list-next"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="space-y-3" data-testid="panel-live-clients">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40 dark:text-white/40" />
                        <input
                          type="text"
                          value={liveClientsSearch}
                          onChange={(e) => setLiveClientsSearch(e.target.value)}
                          placeholder="Search live clients..."
                          className="w-full rounded-xl border border-black/10 bg-black/5 py-2 pl-9 pr-3 text-sm text-black/90 placeholder:text-black/40 outline-none transition focus:border-blue-500/50 focus:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/40 dark:focus:bg-white/5"
                          data-testid="input-live-clients-search"
                        />
                      </div>
                      <div className="text-xs text-black/50 dark:text-white/50 shrink-0" data-testid="text-live-clients-count">
                        {filteredLiveClients.length} live
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {([
                      { value: "today", label: "Today" },
                      { value: "this-week", label: "This Week" },
                      { value: "this-month", label: "This Month" },
                      { value: "last-month", label: "Last Month" },
                      { value: "last-7", label: "Last 7 Days" },
                      { value: "this-year", label: "This Year" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLiveClientsDateRange(opt.value)}
                        className={
                          "rounded-full px-3 py-1 text-xs font-medium transition " +
                          (liveClientsDateRange === opt.value
                            ? "bg-[#3b82f6] text-white"
                            : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10")
                        }
                        data-testid={`filter-live-clients-date-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                    <span className="mx-1 text-black/20 dark:text-white/20">|</span>
                    {([
                      { value: "all", label: "All" },
                      { value: "enquiry", label: "Enquiries" },
                      { value: "quote", label: "Quotes" },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setLiveClientsStatusFilter(opt.value)}
                        className={
                          "rounded-full px-3 py-1 text-xs font-medium transition " +
                          (liveClientsStatusFilter === opt.value
                            ? "bg-[#3b82f6] text-white"
                            : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10")
                        }
                        data-testid={`filter-live-clients-status-${opt.value}`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5">
                    {filteredLiveClients.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-8 text-center dark:border-white/10 dark:bg-white/[0.02]" data-testid="empty-live-clients">
                        <Users className="mx-auto h-8 w-8 text-black/15 dark:text-white/15 mb-2" />
                        <p className="text-sm text-black/50 dark:text-white/50">
                          {liveClientsSearch ? "No live clients match your search" : "No live clients in this period"}
                        </p>
                      </div>
                    ) : (
                      filteredLiveClients.map((lc, idx) => (
                        <motion.button
                          key={lc.clientId}
                          type="button"
                          className="group flex w-full items-center gap-3 rounded-2xl border border-black/10 bg-black/5 px-3 py-2.5 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                          data-testid={`card-live-client-${lc.clientId}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15, delay: Math.min(idx * 0.02, 0.3) }}
                          onClick={() => navigate(`/clients/${lc.clientId}`)}
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-sm font-bold text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/70">
                            {(lc.clientName?.[0] || "?").toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-semibold" data-testid={`text-live-client-name-${lc.clientId}`}>{lc.clientName}</div>
                            <div className="flex items-center gap-2 text-[11px] text-black/50 dark:text-white/50">
                              {lc.phone && <span className="shrink-0">{lc.phone}</span>}
                              {lc.phone && lc.latestTitle && <span>·</span>}
                              <span className="truncate">{lc.latestTitle}</span>
                              {lc.agentName && <><span>·</span><span className="shrink-0 font-medium text-purple-600 dark:text-purple-400" data-testid={`text-live-client-agent-${lc.clientId}`}>{lc.agentName}</span></>}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {lc.enquiries > 0 && (
                              <span className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" data-testid={`badge-live-client-enq-${lc.clientId}`}>
                                {lc.enquiries} enq
                              </span>
                            )}
                            {lc.quotes > 0 && (
                              <span className="inline-flex items-center rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300" data-testid={`badge-live-client-qt-${lc.clientId}`}>
                                {lc.quotes} qt
                              </span>
                            )}
                            {lc.totalValue > 0 && (
                              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400" data-testid={`text-live-client-value-${lc.clientId}`}>
                                {currency.format(lc.totalValue)}
                              </span>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="space-y-3" data-testid="panel-clients-social-posts">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5" data-testid="group-clients-social-filters">
                      {(["today", "tomorrow", "date"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setSocialFilter(f)}
                          className={
                            "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                            (socialFilter === f
                              ? "bg-[#3b82f6] text-white"
                              : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                          }
                          data-testid={`filter-clients-social-${f}`}
                        >
                          {f === "date" ? "Date selection" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className={(socialFilter === "date" ? "flex" : "hidden") + " items-center gap-2"} data-testid="wrap-clients-social-date">
                      <DatePicker
                        value={socialDate}
                        onChange={(v) => setSocialDate(v)}
                        placeholder="Pick a date"
                        data-testid="input-clients-social-date"
                      />
                      <span className="text-xs text-black/45 dark:text-white/45" data-testid="text-clients-social-date-hint">
                        Showing: {socialDate}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-black/50 dark:text-white/50">
                    {filteredOverviewSocialPosts.length} {filteredOverviewSocialPosts.length === 1 ? "post" : "posts"} found
                  </p>

                  {filteredOverviewSocialPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
                      <CalendarClock className="w-10 h-10 mx-auto text-black/15 dark:text-white/15 mb-2" />
                      <p className="text-sm text-black/50 dark:text-white/50">No posts for this filter</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence mode="popLayout">
                        {filteredOverviewSocialPosts.slice(0, 6).map(({ quote, clientId }) => {
                          const imageUrl = spGetFirstImage(quote);
                          const tourOp = quote.main_tour_operator_name;
                          const pricePerPerson = quote.price_per_person
                            ? `${spFormatPrice(quote.price_per_person)}pp`
                            : spFormatPrice(quote.sales_price);
                          return (
                            <motion.div
                              key={quote.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
                              data-testid={`card-clients-social-post-${quote.id}`}
                            >
                              <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                                <img
                                  src={imageUrl || "/images/default-hotel.jpg"}
                                  alt={quote.title || "Deal image"}
                                  className="w-full h-full object-cover"
                                  data-testid={`img-clients-social-post-${quote.id}`}
                                />
                                {tourOp && (
                                  <Badge
                                    className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full"
                                    data-testid={`badge-tour-op-clients-${quote.id}`}
                                  >
                                    {tourOp}
                                  </Badge>
                                )}
                              </div>

                              <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-sp-title-${quote.id}`}>
                                      Title: <span className="font-semibold">{quote.title || "Untitled"}</span>
                                    </h3>
                                    <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate" data-testid={`text-clients-sp-subtitle-${quote.id}`}>
                                      Sub: {spGetSubtitle(quote)}
                                    </p>
                                  </div>
                                  <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow" data-testid={`badge-price-clients-${quote.id}`}>
                                    {pricePerPerson}
                                  </Badge>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Hotel:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-hotel-${quote.id}`}>{spGetHotelName(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Departing:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-departing-${quote.id}`}>{spGetDepartingAirport(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Nights:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-nights-${quote.id}`}>{quote.num_of_nights}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Board:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate" data-testid={`text-clients-board-${quote.id}`}>{spGetBoardBasis(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-travel-date-${quote.id}`}>{spFormatDate(quote.travel_date)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date Created:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90" data-testid={`text-clients-created-${quote.id}`}>{spFormatDate(quote.date_created)}</span>
                                  </div>
                                </div>

                                <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8 flex flex-col gap-3">
                                  <Link href={`/clients/${clientId}/quotes/${quote.id}`}>
                                    <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2" data-testid={`button-view-quote-clients-${quote.id}`}>
                                      <Eye className="w-4 h-4" />
                                      View Quote
                                    </Button>
                                  </Link>
                                  <Button className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white" data-testid={`button-schedule-post-clients-${quote.id}`}>
                                    <CalendarClock className="w-4 h-4" />
                                    Schedule Post
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}

                  {filteredOverviewSocialPosts.length > 6 && (
                    <div className="text-center pt-2">
                      <Link href="/social-posts">
                        <Button variant="outline" size="sm" className="rounded-xl text-xs" data-testid="link-clients-view-all-social-posts">
                          View all {filteredOverviewSocialPosts.length} posts →
                        </Button>
                      </Link>
                    </div>
                  )}
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

              <Card className="glass ringed grain rounded-3xl p-4" data-testid="card-top-clients-section">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-500/10">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-black/80 dark:text-white/80">Top Clients</div>
                      <div className="text-[10px] text-black/45 dark:text-white/45">
                        {topClients.length > 0 ? `${topClients.length} clients` : "No data yet"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {([["total_spend", "Spend"], ["profit", "Profit"], ["bookings", "Bookings"]] as const).map(([val, label]) => (
                      <button
                        key={val}
                        onClick={() => setTopClientsFilter(val)}
                        className={`rounded-xl px-2.5 py-1 text-[10px] font-medium transition ${topClientsFilter === val ? "bg-emerald-600 text-white" : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"}`}
                        data-testid={`button-top-clients-filter-${val}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {topClients.length > 0 ? (
                  <div className="space-y-1.5">
                    {topClients.map((tc, idx) => (
                      <motion.div
                        key={tc.id}
                        className="group flex items-center gap-2.5 rounded-2xl border border-black/10 bg-black/5 px-3 py-2 transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7 cursor-pointer"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => navigate(`/clients/${tc.id}`)}
                        data-testid={`card-top-client-${tc.id}`}
                      >
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-black/10 bg-white/60 text-[10px] font-bold text-black/50 dark:border-white/10 dark:bg-white/5 dark:text-white/50">
                          {idx + 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-semibold">{tc.name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-black/50 dark:text-white/50">
                            {tc.phone && <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{tc.phone}</span>}
                            {tc.lastBookingDate && <span>Last: {new Date(tc.lastBookingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}</span>}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-xs font-semibold tabular-nums">
                            {topClientsFilter === "bookings" ? tc.bookings : currency.format(topClientsFilter === "profit" ? tc.profit : tc.totalSpend)}
                          </div>
                          <div className="text-[10px] text-black/40 dark:text-white/40">
                            {topClientsFilter === "total_spend" ? "spend" : topClientsFilter === "profit" ? "profit" : "bookings"}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] px-3 py-4 text-center dark:border-white/10 dark:bg-white/[0.02]">
                    <TrendingUp className="mx-auto h-5 w-5 text-black/20 dark:text-white/20 mb-1.5" />
                    <div className="text-[11px] text-black/40 dark:text-white/40">
                      Top clients will appear here once transactions are recorded.
                    </div>
                  </div>
                )}
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
          </div>
        </section>
      );
    }

    // Show Agent workspace for Agents, or for Admins when viewing agent sections
    const agentSections = ["enquiries", "quotes", "bookings"];
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
                  <TabsTrigger value="whats-on" className="rounded-xl" data-testid="tab-whats-on">
                    What's On!
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
              <TabsContent value="whats-on" className="mt-0">
                <div className="grid gap-4" data-testid="panel-whats-on-workspace">
                  <div className="flex flex-wrap items-center gap-2" data-testid="whats-on-workspace-filters">
                    {(["today", "tomorrow", "this-week", "custom"] as const).map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setWhatsOnFilter(f)}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                          whatsOnFilter === f
                            ? "bg-black text-white dark:bg-white dark:text-black"
                            : "border border-black/10 bg-black/5 text-black/70 hover:bg-black/10 dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                        }`}
                        data-testid={`button-workspace-whats-on-${f}`}
                      >
                        {f === "today" ? "Today" : f === "tomorrow" ? "Tomorrow" : f === "this-week" ? "This Week" : "Select Date"}
                      </button>
                    ))}
                    {whatsOnFilter === "custom" && (
                      <DatePicker
                        value={whatsOnDate}
                        onChange={(v) => setWhatsOnDate(v)}
                        placeholder="Pick a date"
                        data-testid="input-workspace-whats-on-date"
                      />
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <ListChecks className="h-4 w-4 text-black/50 dark:text-white/50" />
                      <div className="text-sm font-semibold" data-testid="text-workspace-tasks-title">Tasks ({filteredTasks.length})</div>
                    </div>
                    {filteredTasks.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-workspace-tasks">
                        No tasks due {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                      </div>
                    ) : (
                      filteredTasks.map((task, idx) => {
                        const taskHref = task.clientId
                          ? task.entityType === "enquiry"
                            ? `/clients/${task.clientId}/enquiries/${task.entityId}`
                            : task.entityType === "booking"
                              ? `/clients/${task.clientId}/bookings/${task.entityId}`
                              : task.entityType === "quote"
                                ? `/clients/${task.clientId}/quotes/${task.entityId}`
                                : `/clients/${task.clientId}`
                          : null;
                        return (
                        <motion.button
                          key={task.id}
                          type="button"
                          className={`group w-full rounded-2xl border p-3 text-left transition ${task.completed ? "border-emerald-500/20 bg-emerald-500/5" : "border-black/10 bg-black/5 hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"}`}
                          data-testid={`card-workspace-task-${task.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          onClick={() => taskHref && navigate(taskHref)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 shrink-0 rounded-full ${task.completed ? "bg-emerald-500" : "bg-amber-500"}`} />
                                <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(task.dueDate || 0).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                                <div className={`truncate text-sm font-medium ${task.completed ? "text-black/40 line-through dark:text-white/40" : ""}`} data-testid={`text-workspace-task-title-${task.id}`}>
                                  {task.clientName && <span className="text-blue-600 dark:text-blue-400">{task.clientName} — </span>}
                                  {task.title}
                                </div>
                              </div>
                              <div className="mt-1 ml-4 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                {task.tags?.map((tag: string) => (
                                  <span key={tag} className="inline-flex items-center rounded-full border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300" data-testid={`pill-workspace-task-tag-${task.id}-${tag}`}>
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${task.completed ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" : "border-amber-500/25 bg-amber-500/10 text-amber-700"}`}>
                                {task.completed ? "Done" : "Pending"}
                              </span>
                              {taskHref && <ChevronRight className="h-4 w-4 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />}
                            </div>
                          </div>
                        </motion.button>
                        );
                      })
                    )}
                  </div>

                  <Separator className="bg-black/10 dark:bg-white/10" />

                  <div className="grid gap-3">
                    <div className="flex items-center gap-2">
                      <LifeBuoy className="h-4 w-4 text-black/50 dark:text-white/50" />
                      <div className="text-sm font-semibold" data-testid="text-workspace-tickets-title">Tickets ({filteredTickets.length})</div>
                    </div>
                    {filteredTickets.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-black/10 bg-black/[0.02] p-6 text-center text-xs text-black/45 dark:border-white/10 dark:bg-white/[0.02] dark:text-white/45" data-testid="empty-workspace-tickets">
                        No tickets {whatsOnFilter === "today" ? "today" : whatsOnFilter === "tomorrow" ? "tomorrow" : whatsOnFilter === "this-week" ? "this week" : `on ${whatsOnDate}`}
                      </div>
                    ) : (
                      filteredTickets.map((ticket, idx) => (
                        <motion.button
                          key={ticket.id}
                          type="button"
                          className="group w-full rounded-2xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                          data-testid={`card-workspace-ticket-${ticket.id}`}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          onClick={() => navigate(`/tickets/${ticket.id}`)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="shrink-0 text-xs font-semibold text-black/60 dark:text-white/60">{new Date(ticket.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                                <span className="truncate text-sm font-medium" data-testid={`text-workspace-ticket-subject-${ticket.id}`}>
                                  {ticket.subject}
                                </span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                {ticket.clientName && <span>{ticket.clientName}</span>}
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ticket.priority === "Urgent" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                  ticket.priority === "High" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                  "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                                }`} data-testid={`pill-workspace-ticket-priority-${ticket.id}`}>
                                  {ticket.priority}
                                </span>
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                  ticket.status === "Open" ? "border-red-500/25 bg-red-500/10 text-red-700" :
                                  ticket.status === "In Progress" ? "border-amber-500/25 bg-amber-500/10 text-amber-700" :
                                  ticket.status === "Resolved" ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700" :
                                  "border-black/10 bg-black/[0.03] text-black/60 dark:border-white/10 dark:bg-white/5 dark:text-white/60"
                                }`} data-testid={`pill-workspace-ticket-status-${ticket.id}`}>
                                  {ticket.status}
                                </span>
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-black/30 transition group-hover:translate-x-0.5 dark:text-white/30" />
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="pipeline" className="mt-0">
                <div className="grid gap-3 md:grid-cols-3">
                  {([
                    { stage: "New Lead" as const, hint: "No commission yet", color: "blue" },
                    { stage: "In Play" as const, hint: "Commission added", color: "amber" },
                    { stage: "Booked" as const, hint: "Confirmed", color: "emerald" },
                  ] as const).map((col) => {
                    const items = pipelineStages[col.stage] || [];
                    const sum = items.reduce((s: number, q: any) => s + getQuoteProfit(q), 0);
                    const dotColor = col.color === "blue" ? "bg-blue-500" : col.color === "amber" ? "bg-amber-500" : "bg-emerald-500";
                    const textColor = col.color === "blue" ? "text-blue-700" : col.color === "amber" ? "text-amber-700" : "text-emerald-700";
                    return (
                      <div key={col.stage} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full ${dotColor}`} />
                              <div className={`text-sm font-semibold ${textColor}`} data-testid={`text-pipeline-stage-${col.stage}`}>
                                {col.stage}
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground" data-testid={`text-pipeline-hint-${col.stage}`}>
                              {col.hint} · {items.length} quotes
                            </div>
                          </div>
                          <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400" data-testid={`text-pipeline-sum-${col.stage}`}>
                            {currency.format(sum)}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {items.slice(0, 5).map((q: any) => (
                            <button
                              key={q.id}
                              onClick={() => navigate(col.stage === "Booked" ? `/clients/${q.transaction_id}/bookings/${q.booking?.id || q.id}` : col.stage === "In Play" ? `/clients/${q.transaction_id}/quotes/${q.quotes?.[0]?.id || q.id}` : `/clients/${q.transaction_id}/enquiries/${q.enquiry?.id || q.id}`)}
                              className="w-full rounded-3xl border border-black/10 bg-black/5 p-3 text-left transition hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/7"
                              data-testid={`card-pipeline-${col.stage}-${q.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="truncate text-sm font-semibold" data-testid={`text-pipeline-name-${q.id}`}>
                                    {q.title}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-black/55 dark:text-white/55">
                                    {pipelineClientNames.get(q.transaction_id) || "Client"}
                                  </div>
                                  <div className="mt-0.5 truncate text-xs text-black/40 dark:text-white/40" data-testid={`text-pipeline-trip-${q.id}`}>
                                    {new Date(q.travel_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                                  </div>
                                </div>
                                <div className="text-xs font-semibold text-emerald-700" data-testid={`text-pipeline-value-${q.id}`}>
                                  {getQuoteProfit(q) > 0 ? currency.format(getQuoteProfit(q)) : "TBC"}
                                </div>
                              </div>
                            </button>
                          ))}
                          {items.length > 5 && (
                            <button
                              onClick={() => navigate("/pipeline")}
                              className="w-full rounded-2xl border border-dashed border-black/10 p-2 text-center text-xs text-black/50 hover:bg-black/5 dark:border-white/10 dark:text-white/50 dark:hover:bg-white/5"
                            >
                              +{items.length - 5} more · View full pipeline
                            </button>
                          )}
                          {items.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-black/10 p-3 text-center text-xs text-black/45 dark:border-white/10 dark:text-white/45">
                              No quotes
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 text-center">
                  <button
                    onClick={() => navigate("/pipeline")}
                    className="text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    data-testid="link-view-full-pipeline-workspace"
                  >
                    View full pipeline →
                  </button>
                </div>
              </TabsContent>

              <TabsContent value="calendar" className="mt-0">
                <div className="space-y-3" data-testid="panel-social-posts">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="inline-flex items-center gap-1 rounded-2xl border border-black/10 bg-black/5 p-1 dark:border-white/10 dark:bg-white/5" data-testid="group-social-filters-2">
                      {(["today", "tomorrow", "date"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setSocialFilter(f)}
                          className={
                            "rounded-xl px-3 py-1.5 text-xs font-semibold transition " +
                            (socialFilter === f
                              ? "bg-[#3b82f6] text-white"
                              : "text-black/70 hover:bg-black/5 dark:text-white/75 dark:hover:bg-white/10")
                          }
                          data-testid={`filter-social-2-${f}`}
                        >
                          {f === "date" ? "Date selection" : f.charAt(0).toUpperCase() + f.slice(1)}
                        </button>
                      ))}
                    </div>

                    <div className={(socialFilter === "date" ? "flex" : "hidden") + " items-center gap-2"} data-testid="wrap-social-date-2">
                      <DatePicker
                        value={socialDate}
                        onChange={(v) => setSocialDate(v)}
                        placeholder="Pick a date"
                        data-testid="input-social-date-2"
                      />
                      <span className="text-xs text-black/45 dark:text-white/45">
                        Showing: {socialDate}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-black/50 dark:text-white/50">
                    {filteredOverviewSocialPosts.length} {filteredOverviewSocialPosts.length === 1 ? "post" : "posts"} found
                  </p>

                  {filteredOverviewSocialPosts.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-black/10 dark:border-white/10 p-8 text-center">
                      <CalendarClock className="w-10 h-10 mx-auto text-black/15 dark:text-white/15 mb-2" />
                      <p className="text-sm text-black/50 dark:text-white/50">No posts for this filter</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      <AnimatePresence mode="popLayout">
                        {filteredOverviewSocialPosts.slice(0, 6).map(({ quote, clientId }) => {
                          const imageUrl = spGetFirstImage(quote);
                          const tourOp = quote.main_tour_operator_name;
                          const pricePerPerson = quote.price_per_person
                            ? `${spFormatPrice(quote.price_per_person)}pp`
                            : spFormatPrice(quote.sales_price);
                          return (
                            <motion.div
                              key={quote.id}
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -12 }}
                              className="glass ringed grain rounded-2xl overflow-hidden flex flex-col"
                              data-testid={`card-social-post-2-${quote.id}`}
                            >
                              <div className="relative h-52 bg-gradient-to-br from-blue-100 to-blue-50 dark:from-blue-950 dark:to-slate-900 overflow-hidden">
                                <img
                                  src={imageUrl || "/images/default-hotel.jpg"}
                                  alt={quote.title || "Deal image"}
                                  className="w-full h-full object-cover"
                                />
                                {tourOp && (
                                  <Badge className="absolute top-3 left-3 bg-orange-500 text-white border-0 shadow-lg text-xs font-semibold px-3 py-1 rounded-full">
                                    {tourOp}
                                  </Badge>
                                )}
                              </div>

                              <div className="p-4 pb-5 flex-1 flex flex-col gap-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-bold text-black/90 dark:text-white/90 truncate">
                                      Title: <span className="font-semibold">{quote.title || "Untitled"}</span>
                                    </h3>
                                    <p className="text-xs text-black/55 dark:text-white/55 mt-0.5 truncate">
                                      Sub: {spGetSubtitle(quote)}
                                    </p>
                                  </div>
                                  <Badge className="shrink-0 bg-blue-500 text-white border-0 text-xs font-bold px-3 py-1.5 rounded-lg shadow">
                                    {pricePerPerson}
                                  </Badge>
                                </div>

                                <div className="space-y-1.5 text-xs">
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Hotel className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Hotel:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate">{spGetHotelName(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Plane className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Departing:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate">{spGetDepartingAirport(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Moon className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Nights:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90">{quote.num_of_nights}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <UtensilsCrossed className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Board:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90 truncate">{spGetBoardBasis(quote)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <Calendar className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90">{spFormatDate(quote.travel_date)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-black/70 dark:text-white/70">
                                    <CalendarClock className="w-3.5 h-3.5 shrink-0 text-black/40 dark:text-white/40" />
                                    <span>Date Created:</span>
                                    <span className="font-semibold text-black/90 dark:text-white/90">{spFormatDate(quote.date_created)}</span>
                                  </div>
                                </div>

                                <div className="mt-auto pt-3 pb-1 border-t border-black/8 dark:border-white/8 flex flex-col gap-3">
                                  <Link href={`/clients/${clientId}/quotes/${quote.id}`}>
                                    <Button variant="outline" className="w-full rounded-xl text-sm font-medium gap-2">
                                      <Eye className="w-4 h-4" />
                                      View Quote
                                    </Button>
                                  </Link>
                                  <Button className="w-full rounded-xl text-sm font-medium gap-2 bg-blue-500 hover:bg-blue-600 text-white">
                                    <CalendarClock className="w-4 h-4" />
                                    Schedule Post
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}

                  {filteredOverviewSocialPosts.length > 6 && (
                    <div className="text-center pt-2">
                      <Link href="/social-posts">
                        <Button variant="outline" size="sm" className="rounded-xl text-xs">
                          View all {filteredOverviewSocialPosts.length} posts →
                        </Button>
                      </Link>
                    </div>
                  )}
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
                  onClick={() => setShowAddTaskDialog(true)}
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

    if (active === "opportunities") {
      const enquiryStatuses = ["all", "NEW_LEAD", "ACTIVE", "LOST", "INACTIVE", "EXPIRED"];
      const quoteStatuses = ["all", "NEW_LEAD", "QUOTE_IN_PROGRESS", "QUOTE_CALL", "QUOTE_READY", "AWAITING_DECISION", "REQUOTE", "WON", "ARCHIVED", "LOST", "INACTIVE", "EXPIRED"];
      const bookingStatuses = ["all", "BOOKED", "LOST"];
      const statusOptions = opportunitiesTab === "enquiries" ? enquiryStatuses : opportunitiesTab === "quotes" ? quoteStatuses : bookingStatuses;
      const formatStatus = (s: string) => s === "all" ? "All Statuses" : s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIn\b/, "in");
      const statusBadgeClass = (s: string) => {
        switch (s) {
          case "QUOTE_IN_PROGRESS": return "bg-[#3b82f6]/10 text-[#3b82f6] border-[#3b82f6]/20";
          case "NEW_LEAD": return "bg-violet-500/10 text-violet-600 border-violet-500/20";
          case "QUOTE_CALL": return "bg-sky-500/10 text-sky-600 border-sky-500/20";
          case "QUOTE_READY": return "bg-teal-500/10 text-teal-600 border-teal-500/20";
          case "AWAITING_DECISION": return "bg-amber-500/10 text-amber-600 border-amber-500/20";
          case "REQUOTE": return "bg-orange-500/10 text-orange-600 border-orange-500/20";
          case "WON": case "BOOKED": return "bg-emerald-500/10 text-emerald-600 border-emerald-500/20";
          case "LOST": return "bg-red-500/10 text-red-600 border-red-500/20";
          case "ARCHIVED": case "INACTIVE": case "EXPIRED": return "bg-gray-500/10 text-gray-500 border-gray-500/20";
          case "ACTIVE": return "bg-blue-500/10 text-blue-600 border-blue-500/20";
          default: return "";
        }
      };
      const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" }) : "—";
      return (
        <section data-testid="section-opportunities">
          <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
              <div className="space-y-1">
                <div className="text-sm font-medium">Opportunities</div>
                <div className="text-xs text-muted-foreground">View and manage all enquiries, quotes, and bookings.</div>
              </div>
            </div>

            <Tabs value={opportunitiesTab} onValueChange={(v) => { setOpportunitiesTab(v as any); setOpportunitiesStatusFilter("all"); setOpportunitiesSearch(""); setOpportunitiesAgentFilter("all"); setOpportunitiesPage(1); }}>
              <div className="flex items-center gap-3 mb-3">
                <TabsList className="rounded-2xl bg-black/5 dark:bg-white/5" data-testid="tabs-opportunities">
                  <TabsTrigger value="enquiries" className="rounded-xl gap-1.5" data-testid="tab-opportunities-enquiries">
                    <ClipboardList className="h-3.5 w-3.5" /> Enquiries
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="rounded-xl gap-1.5" data-testid="tab-opportunities-quotes">
                    <Sparkles className="h-3.5 w-3.5" /> Quotes
                  </TabsTrigger>
                  <TabsTrigger value="bookings" className="rounded-xl gap-1.5" data-testid="tab-opportunities-bookings">
                    <Ticket className="h-3.5 w-3.5" /> Bookings
                  </TabsTrigger>
                </TabsList>

                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-black/40 dark:text-white/40" />
                  <Input
                    value={opportunitiesSearch}
                    onChange={(e) => setOpportunitiesSearch(e.target.value)}
                    placeholder="Search client or title..."
                    className="h-8 pl-8 pr-3 text-xs rounded-xl w-56 bg-black/5 border-0 dark:bg-white/5"
                    data-testid="input-opportunities-search"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-1 mr-1">
                  <Calendar className="h-3 w-3 text-black/40 dark:text-white/40" />
                  <span className="text-[10px] font-semibold text-black/40 dark:text-white/40 uppercase tracking-wider">Period</span>
                </div>
                {([["this-month", "This Month"], ["last-month", "Last Month"], ["this-week", "This Week"], ["last-7", "Last 7 Days"], ["last-30", "Last 30 Days"], ["last-90", "Last 90 Days"], ["this-year", "This Year"], ["all-time", "All Time"]] as const).map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setOpportunitiesDateRange(val)}
                    className={`rounded-xl px-2.5 py-1 text-[10px] font-medium transition ${opportunitiesDateRange === val ? "bg-black text-white dark:bg-white dark:text-black" : "bg-black/5 text-black/60 hover:bg-black/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"}`}
                    data-testid={`button-opportunities-date-${val}`}
                  >
                    {label}
                  </button>
                ))}

                <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-1" />

                <select
                  value={opportunitiesStatusFilter}
                  onChange={(e) => setOpportunitiesStatusFilter(e.target.value)}
                  className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
                  data-testid="select-opportunities-status"
                >
                  {statusOptions.map((s) => <option key={s} value={s}>{formatStatus(s)}</option>)}
                </select>

                {opportunitiesAgentList.length > 1 && (
                  <select
                    value={opportunitiesAgentFilter}
                    onChange={(e) => setOpportunitiesAgentFilter(e.target.value)}
                    className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
                    data-testid="select-opportunities-agent"
                  >
                    <option value="all">All Agents</option>
                    {opportunitiesAgentList.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}

                <select
                  value={opportunitiesSortBy}
                  onChange={(e) => setOpportunitiesSortBy(e.target.value as any)}
                  className="h-7 rounded-xl border-0 bg-black/5 px-2 text-[11px] dark:bg-white/5 focus:ring-1 focus:ring-black/20"
                  data-testid="select-opportunities-sort"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="price-low">Price: Low to High</option>
                </select>

                <div className="ml-auto text-[10px] text-black/40 dark:text-white/40 tabular-nums">
                  {opportunitiesLoading ? "Loading..." : `${opportunitiesTotal} result${opportunitiesTotal !== 1 ? "s" : ""}`}
                </div>
              </div>

              <TabsContent value="enquiries" className="mt-0">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1.5fr_1fr_.8fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">
                    <div>Client</div><div>Title</div><div>Status</div><div>Travel Date</div><div>Guests</div><div>Budget</div><div>Created</div>
                  </div>
                  {filteredOpportunities.length > 0 ? (
                    <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
                      {filteredOpportunities.map((item: any) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1.5fr_1fr_.8fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer items-center"
                          onClick={() => item.clientId && navigate(`/clients/${item.clientId}`)}
                          data-testid={`row-opportunity-enquiry-${item.id}`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{item.clientName}</div>
                            {item.clientPhone && <div className="truncate text-[10px] text-black/40 dark:text-white/40 flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{item.clientPhone}</div>}
                          </div>
                          <div className="truncate text-xs">{item.title}</div>
                          <div><Badge variant="outline" className={`text-[10px] px-1.5 py-0 rounded-lg ${statusBadgeClass(item.status)}`}>{formatStatus(item.status)}</Badge></div>
                          <div className="text-xs tabular-nums">{formatDate(item.travelDate)}</div>
                          <div className="text-xs tabular-nums">{item.adults}A {item.children > 0 ? `${item.children}C` : ""}</div>
                          <div className="text-xs tabular-nums font-medium">{item.budget > 0 ? currency.format(item.budget) : "—"}</div>
                          <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">{formatDate(item.dateCreated)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">No enquiries found.</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="quotes" className="mt-0">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1.3fr_1fr_.8fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">
                    <div>Client</div><div>Title</div><div>Status</div><div>Travel Date</div><div>Guests</div><div>Price</div><div>Commission</div><div>Created</div>
                  </div>
                  {filteredOpportunities.length > 0 ? (
                    <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
                      {filteredOpportunities.map((item: any) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1.3fr_1fr_.8fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer items-center"
                          onClick={() => navigate(`/clients/${item.clientId || "_"}/quotes/${item.id}`)}
                          data-testid={`row-opportunity-quote-${item.id}`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{item.clientName}</div>
                            {item.agentName && <div className="truncate text-[10px] text-black/40 dark:text-white/40">{item.agentName}</div>}
                          </div>
                          <div className="truncate text-xs">{item.title}</div>
                          <div><Badge variant="outline" className={`text-[10px] px-1.5 py-0 rounded-lg ${statusBadgeClass(item.status)}`}>{formatStatus(item.status)}</Badge></div>
                          <div className="text-xs tabular-nums">{formatDate(item.travelDate)}</div>
                          <div className="text-xs tabular-nums">{item.adults}A {item.children > 0 ? `${item.children}C` : ""}</div>
                          <div className="text-xs tabular-nums font-medium">{item.salesPrice > 0 ? currency.format(item.salesPrice) : "—"}</div>
                          <div className="text-xs tabular-nums text-emerald-600">{item.commission > 0 ? currency.format(item.commission) : "—"}</div>
                          <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">{formatDate(item.dateCreated)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">No quotes found.</div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="bookings" className="mt-0">
                <div className="rounded-2xl border border-black/10 dark:border-white/10 overflow-hidden">
                  <div className="grid grid-cols-[1.2fr_1fr_.7fr_.6fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 bg-black/[0.03] dark:bg-white/[0.03] text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wider">
                    <div>Client</div><div>Title</div><div>Status</div><div>Travel Date</div><div>Guests</div><div>Price</div><div>Commission</div><div>Refs</div><div>Created</div>
                  </div>
                  {filteredOpportunities.length > 0 ? (
                    <div className="divide-y divide-black/5 dark:divide-white/5 max-h-[60vh] overflow-y-auto">
                      {filteredOpportunities.map((item: any) => (
                        <div
                          key={item.id}
                          className="grid grid-cols-[1.2fr_1fr_.7fr_.6fr_.6fr_.6fr_.6fr_.6fr_.5fr] gap-2 px-4 py-2.5 hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition cursor-pointer items-center"
                          onClick={() => item.clientId && navigate(`/clients/${item.clientId}`)}
                          data-testid={`row-opportunity-booking-${item.id}`}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-xs font-medium">{item.clientName}</div>
                            {item.agentName && <div className="truncate text-[10px] text-black/40 dark:text-white/40">{item.agentName}</div>}
                          </div>
                          <div className="truncate text-xs">{item.title}</div>
                          <div><Badge variant="outline" className={`text-[10px] px-1.5 py-0 rounded-lg ${statusBadgeClass(item.status)}`}>{formatStatus(item.status)}</Badge></div>
                          <div className="text-xs tabular-nums">{formatDate(item.travelDate)}</div>
                          <div className="text-xs tabular-nums">{item.adults}A {item.children > 0 ? `${item.children}C` : ""}</div>
                          <div className="text-xs tabular-nums font-medium">{item.salesPrice > 0 ? currency.format(item.salesPrice) : "—"}</div>
                          <div className="text-xs tabular-nums text-emerald-600">{item.commission > 0 ? currency.format(item.commission) : "—"}</div>
                          <div className="min-w-0">
                            {item.haysRef && <div className="truncate text-[10px]">{item.haysRef}</div>}
                            {item.supplierRef && <div className="truncate text-[10px] text-black/40 dark:text-white/40">{item.supplierRef}</div>}
                          </div>
                          <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">{formatDate(item.dateCreated)}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-4 py-8 text-center text-xs text-black/40 dark:text-white/40">No bookings found.</div>
                  )}
                </div>
              </TabsContent>

              {opportunitiesTotalPages > 1 && (
                <div className="flex items-center justify-between mt-3 px-1">
                  <div className="text-[10px] text-black/40 dark:text-white/40 tabular-nums">
                    Page {opportunitiesPage} of {opportunitiesTotalPages}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={opportunitiesPage <= 1}
                      onClick={() => setOpportunitiesPage(1)}
                      className="rounded-lg px-2 py-1 text-[10px] font-medium bg-black/5 dark:bg-white/5 disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition"
                      data-testid="button-opportunities-first"
                    >First</button>
                    <button
                      disabled={opportunitiesPage <= 1}
                      onClick={() => setOpportunitiesPage((p) => Math.max(1, p - 1))}
                      className="rounded-lg px-2 py-1 text-[10px] font-medium bg-black/5 dark:bg-white/5 disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition"
                      data-testid="button-opportunities-prev"
                    >Prev</button>
                    <button
                      disabled={opportunitiesPage >= opportunitiesTotalPages}
                      onClick={() => setOpportunitiesPage((p) => Math.min(opportunitiesTotalPages, p + 1))}
                      className="rounded-lg px-2 py-1 text-[10px] font-medium bg-black/5 dark:bg-white/5 disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition"
                      data-testid="button-opportunities-next"
                    >Next</button>
                    <button
                      disabled={opportunitiesPage >= opportunitiesTotalPages}
                      onClick={() => setOpportunitiesPage(opportunitiesTotalPages)}
                      className="rounded-lg px-2 py-1 text-[10px] font-medium bg-black/5 dark:bg-white/5 disabled:opacity-30 hover:bg-black/10 dark:hover:bg-white/10 transition"
                      data-testid="button-opportunities-last"
                    >Last</button>
                  </div>
                </div>
              )}
            </Tabs>
          </Card>
        </section>
      );
    }

    if (active === "agent-settings") {
      const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadingAvatar(true);
        try {
          await authApi.uploadAvatar(file);
          queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
          toast({ title: "Avatar updated successfully" });
        } catch (err: any) {
          toast({ title: "Failed to upload avatar", description: err?.response?.data?.message || err.message, variant: "destructive" });
        } finally {
          setUploadingAvatar(false);
          if (avatarInputRef.current) avatarInputRef.current.value = "";
        }
      };

      const handleSaveProfile = async () => {
        setSavingProfile(true);
        try {
          await authApi.updateProfile({ phoneNumber: settingsPhone, email: settingsEmail });
          queryClient.invalidateQueries({ queryKey: authKeys.currentUser() });
          toast({ title: "Profile updated successfully" });
        } catch (err: any) {
          toast({ title: "Failed to update profile", description: err?.response?.data?.message || err.message, variant: "destructive" });
        } finally {
          setSavingProfile(false);
        }
      };

      const handleChangePassword = async () => {
        if (!oldPassword || !newPassword || !confirmPassword) {
          toast({ title: "All password fields are required", variant: "destructive" });
          return;
        }
        if (newPassword !== confirmPassword) {
          toast({ title: "New passwords do not match", variant: "destructive" });
          return;
        }
        if (newPassword.length < 6) {
          toast({ title: "New password must be at least 6 characters", variant: "destructive" });
          return;
        }
        setChangingPassword(true);
        try {
          await authApi.changePassword(oldPassword, newPassword, confirmPassword);
          toast({ title: "Password changed successfully" });
          setOldPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setShowPasswordForm(false);
        } catch (err: any) {
          toast({ title: "Failed to change password", description: err?.response?.data?.message || err.message, variant: "destructive" });
        } finally {
          setChangingPassword(false);
        }
      };

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
                      <div className="relative">
                        {(user?.image || user?.avatar) ? (
                          <img src={user?.image || user?.avatar || ""} alt="" className="h-12 w-12 rounded-2xl object-cover" data-testid="img-avatar" />
                        ) : (
                          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-lg font-medium" data-testid="img-avatar-placeholder">
                            {displayName?.charAt(0).toUpperCase() || "U"}
                          </div>
                        )}
                        {uploadingAvatar && (
                          <div className="absolute inset-0 rounded-2xl bg-black/50 flex items-center justify-center">
                            <Spinner className="h-5 w-5 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium">Avatar</div>
                        <div className="text-xs text-black/55 dark:text-white/55">Update your profile picture</div>
                      </div>
                    </div>
                    <div>
                      <input
                        ref={avatarInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        data-testid="input-avatar-file"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploadingAvatar}
                        onClick={() => avatarInputRef.current?.click()}
                        className="rounded-xl border-black/10 bg-black/5 text-black hover:bg-black/7 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        data-testid="button-change-avatar"
                      >
                        <Camera className="mr-2 h-4 w-4" />
                        {uploadingAvatar ? "Uploading..." : "Change"}
                      </Button>
                    </div>
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
                      value={settingsEmail}
                      onChange={(e) => setSettingsEmail(e.target.value)}
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
                      value={settingsPhone}
                      onChange={(e) => setSettingsPhone(e.target.value)}
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
                  onClick={handleSaveProfile}
                  disabled={savingProfile}
                  className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 gap-2"
                  data-testid="button-save-settings"
                >
                  {savingProfile ? <Spinner className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {savingProfile ? "Saving..." : "Save Changes"}
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
                  onClick={() => setShowPasswordForm(!showPasswordForm)}
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
                  <ChevronDown className={`h-4 w-4 text-black/40 dark:text-white/45 transition-transform ${showPasswordForm ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence>
                  {showPasswordForm && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-4 dark:border-white/10 dark:bg-white/5 space-y-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-black/60 dark:text-white/60 flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            Current Password
                          </label>
                          <Input
                            type="password"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="h-10 rounded-xl border-black/10 bg-white/50 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-black/20 dark:text-white"
                            data-testid="input-old-password"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-black/60 dark:text-white/60 flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            New Password
                          </label>
                          <Input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password (min 6 characters)"
                            className="h-10 rounded-xl border-black/10 bg-white/50 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-black/20 dark:text-white"
                            data-testid="input-new-password"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-black/60 dark:text-white/60 flex items-center gap-1.5">
                            <Lock className="h-3.5 w-3.5" />
                            Confirm New Password
                          </label>
                          <Input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Confirm new password"
                            className="h-10 rounded-xl border-black/10 bg-white/50 text-black placeholder:text-black/45 dark:border-white/10 dark:bg-black/20 dark:text-white"
                            data-testid="input-confirm-password"
                          />
                        </div>
                        {newPassword && confirmPassword && newPassword !== confirmPassword && (
                          <p className="text-xs text-red-500">Passwords do not match</p>
                        )}
                        <div className="flex justify-end pt-1">
                          <Button
                            onClick={handleChangePassword}
                            disabled={changingPassword || !oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                            className="h-9 rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90 text-sm gap-2"
                            data-testid="button-submit-password"
                          >
                            {changingPassword ? <Spinner className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                            {changingPassword ? "Changing..." : "Update Password"}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

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
                className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
                  className="h-10 rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
                        onChange={(e) => updateUserMutation.mutate({ id: u.id, data: { role: e.target.value } })}
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
                    className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
            const stripQuotes = (s: string) => s.trim().replace(/^["']|["']$/g, "");
            const headers = lines[0].split(",").map(h => stripQuotes(h).toLowerCase());
            for (let i = 1; i < lines.length; i++) {
              const values = lines[i].split(",").map(v => stripQuotes(v));
              const row: Record<string, string> = {};
              headers.forEach((h, idx) => { row[h] = values[idx] || ""; });
              createAirportMutation.mutate({
                airport_name: row.airport_name || row["airport_name"] || row.name || row["airport name"] || "",
                airport_code: row.airport_code || row["airport_code"] || row.code || row["airport code"] || row.iata || "",
                country_id: row.country_id || row["country_id"] || row.country || "",
              });
            }
          };
          reader.readAsText(file);
          e.target.value = "";
        };

        const filteredAirports = (airportsList || []).filter((airport) => {
          const q = airportSearch.trim().toLowerCase();
          if (!q) return true;
          const countryName = countryMap[airport.country_id] || airport.country_id;
          return (
            airport.airport_name.toLowerCase().includes(q) ||
            airport.airport_code.toLowerCase().includes(q) ||
            countryName.toLowerCase().includes(q)
          );
        });

        return (
          <section>
            <Card className="glass ringed grain rounded-3xl p-4 md:p-5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div className="space-y-1">
                  <div className="text-sm font-semibold" data-testid="text-airports-title">Airports</div>
                  <div className="text-xs text-muted-foreground">
                    {airportSearch ? `Showing ${filteredAirports.length} of ${airportsList?.length || 0} airports` : "Manage airports for quotes and bookings."}
                  </div>
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
                      const airport_name = prompt("Enter airport name:");
                      if (!airport_name) return;
                      const airport_code = prompt("Airport code (e.g. LHR, JFK):") || "";
                      const country_id = prompt("Country ID:") || "";
                      createAirportMutation.mutate({ airport_name, airport_code, country_id });
                    }}
                    className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                    data-testid="button-add-airport"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Airport
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white/80 dark:bg-black/80 backdrop-blur-sm">
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
                        <td className="py-3 px-2 font-medium">{airport.airport_name}</td>
                        <td className="py-3 px-2 font-mono">{airport.airport_code}</td>
                        <td className="py-3 px-2">{countryMap[airport.country_id] || airport.country_id}</td>
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

      if (active === "settings" || active === "admin-settings-page") {
        return (
          <section className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setSettingsTab("general")}
                className={`rounded-2xl px-4 py-2 text-sm font-medium transition ${
                  settingsTab === "general"
                    ? "bg-[#3b82f6] text-white"
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
                    ? "bg-[#3b82f6] text-white"
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
                    className="rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
                    className="w-full rounded-2xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
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
  }, [active, clients, role, tab, theme, setTheme, user, displayName, rolePreview, setRolePreview, actualRole, airportSearch, tourOperatorSearch, airportsList, tourOperators, countryMap, opportunitiesTab, filteredOpportunities, opportunitiesTotal, opportunitiesTotalPages, opportunitiesPage, opportunitiesLoading, opportunitiesSearch, opportunitiesDateRange, opportunitiesStatusFilter, opportunitiesAgentFilter, opportunitiesSortBy, opportunitiesAgentList]);

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
                userAvatar={user?.image || user?.avatar || user?.profileImageUrl}
                onLogout={() => window.location.href = "/api/logout"}
                actualRole={actualRole}
                rolePreview={rolePreview}
                onRoleChange={setRolePreview}
                clients={clients}
              />

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

      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />

      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl" data-testid="dialog-add-task-dashboard">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Add Task</DialogTitle>
            <DialogDescription className="text-xs text-black/55">
              Set a task with a due date and time.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Category</Label>
              <Select value={dashTaskCategory} onValueChange={(v) => { setDashTaskCategory(v); setDashNewTitle(""); }}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-dash-task-category">
                  <SelectValue placeholder="Choose a category…" />
                </SelectTrigger>
                <SelectContent>
                  {TASK_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Task</Label>
              <Select value={dashNewTitle} onValueChange={setDashNewTitle}>
                <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="select-dash-task-title">
                  <SelectValue placeholder="Choose a task…" />
                </SelectTrigger>
                <SelectContent>
                  {dashTaskPresets.map((preset) => (
                    <SelectItem key={preset} value={preset}>{preset}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Date</Label>
                <DatePicker
                  value={dashNewDueDate}
                  onChange={(v) => setDashNewDueDate(v)}
                  placeholder="Pick a date"
                  data-testid="input-dash-task-due-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Due Time</Label>
                <Input
                  type="time"
                  value={dashNewDueTime}
                  onChange={(e) => setDashNewDueTime(e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="input-dash-task-due-time"
                />
              </div>
            </div>

            <Button
              className="h-9 w-full rounded-xl bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
              data-testid="button-confirm-dash-add-task"
              onClick={handleDashAddTask}
              disabled={!dashNewTitle || !dashNewDueDate || dashCreateTaskMutation.isPending}
            >
              {dashCreateTaskMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Add Task"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <NotificationToast />
    </div>
  );
}
