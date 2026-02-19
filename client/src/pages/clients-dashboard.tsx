import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
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
  Flame,
  Loader2,
  Phone,
  Search,
  Send,
  Sparkles,
  TrendingUp,
  Trophy,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { RebookingClient, VIPClient } from "@/types/dashboard";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

export default function ClientsDashboardPage() {
  const [, navigate] = useLocation();
  const { role, setRole } = useRole();
  const [activeTab, setActiveTab] = useState<TabId>("list");
  const [listSearch, setListSearch] = useState("");
  const [listPage, setListPage] = useState(1);
  const [sortBy, setSortBy] = useState("lifetime_value");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [rebookingTab, setRebookingTab] = useState<"hot" | "warm" | "cold">("hot");
  const [vipTab, setVipTab] = useState<"byLifetimeValue" | "byBookings" | "byReferrals">("byLifetimeValue");

  const { data: kpis, isLoading: kpisLoading } = useClientKPIs();
  const { data: rebooking, isLoading: rebookingLoading } = useRebookingDashboard();
  const { data: vip, isLoading: vipLoading } = useVIPDashboard();
  const { data: behaviour, isLoading: behaviourLoading } = useBehaviourDashboard();
  const { data: clientList, isLoading: listLoading } = useClientDashboardList({
    page: listPage,
    limit: 25,
    sortBy,
    sortDir,
    search: listSearch || undefined,
  });

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
    setListPage(1);
  };

  const totalPages = clientList ? Math.ceil(clientList.total / clientList.limit) : 1;

  const tabs: { id: TabId; label: string; icon: any; count?: number }[] = [
    { id: "list", label: "Client List", icon: Users, count: clientList?.total },
    { id: "rebooking", label: "Rebooking", icon: Flame, count: rebooking ? rebooking.hot.length + rebooking.warm.length + rebooking.cold.length : undefined },
    { id: "vip", label: "VIP Clients", icon: Crown },
    { id: "behaviour", label: "Behaviour", icon: BarChart3 },
  ];

  return (
    <CommandCenterShell active="clients-dashboard" title="Clients Dashboard" subtitle="Aggregate insights across all your clients" role={role} onRoleChange={setRole}>
      <div className="space-y-6">
        {/* KPI Cards - Always Visible */}
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

        {/* Tab Navigation - Matching Clients page style */}
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
              {tab.count !== undefined && (
                <span className={`ml-1 rounded-full px-2 py-0.5 text-xs ${
                  activeTab === tab.id ? "bg-white/20 text-white" : "bg-black/5 text-black/50 dark:bg-white/10 dark:text-white/50"
                }`}>
                  {tab.count.toLocaleString()}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {/* Client List Tab */}
          {activeTab === "list" && (
            <motion.div key="list" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }}>
              <div className="overflow-hidden rounded-3xl border border-black/10 dark:border-white/10 bg-white/70 dark:bg-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-3 p-4 border-b border-black/[0.06] dark:border-white/[0.06]">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black/30 dark:text-white/30" />
                    <Input
                      placeholder="Search clients..."
                      value={listSearch}
                      onChange={(e) => { setListSearch(e.target.value); setListPage(1); }}
                      className="pl-9 rounded-full bg-white/80 dark:bg-white/[0.06] border-black/[0.08] dark:border-white/[0.08]"
                      data-testid="input-client-list-search"
                    />
                    {listSearch && (
                      <button onClick={() => { setListSearch(""); setListPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2" data-testid="button-clear-search">
                        <X className="w-4 h-4 text-black/30 dark:text-white/30 hover:text-black/60" />
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-black/40 dark:text-white/40">{clientList?.total?.toLocaleString() || 0} clients</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-client-list">
                    <thead className="bg-black/[0.02] dark:bg-white/[0.02]">
                      <tr className="border-b border-black/[0.06] dark:border-white/[0.06]">
                        {[
                          { key: "name", label: "Client", align: "left" },
                          { key: "lifetime_value", label: "Lifetime Value", align: "right" },
                          { key: "total_bookings", label: "Bookings", align: "right" },
                          { key: "total_enquiries", label: "Enquiries", align: "right" },
                          { key: "last_booking_date", label: "Last Booking", align: "right" },
                          { key: "created_at", label: "Client Since", align: "right" },
                        ].map(col => (
                          <th
                            key={col.key}
                            onClick={() => handleSort(col.key)}
                            className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-blue-600 transition-colors ${
                              col.align === "left" ? "text-left" : "text-right"
                            } ${sortBy === col.key ? "text-blue-600 dark:text-blue-400" : "text-black/50 dark:text-white/50"}`}
                            data-testid={`sort-${col.key}`}
                          >
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortBy === col.key ? (
                                sortDir === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                              ) : (
                                <ArrowUpDown className="w-3 h-3 opacity-30" />
                              )}
                            </span>
                          </th>
                        ))}
                        <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-black/50 dark:text-white/50">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                      {listLoading ? (
                        <tr><td colSpan={7} className="py-12 text-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" /></td></tr>
                      ) : clientList?.clients.map(client => (
                        <tr
                          key={client.id}
                          className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                          onClick={() => navigate(`/clients/${client.id}`)}
                          data-testid={`row-client-${client.id}`}
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-medium text-black/90 dark:text-white/90 hover:text-blue-600 transition-colors">{client.name}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                {client.email && <span className="text-xs text-black/40 dark:text-white/40">{client.email}</span>}
                                {client.leadSource && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-md">{client.leadSource}</Badge>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-black/80 dark:text-white/80">{currency.format(client.lifetimeValue)}</td>
                          <td className="px-4 py-3 text-right text-black/60 dark:text-white/60">{client.totalBookings}</td>
                          <td className="px-4 py-3 text-right text-black/60 dark:text-white/60">{client.totalEnquiries}</td>
                          <td className="px-4 py-3 text-right text-black/60 dark:text-white/60">
                            {client.lastBookingDate ? new Date(client.lastBookingDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-3 text-right text-black/60 dark:text-white/60">
                            {client.createdAt ? new Date(client.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                          </td>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/clients/${client.id}`}>
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" title="View profile" data-testid={`button-view-${client.id}`}>
                                  <Eye className="w-3.5 h-3.5" />
                                </Button>
                              </Link>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" title="Call" data-testid={`button-call-${client.id}`}>
                                <Phone className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" title="Send deal" data-testid={`button-send-${client.id}`}>
                                <Send className="w-3.5 h-3.5" />
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-lg" title="Create quote" data-testid={`button-quote-${client.id}`}>
                                <FileText className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!listLoading && clientList?.clients.length === 0 && (
                        <tr><td colSpan={7} className="py-12 text-center text-black/40 dark:text-white/40">No clients found</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-black/[0.06] dark:border-white/[0.06]" data-testid="pagination-controls">
                    <div className="text-sm text-black/50 dark:text-white/50">
                      Showing {((listPage - 1) * 25) + 1}–{Math.min(listPage * 25, clientList?.total || 0)} of {clientList?.total?.toLocaleString()} clients
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1 rounded-full"
                        disabled={listPage <= 1}
                        onClick={() => setListPage(p => p - 1)}
                        data-testid="button-prev-page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                      </Button>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                          let pageNum: number;
                          if (totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (listPage <= 3) {
                            pageNum = i + 1;
                          } else if (listPage >= totalPages - 2) {
                            pageNum = totalPages - 4 + i;
                          } else {
                            pageNum = listPage - 2 + i;
                          }
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setListPage(pageNum)}
                              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition ${
                                listPage === pageNum
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
                        disabled={listPage >= totalPages}
                        onClick={() => setListPage(p => p + 1)}
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
    </CommandCenterShell>
  );
}
