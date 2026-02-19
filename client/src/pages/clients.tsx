import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import CsvImportDialog from "@/components/csv-import-dialog";
import {
  useNeonClients,
  useClientKPIs,
  useRebookingDashboard,
  useVIPDashboard,
  useBehaviourDashboard,
  useClientDashboardList,
} from "@/hooks/queries";
import {
  Activity,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Crown,
  Eye,
  FileText,
  Filter,
  Flame,
  Grid3X3,
  List,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Plane,
  Plus,
  Search,
  Send,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Upload,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RebookingClient, VIPClient } from "@/types/dashboard";

type ClientTier = "Platinum" | "Gold" | "Standard";
type Stage = "Enquiry" | "Quote" | "Booked";

type ClientDisplay = {
  id: string;
  name: string;
  tier: ClientTier;
  stage: Stage;
  location: string;
  nextTrip: string;
  value: number;
  lastTouch: string;
  email: string;
  phone: string;
  tags: string[];
};

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function shortInitials(name: string) {
  const parts = name.split(" ").map((p) => p.trim()).filter(Boolean);
  const a = parts[0]?.[0] ?? "C";
  const b = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (a + b).toUpperCase();
}

function parseLastTouch(v: string): number {
  if (!v) return 999;
  const lower = v.toLowerCase().trim();
  if (lower === "today") return 0;
  if (lower === "yesterday") return 1;
  const daysMatch = lower.match(/(\d+)\s*d/i);
  if (daysMatch) return parseInt(daysMatch[1]!, 10) + 1;
  const weeksMatch = lower.match(/(\d+)\s*week/i);
  if (weeksMatch) return parseInt(weeksMatch[1]!, 10) * 7;
  const monthsMatch = lower.match(/(\d+)\s*month/i);
  if (monthsMatch) return parseInt(monthsMatch[1]!, 10) * 30;
  return 99;
}

const tierColors = {
  Platinum: { bg: "bg-violet-500", light: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", border: "border-violet-200 dark:border-violet-700" },
  Gold: { bg: "bg-amber-500", light: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-700" },
  Standard: { bg: "bg-slate-400", light: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700" },
};

const stageColors = {
  Enquiry: { bg: "bg-fuchsia-500", dot: "bg-fuchsia-400", pill: "bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300" },
  Quote: { bg: "bg-sky-500", dot: "bg-sky-400", pill: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  Booked: { bg: "bg-emerald-500", dot: "bg-emerald-400", pill: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};

function KPICard({ label, value, icon: Icon, suffix, prefix }: { label: string; value: number | string; icon: any; suffix?: string; prefix?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="relative overflow-hidden bg-white/60 dark:bg-white/[0.04] backdrop-blur-xl border border-black/[0.06] dark:border-white/[0.06] rounded-2xl p-5 hover:shadow-lg transition-all duration-300">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide" data-testid={`kpi-label-${label.toLowerCase().replace(/\s+/g, '-')}`}>{label}</p>
            <p className="text-2xl font-bold text-black/90 dark:text-white/90" data-testid={`kpi-value-${label.toLowerCase().replace(/\s+/g, '-')}`}>
              {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center">
            <Icon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function HeatmapRow({ data, label }: { data: { month: number; count: number }[]; label: string }) {
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const fullMonths = Array.from({ length: 12 }, (_, i) => {
    const match = data.find(d => d.month === i + 1);
    return { month: i + 1, count: match?.count || 0 };
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">{label}</p>
      <div className="grid grid-cols-12 gap-1.5">
        {fullMonths.map(({ month, count }) => {
          const intensity = count / maxCount;
          return (
            <div key={month} className="text-center">
              <div
                className="h-8 rounded-lg flex items-center justify-center text-[10px] font-semibold transition-colors"
                style={{
                  backgroundColor: intensity > 0
                    ? `rgba(59, 130, 246, ${0.15 + intensity * 0.7})`
                    : "rgba(0,0,0,0.03)",
                  color: intensity > 0.4 ? "white" : intensity > 0 ? "rgb(59, 130, 246)" : "rgba(0,0,0,0.2)",
                }}
                data-testid={`heatmap-${label.toLowerCase().replace(/\s+/g, '-')}-${month}`}
                title={`${monthNames[month - 1]}: ${count}`}
              >
                {count > 0 ? count : ""}
              </div>
              <span className="text-[9px] text-black/40 dark:text-white/40 mt-0.5 block">{monthNames[month - 1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BarList({ items, label }: { items: { name: string; count: number }[]; label: string }) {
  const maxCount = Math.max(...items.map(i => i.count), 1);
  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">{label}</p>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3" data-testid={`bar-${label.toLowerCase().replace(/\s+/g, '-')}-${i}`}>
            <span className="text-xs text-black/70 dark:text-white/70 w-32 truncate font-medium">{item.name}</span>
            <div className="flex-1 h-6 bg-black/[0.03] dark:bg-white/[0.03] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-end pr-2 transition-all duration-500"
                style={{ width: `${Math.max((item.count / maxCount) * 100, 8)}%` }}
              >
                <span className="text-[10px] font-bold text-white">{item.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RebookingClientCard({ client }: { client: RebookingClient }) {
  const segmentStyles = {
    hot: { bg: "bg-red-500/10 border-red-500/20", text: "text-red-600 dark:text-red-400", badge: "bg-red-500" },
    warm: { bg: "bg-amber-500/10 border-amber-500/20", text: "text-amber-600 dark:text-amber-400", badge: "bg-amber-500" },
    cold: { bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-600 dark:text-blue-400", badge: "bg-blue-500" },
  };
  const s = segmentStyles[client.segment];

  return (
    <div className={`rounded-xl border p-4 ${s.bg} transition-all hover:shadow-md`} data-testid={`rebooking-client-${client.clientId}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <p className="font-semibold text-sm text-black/90 dark:text-white/90">{client.clientName}</p>
          <p className="text-xs text-black/50 dark:text-white/50">{client.totalBookings} booking{client.totalBookings !== 1 ? "s" : ""}</p>
        </div>
        <span className="text-sm font-bold text-black/80 dark:text-white/80">{currency.format(client.lifetimeValue)}</span>
      </div>
      <div className="flex items-center gap-3 text-xs text-black/50 dark:text-white/50">
        {client.daysSinceLastBooking !== null && (
          <span>{client.daysSinceLastBooking}d since last booking</span>
        )}
        {client.avgBookingCycleDays !== null && (
          <span>~{client.avgBookingCycleDays}d cycle</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <Link href={`/clients/${client.clientId}`}>
          <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1" data-testid={`button-view-rebooking-${client.clientId}`}>
            <Eye className="w-3 h-3" /> View
          </Button>
        </Link>
        <Button size="sm" variant="outline" className="h-7 text-xs rounded-lg gap-1" data-testid={`button-call-rebooking-${client.clientId}`}>
          <Phone className="w-3 h-3" /> Call
        </Button>
      </div>
    </div>
  );
}

function VIPTable({ clients, metric }: { clients: VIPClient[]; metric: "lifetimeValue" | "totalBookings" | "referralCount" }) {
  const metricLabels = {
    lifetimeValue: "Lifetime Value",
    totalBookings: "Total Bookings",
    referralCount: "Referrals",
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" data-testid={`vip-table-${metric}`}>
        <thead>
          <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
            <th className="text-left text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide py-2 pr-4">#</th>
            <th className="text-left text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide py-2 pr-4">Client</th>
            <th className="text-right text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide py-2 pr-4">{metricLabels[metric]}</th>
            <th className="text-right text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide py-2 pr-4">Avg Booking</th>
            <th className="text-right text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide py-2">Bookings</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((c, i) => (
            <tr key={c.clientId} className="border-b border-black/[0.03] dark:border-white/[0.03] hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
              <td className="py-2.5 pr-4">
                <span className={`w-6 h-6 rounded-full inline-flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-amber-500/15 text-amber-600" : "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40"}`}>
                  {i + 1}
                </span>
              </td>
              <td className="py-2.5 pr-4">
                <Link href={`/clients/${c.clientId}`}>
                  <span className="font-medium text-black/90 dark:text-white/90 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors" data-testid={`vip-name-${c.clientId}`}>
                    {c.clientName}
                  </span>
                </Link>
              </td>
              <td className="py-2.5 pr-4 text-right font-semibold text-black/80 dark:text-white/80">
                {metric === "lifetimeValue" ? currency.format(c.lifetimeValue) : metric === "totalBookings" ? c.totalBookings : c.referralCount}
              </td>
              <td className="py-2.5 pr-4 text-right text-black/60 dark:text-white/60">{currency.format(c.avgBookingValue)}</td>
              <td className="py-2.5 text-right text-black/60 dark:text-white/60">{c.totalBookings}</td>
            </tr>
          ))}
          {clients.length === 0 && (
            <tr><td colSpan={5} className="py-8 text-center text-black/40 dark:text-white/40 text-sm">No data available</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LeadTimeTrendChart({ data }: { data: { month: string; avgDays: number }[] }) {
  if (!data.length) return <p className="text-sm text-black/40 dark:text-white/40">No lead time data available</p>;
  const maxDays = Math.max(...data.map(d => d.avgDays), 1);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-black/50 dark:text-white/50 uppercase tracking-wide">Avg Lead Time Trend (days)</p>
      <div className="flex items-end gap-2 h-32">
        {data.map((d) => {
          const height = Math.max((d.avgDays / maxDays) * 100, 4);
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-semibold text-black/60 dark:text-white/60">{d.avgDays}d</span>
              <div
                className="w-full bg-gradient-to-t from-indigo-500 to-blue-400 rounded-t-lg transition-all duration-500"
                style={{ height: `${height}%` }}
                data-testid={`lead-trend-${d.month}`}
              />
              <span className="text-[9px] text-black/40 dark:text-white/40 truncate w-full text-center">
                {d.month.slice(5)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type TabId = "list" | "rebooking" | "vip" | "behaviour";

export default function ClientsPage() {
  const [, navigate] = useLocation();
  const { role, setRole } = useRole();
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [q, setQ] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [tier, setTier] = useState<"all" | ClientTier>("all");
  const [sort, setSort] = useState<"value" | "lastTouch" | "name">("value");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [rebookingTab, setRebookingTab] = useState<"hot" | "warm" | "cold">("hot");
  const [vipTab, setVipTab] = useState<"byLifetimeValue" | "byBookings" | "byReferrals">("byLifetimeValue");

  const searchTimeoutRef = useMemo(() => ({ current: null as ReturnType<typeof setTimeout> | null }), []);

  const handleSearch = (val: string) => {
    setQ(val);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchDebounced(val);
      setPage(1);
    }, 300);
  };

  const { data: paginatedData, isLoading } = useNeonClients({
    page,
    limit: 10,
    search: searchDebounced || undefined,
  });

  const { data: kpis, isLoading: kpisLoading } = useClientKPIs();
  const { data: rebooking, isLoading: rebookingLoading } = useRebookingDashboard();
  const { data: vip, isLoading: vipLoading } = useVIPDashboard();
  const { data: behaviour, isLoading: behaviourLoading } = useBehaviourDashboard();

  const clients = useMemo((): ClientDisplay[] => {
    if (!paginatedData?.clients) return [];
    return paginatedData.clients.map((c) => ({
      id: c.id,
      name: [c.firstName, c.surename].filter(Boolean).join(" ") || "Unknown",
      tier: "Standard" as ClientTier,
      stage: "Enquiry" as Stage,
      location: [c.city, c.country].filter(Boolean).join(", "),
      nextTrip: "",
      value: 0,
      lastTouch: "",
      email: c.email || "",
      phone: c.phoneNumber || "",
      tags: [],
    }));
  }, [paginatedData]);

  const totalClients = paginatedData?.total ?? 0;
  const totalPages = paginatedData?.totalPages ?? 1;

  const filtered = useMemo(() => {
    return [...clients].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "lastTouch") return parseLastTouch(a.lastTouch) - parseLastTouch(b.lastTouch);
      return b.value - a.value;
    });
  }, [sort, clients]);

  const counts = useMemo(() => ({
    all: totalClients,
    Platinum: clients.filter((c) => c.tier === "Platinum").length,
    Gold: clients.filter((c) => c.tier === "Gold").length,
    Standard: clients.filter((c) => c.tier === "Standard").length,
  }), [clients, totalClients]);

  const activeFilters = (tier !== "all" ? 1 : 0);

  const tabs: { id: TabId; label: string; icon: any }[] = [
    { id: "list", label: "Client List", icon: Users },
    { id: "rebooking", label: "Rebooking", icon: Flame },
    { id: "vip", label: "VIP Clients", icon: Crown },
    { id: "behaviour", label: "Behaviour", icon: BarChart3 },
  ];

  return (
    <CommandCenterShell
      role={role}
      onRoleChange={setRole}
      active="clients"
      title="Clients"
      query={q}
      onQuery={handleSearch}
      theme={theme}
      onToggleTheme={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <div className="space-y-6">
        {/* Import CSV Banner */}
        <div className="flex items-center justify-between rounded-2xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-4" data-testid="banner-csv-import">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-800/40">
              <Upload className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Import clients from CSV</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">Upload a CSV file to bulk import or update clients</p>
            </div>
          </div>
          <Button
            size="sm"
            className="gap-2 rounded-full bg-blue-600 text-white hover:bg-blue-700"
            onClick={() => setShowImport(true)}
            data-testid="button-import-csv-banner"
          >
            <Upload className="h-4 w-4" />
            Import CSV
          </Button>
        </div>

        {/* KPI Cards */}
        {kpisLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3" data-testid="kpi-grid">
            <KPICard label="Active Clients" value={kpis.totalActiveClients} icon={Users} />
            <KPICard label="New This Month" value={kpis.newClientsThisMonth} icon={UserCheck} />
            <KPICard label="Repeat Clients" value={kpis.repeatClientsPercent} icon={TrendingUp} suffix="%" />
            <KPICard label="Avg Booking Value" value={currency.format(kpis.avgBookingValue)} icon={Activity} />
            <KPICard label="Avg Lifetime Value" value={currency.format(kpis.avgLifetimeValue)} icon={Crown} />
            <KPICard label="Avg Lead Time" value={kpis.avgLeadTimeDays} icon={Calendar} suffix=" days" />
            <KPICard label="Close Rate" value={kpis.closeRatePercent} icon={Sparkles} suffix="%" />
          </div>
        ) : null}

        {/* Dashboard Tabs */}
        <div className="flex flex-wrap items-center gap-2" data-testid="dashboard-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`group relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? "bg-[#3b82f6] text-white"
                  : "bg-white/60 text-black/70 hover:bg-white dark:bg-white/10 dark:text-white/70 dark:hover:bg-white/20 border border-black/10 dark:border-white/10"
              }`}
              data-testid={`tab-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Client List Tab */}
          {activeTab === "list" && (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              <div className="space-y-6">
                {/* Filters & Controls Row */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className={`gap-2 rounded-full ${showFilters ? "bg-black/5 dark:bg-white/10" : ""}`}
                      onClick={() => setShowFilters(!showFilters)}
                      data-testid="button-toggle-filters"
                    >
                      <Filter className="h-4 w-4" />
                      Filters
                      {activeFilters > 0 && (
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[10px] text-white dark:bg-white dark:text-black">
                          {activeFilters}
                        </span>
                      )}
                    </Button>
                    <div className="flex items-center rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-1">
                      <button
                        onClick={() => setView("grid")}
                        className={`rounded-full p-1.5 transition ${view === "grid" ? "bg-[#3b82f6] text-white" : "text-black/40 hover:text-black/60 dark:text-white/40 dark:hover:text-white/60"}`}
                        data-testid="button-view-grid"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setView("list")}
                        className={`rounded-full p-1.5 transition ${view === "list" ? "bg-[#3b82f6] text-white" : "text-black/40 hover:text-black/60 dark:text-white/40 dark:hover:text-white/60"}`}
                        data-testid="button-view-list"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as typeof sort)}
                      className="h-9 rounded-full border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 text-sm text-black/70 dark:text-white/70 focus:outline-none focus:ring-2 focus:ring-black/20 dark:focus:ring-white/20"
                      data-testid="select-sort"
                    >
                      <option value="value">Highest Value</option>
                      <option value="lastTouch">Recently Active</option>
                      <option value="name">A-Z</option>
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 rounded-full"
                      onClick={() => setShowImport(true)}
                      data-testid="button-import-clients"
                    >
                      <Upload className="h-4 w-4" />
                      Import CSV
                    </Button>
                    <Button
                      size="sm"
                      className="gap-2 rounded-full bg-[#3b82f6] text-white hover:bg-[#3b82f6]/90"
                      data-testid="button-add-client"
                    >
                      <Plus className="h-4 w-4" />
                      Add Client
                    </Button>
                  </div>
                </div>

                {/* Filter Panel */}
                <AnimatePresence>
                  {showFilters && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-4">
                        <div className="flex flex-wrap items-center gap-6">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-black/50 dark:text-white/50">Tier:</span>
                            {(["all", "Platinum", "Gold", "Standard"] as const).map((t) => (
                              <button
                                key={t}
                                onClick={() => setTier(t)}
                                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${
                                  tier === t
                                    ? t === "all"
                                      ? "bg-[#3b82f6] text-white"
                                      : `${tierColors[t].light} ${tierColors[t].text} ${tierColors[t].border} border`
                                    : "bg-black/5 text-black/50 hover:bg-black/10 dark:bg-white/5 dark:text-white/50 dark:hover:bg-white/10"
                                }`}
                                data-testid={`filter-tier-${t}`}
                              >
                                {t !== "all" && <Star className="h-3 w-3" />}
                                {t === "all" ? "All Tiers" : t}
                                <span className="text-[10px] opacity-60">({t === "all" ? counts.all : counts[t]})</span>
                              </button>
                            ))}
                          </div>
                          {tier !== "all" && (
                            <button
                              onClick={() => { setTier("all"); }}
                              className="ml-auto flex items-center gap-1 text-sm text-black/50 hover:text-black/70 dark:text-white/50 dark:hover:text-white/70"
                              data-testid="button-clear-filters"
                            >
                              <X className="h-3.5 w-3.5" />
                              Clear all
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Results */}
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-black/10 dark:border-white/10 bg-white/40 dark:bg-white/5 py-16">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/5 dark:bg-white/10">
                      <Search className="h-5 w-5 text-black/40 dark:text-white/40" />
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-black dark:text-white">No clients found</h3>
                    <p className="mt-1 text-sm text-black/50 dark:text-white/50">Try adjusting your search or filters</p>
                  </div>
                ) : view === "grid" ? (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="grid-clients">
                    {filtered.map((c, idx) => (
                      <motion.div
                        key={c.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.12) }}
                      >
                        <div
                          onClick={() => navigate(`/clients/${c.id}`)}
                          className="group relative cursor-pointer overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5 transition hover:border-black/20 dark:hover:border-white/20 hover:shadow-lg"
                          data-testid={`card-client-${c.id}`}
                        >
                          <div className={`absolute right-0 top-0 h-20 w-20 translate-x-8 -translate-y-8 rotate-45 ${tierColors[c.tier].bg} opacity-20`} />
                          
                          <div className="flex items-start gap-4">
                            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${tierColors[c.tier].light}`}>
                              <span className={`text-sm font-bold ${tierColors[c.tier].text}`}>
                                {shortInitials(c.name)}
                              </span>
                            </div>
                            
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-base font-semibold text-black dark:text-white" data-testid={`text-name-${c.id}`}>
                                  {c.name}
                                </h3>
                                {c.tier === "Platinum" && <Star className="h-4 w-4 text-violet-500 fill-violet-500" />}
                                {c.tier === "Gold" && <Star className="h-4 w-4 text-amber-500 fill-amber-500" />}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-black/50 dark:text-white/50">
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${stageColors[c.stage].pill}`}>
                                  <span className={`h-1.5 w-1.5 rounded-full ${stageColors[c.stage].dot}`} />
                                  {c.stage}
                                </span>
                                {c.location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {c.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {c.nextTrip && (
                            <div className="mt-4 flex items-center gap-2 rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2">
                              <Plane className="h-4 w-4 text-black/40 dark:text-white/40" />
                              <span className="truncate text-xs font-medium text-black/60 dark:text-white/60" data-testid={`text-trip-${c.id}`}>
                                {c.nextTrip}
                              </span>
                            </div>
                          )}

                          <div className="mt-4 flex items-center justify-between border-t border-black/5 dark:border-white/5 pt-4">
                            <div>
                              <div className="text-lg font-semibold text-black dark:text-white" data-testid={`text-value-${c.id}`}>
                                {currency.format(c.value)}
                              </div>
                              <div className="text-[11px] text-black/40 dark:text-white/40">
                                {c.lastTouch ? `Active ${c.lastTouch}` : "No recent activity"}
                              </div>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              {c.phone && (
                                <a
                                  href={`tel:${c.phone}`}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 dark:text-white/40 transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black/60 dark:hover:text-white/60"
                                  title="Call"
                                  data-testid={`action-call-${c.id}`}
                                >
                                  <Phone className="h-4 w-4" />
                                </a>
                              )}
                              {c.email && (
                                <a
                                  href={`mailto:${c.email}`}
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 dark:text-white/40 transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-black/60 dark:hover:text-white/60"
                                  title="Email"
                                  data-testid={`action-email-${c.id}`}
                                >
                                  <Mail className="h-4 w-4" />
                                </a>
                              )}
                              {c.phone && (
                                <a
                                  href={`https://wa.me/${c.phone.replace(/\D/g, "")}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex h-8 w-8 items-center justify-center rounded-lg text-black/40 dark:text-white/40 transition hover:bg-black/5 dark:hover:bg-white/5 hover:text-green-600"
                                  title="WhatsApp"
                                  data-testid={`action-whatsapp-${c.id}`}
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm" data-testid="list-clients">
                    <table className="w-full">
                      <thead className="border-b border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02]">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Client</th>
                          <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 sm:table-cell">Stage</th>
                          <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50 md:table-cell">Next Trip</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Value</th>
                          <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-black/5 dark:divide-white/5">
                        {filtered.map((c) => (
                          <tr
                            key={c.id}
                            onClick={() => navigate(`/clients/${c.id}`)}
                            className="cursor-pointer transition hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                            data-testid={`row-client-${c.id}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${tierColors[c.tier].light}`}>
                                  <span className={`text-xs font-bold ${tierColors[c.tier].text}`}>
                                    {shortInitials(c.name)}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="truncate text-sm font-medium text-black dark:text-white">{c.name}</span>
                                    {c.tier !== "Standard" && (
                                      <Star className={`h-3.5 w-3.5 ${c.tier === "Platinum" ? "text-violet-500 fill-violet-500" : "text-amber-500 fill-amber-500"}`} />
                                    )}
                                  </div>
                                  <div className="truncate text-xs text-black/50 dark:text-white/50">{c.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="hidden px-4 py-3 sm:table-cell">
                              <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${stageColors[c.stage].pill}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${stageColors[c.stage].dot}`} />
                                {c.stage}
                              </span>
                            </td>
                            <td className="hidden px-4 py-3 md:table-cell">
                              <span className="text-sm text-black/60 dark:text-white/60">{c.nextTrip || "—"}</span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold text-black dark:text-white">{currency.format(c.value)}</span>
                            </td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1">
                                {c.phone && (
                                  <a href={`tel:${c.phone}`} className="p-1.5 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60">
                                    <Phone className="h-4 w-4" />
                                  </a>
                                )}
                                {c.email && (
                                  <a href={`mailto:${c.email}`} className="p-1.5 text-black/40 dark:text-white/40 hover:text-black/60 dark:hover:text-white/60">
                                    <Mail className="h-4 w-4" />
                                  </a>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 0 && (
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 backdrop-blur-sm px-4 py-3" data-testid="pagination-controls">
                    <div className="text-sm text-black/50 dark:text-white/50">
                      Showing {((page - 1) * 10) + 1}–{Math.min(page * 10, totalClients)} of {totalClients} clients
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full"
                        disabled={page <= 1}
                        onClick={() => setPage(page - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 7) {
                            pageNum = i + 1;
                          } else if (page <= 4) {
                            pageNum = i + 1;
                          } else if (page >= totalPages - 3) {
                            pageNum = totalPages - 6 + i;
                          } else {
                            pageNum = page - 3 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setPage(pageNum)}
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition ${
                                page === pageNum
                                  ? "bg-[#3b82f6] text-white"
                                  : "text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
                              }`}
                              data-testid={`button-page-${pageNum}`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full"
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        data-testid="button-next-page"
                      >
                        Next
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Rebooking Tab */}
          {activeTab === "rebooking" && (
            <motion.div key="rebooking" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {rebookingLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : rebooking ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="p-4 bg-red-500/5 border-red-500/10 rounded-2xl cursor-pointer transition-all hover:shadow-md"
                      onClick={() => setRebookingTab("hot")} data-testid="card-rebooking-hot">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                        <span className="text-sm font-semibold text-black/80 dark:text-white/80">Hot</span>
                      </div>
                      <p className="text-2xl font-bold text-red-600 dark:text-red-400">{rebooking.hot.length}</p>
                      <p className="text-xs text-black/40 dark:text-white/40">Likely to rebook</p>
                    </Card>
                    <Card className="p-4 bg-amber-500/5 border-amber-500/10 rounded-2xl cursor-pointer transition-all hover:shadow-md"
                      onClick={() => setRebookingTab("warm")} data-testid="card-rebooking-warm">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-sm font-semibold text-black/80 dark:text-white/80">Warm</span>
                      </div>
                      <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{rebooking.warm.length}</p>
                      <p className="text-xs text-black/40 dark:text-white/40">Worth a nudge</p>
                    </Card>
                    <Card className="p-4 bg-blue-500/5 border-blue-500/10 rounded-2xl cursor-pointer transition-all hover:shadow-md"
                      onClick={() => setRebookingTab("cold")} data-testid="card-rebooking-cold">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                        <span className="text-sm font-semibold text-black/80 dark:text-white/80">Cold</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{rebooking.cold.length}</p>
                      <p className="text-xs text-black/40 dark:text-white/40">Overdue rebookers</p>
                    </Card>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className={`w-2.5 h-2.5 rounded-full ${rebookingTab === "hot" ? "bg-red-500" : rebookingTab === "warm" ? "bg-amber-500" : "bg-blue-500"}`} />
                      <h3 className="font-semibold text-black/80 dark:text-white/80 capitalize">{rebookingTab} Clients</h3>
                      <span className="text-xs text-black/40 dark:text-white/40">Sorted by potential value</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {rebooking[rebookingTab].map(client => (
                        <RebookingClientCard key={client.clientId} client={client} />
                      ))}
                      {rebooking[rebookingTab].length === 0 && (
                        <div className="col-span-full py-8 text-center text-black/40 dark:text-white/40 text-sm">
                          No {rebookingTab} clients found
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}

          {/* VIP Clients Tab */}
          {activeTab === "vip" && (
            <motion.div key="vip" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {vipLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : vip ? (
                <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5">
                  <div className="flex items-center gap-2 mb-5">
                    <Trophy className="w-5 h-5 text-amber-500" />
                    <h3 className="font-semibold text-black/80 dark:text-white/80">Top 10 VIP Clients</h3>
                  </div>
                  <div className="flex gap-2 mb-5">
                    {([
                      { id: "byLifetimeValue" as const, label: "Lifetime Value" },
                      { id: "byBookings" as const, label: "Bookings" },
                      { id: "byReferrals" as const, label: "Referrals" },
                    ]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setVipTab(tab.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          vipTab === tab.id
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/20"
                            : "text-black/50 dark:text-white/50 hover:bg-black/5 dark:hover:bg-white/5 border border-transparent"
                        }`}
                        data-testid={`vip-tab-${tab.id}`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                  <VIPTable
                    clients={vip[vipTab]}
                    metric={vipTab === "byLifetimeValue" ? "lifetimeValue" : vipTab === "byBookings" ? "totalBookings" : "referralCount"}
                  />
                </div>
              ) : null}
            </motion.div>
          )}

          {/* Behaviour Tab */}
          {activeTab === "behaviour" && (
            <motion.div key="behaviour" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              {behaviourLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : behaviour ? (
                <div className="space-y-4">
                  <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5 space-y-6">
                    <HeatmapRow data={behaviour.bookingMonths} label="When Clients Book (Month Created)" />
                    <HeatmapRow data={behaviour.departureMonths} label="When Clients Travel (Departure Month)" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5">
                      <BarList items={behaviour.topDestinations} label="Most Booked Destinations" />
                    </div>
                    <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5">
                      <BarList items={behaviour.topAirports} label="Most Used Departure Airports" />
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm p-5">
                    <LeadTimeTrendChart data={behaviour.avgLeadTimeTrend} />
                  </div>
                </div>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <CsvImportDialog open={showImport} onClose={() => setShowImport(false)} />
    </CommandCenterShell>
  );
}
