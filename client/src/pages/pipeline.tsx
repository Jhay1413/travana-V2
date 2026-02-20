import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  Calendar,
  ChevronRight,
  Filter,
  Search,
  UserCircle,
  Users,
  Plane,
  FileText,
  ArrowUpDown,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions, useNeonClients, useUsers } from "@/hooks/queries";
import type { Transaction } from "@/types/quote";

type LiveStatus = "Enquiry" | "Quoted";

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  if (!amount || amount === 0) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getQuoteStatus(transaction: Transaction): string {
  if (transaction.quotes && transaction.quotes.length > 0) {
    const status = transaction.quotes[0].quote_status;
    if (status) {
      return status
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    }
  }
  if (transaction.status === "on_enquiry") return "Enquiry";
  if (transaction.status === "on_quote") return "Quoted";
  return "Active";
}

function getTransactionTitle(transaction: Transaction): string {
  if (transaction.enquiry?.title) return transaction.enquiry.title;
  if (transaction.quotes && transaction.quotes.length > 0 && transaction.quotes[0].title) {
    return transaction.quotes[0].title;
  }
  return `#${transaction.id.slice(0, 8)}`;
}

function getTransactionDate(transaction: Transaction): string | null {
  if (transaction.enquiry?.travel_date) return transaction.enquiry.travel_date;
  if (transaction.quotes && transaction.quotes.length > 0) return transaction.quotes[0].travel_date;
  return transaction.created_at;
}

function getTransactionValue(transaction: Transaction): number {
  if (transaction.quotes && transaction.quotes.length > 0) {
    return transaction.quotes.reduce((sum, q) => sum + (parseFloat(q.sales_price || "0") || 0), 0);
  }
  return 0;
}

function getTransactionGuests(transaction: Transaction): string {
  let adults = 0, children = 0, infants = 0;
  if (transaction.enquiry) {
    adults = transaction.enquiry.adults || 0;
    children = transaction.enquiry.children || 0;
    infants = transaction.enquiry.infants || 0;
  } else if (transaction.quotes && transaction.quotes.length > 0) {
    const q = transaction.quotes[0];
    adults = q.adult || 0;
    children = q.child || 0;
    infants = q.infant || 0;
  }
  const parts = [];
  if (adults > 0) parts.push(`${adults}A`);
  if (children > 0) parts.push(`${children}C`);
  if (infants > 0) parts.push(`${infants}I`);
  return parts.join(" ") || "—";
}

function classifyLive(transaction: Transaction): LiveStatus {
  if (transaction.status === "on_quote") return "Quoted";
  return "Enquiry";
}

function statusBadgeClass(status: LiveStatus): string {
  if (status === "Enquiry") return "bg-blue-500/10 text-blue-700 border-blue-500/20";
  return "bg-amber-500/10 text-amber-700 border-amber-500/20";
}

interface LiveClientRow {
  transaction: Transaction;
  clientName: string;
  clientPhone: string;
  agentName: string;
  status: LiveStatus;
  title: string;
  travelDate: string | null;
  value: number;
  guests: string;
  quoteStatus: string;
  clientId: string | null;
}

export default function PipelinePage() {
  const { role, setRole } = useRole();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 5000 });
  const { data: users } = useUsers();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "value-high" | "value-low" | "client-az">("newest");

  const clientMap = useMemo(() => {
    const map = new Map<string, { name: string; phone: string }>();
    if (neonClientsData?.clients) {
      for (const c of neonClientsData.clients) {
        const titlePart = c.title && c.title !== "NULL" ? c.title : "";
        const name = [titlePart, c.firstName, c.surename].filter(Boolean).join(" ");
        map.set(c.id, { name: name || "Unknown", phone: c.phoneNumber || "" });
      }
    }
    return map;
  }, [neonClientsData]);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    if (users) {
      for (const u of users) {
        const name = u.firstName && u.lastName
          ? `${u.firstName} ${u.lastName}`
          : u.name || u.email || "Unknown";
        map.set(u.id, name);
      }
    }
    return map;
  }, [users]);

  const liveClients: LiveClientRow[] = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .filter((t) => t.status === "on_enquiry" || t.status === "on_quote")
      .map((t) => {
        const client = clientMap.get(t.client_id || "") || { name: "Unknown", phone: "" };
        const agentId = t.agent_id || t.user_id || "";
        return {
          transaction: t,
          clientName: client.name,
          clientPhone: client.phone,
          agentName: userMap.get(agentId) || "Unassigned",
          status: classifyLive(t),
          title: getTransactionTitle(t),
          travelDate: getTransactionDate(t),
          value: getTransactionValue(t),
          guests: getTransactionGuests(t),
          quoteStatus: getQuoteStatus(t),
          clientId: t.client_id,
        };
      });
  }, [transactions, clientMap, userMap]);

  const filteredRows = useMemo(() => {
    let rows = [...liveClients];

    if (statusFilter !== "all") {
      rows = rows.filter((r) => r.status === statusFilter);
    }

    if (agentFilter !== "all") {
      rows = rows.filter((r) => {
        const agentId = r.transaction.agent_id || r.transaction.user_id || "";
        return agentId === agentFilter;
      });
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.clientName.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          r.clientPhone.includes(q) ||
          r.agentName.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "oldest":
        rows.sort((a, b) => new Date(a.transaction.created_at || 0).getTime() - new Date(b.transaction.created_at || 0).getTime());
        break;
      case "value-high":
        rows.sort((a, b) => b.value - a.value);
        break;
      case "value-low":
        rows.sort((a, b) => a.value - b.value);
        break;
      case "client-az":
        rows.sort((a, b) => a.clientName.localeCompare(b.clientName));
        break;
      default:
        rows.sort((a, b) => new Date(b.transaction.created_at || 0).getTime() - new Date(a.transaction.created_at || 0).getTime());
    }

    return rows;
  }, [liveClients, statusFilter, agentFilter, search, sortBy]);

  const enquiryCount = liveClients.filter((r) => r.status === "Enquiry").length;
  const quotedCount = liveClients.filter((r) => r.status === "Quoted").length;

  if (transactionsLoading) {
    return (
      <CommandCenterShell
        active="pipeline"
        title="Live Clients"
        subtitle="Clients with active enquiries or quotes"
        role={role}
        onRoleChange={setRole}
      >
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell
      active="pipeline"
      title="Live Clients"
      subtitle="Clients with active enquiries or quotes"
      role={role}
      onRoleChange={setRole}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="grid grid-cols-3 gap-3">
          <Card className="glass ringed grain rounded-2xl p-4" data-testid="stat-total-live">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-black/50" />
              <span className="text-xs font-medium text-black/50">Total Live</span>
            </div>
            <p className="text-2xl font-bold text-black/80">{liveClients.length}</p>
          </Card>
          <Card className="glass ringed grain rounded-2xl p-4 bg-blue-500/5 border-blue-500/15" data-testid="stat-enquiries">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="h-4 w-4 text-blue-600/60" />
              <span className="text-xs font-medium text-blue-700/60">Enquiries</span>
            </div>
            <p className="text-2xl font-bold text-blue-800">{enquiryCount}</p>
          </Card>
          <Card className="glass ringed grain rounded-2xl p-4 bg-amber-500/5 border-amber-500/15" data-testid="stat-quoted">
            <div className="flex items-center gap-2 mb-1">
              <Plane className="h-4 w-4 text-amber-600/60" />
              <span className="text-xs font-medium text-amber-700/60">Quoted</span>
            </div>
            <p className="text-2xl font-bold text-amber-800">{quotedCount}</p>
          </Card>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black/40" />
            <Input
              placeholder="Search clients, trips, agents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 rounded-2xl border-black/10 bg-black/5"
              data-testid="input-live-search"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 w-[150px] rounded-2xl border-black/10 bg-black/5" data-testid="select-status-filter">
              <Filter className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Enquiry">Enquiry</SelectItem>
              <SelectItem value="Quoted">Quoted</SelectItem>
            </SelectContent>
          </Select>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-10 w-[170px] rounded-2xl border-black/10 bg-black/5" data-testid="select-agent-filter">
              <UserCircle className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agents</SelectItem>
              {(users || []).map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.name || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
            <SelectTrigger className="h-10 w-[160px] rounded-2xl border-black/10 bg-black/5" data-testid="select-sort">
              <ArrowUpDown className="mr-2 h-4 w-4 shrink-0 opacity-60" />
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="value-high">Value High</SelectItem>
              <SelectItem value="value-low">Value Low</SelectItem>
              <SelectItem value="client-az">Client A-Z</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Card className="glass ringed grain rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/10 bg-black/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Agent</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Client</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Trip / Enquiry</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Travel Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Guests</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-black/50 uppercase tracking-wider">Value</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-black/50 uppercase tracking-wider">Quote Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-black/40">
                      {search || statusFilter !== "all" || agentFilter !== "all"
                        ? "No live clients match your filters"
                        : "No live clients — all quiet!"}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr
                      key={row.transaction.id}
                      className="hover:bg-black/[0.02] transition-colors"
                      data-testid={`row-live-client-${row.transaction.id}`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm text-black/70 font-medium" data-testid={`text-agent-${row.transaction.id}`}>
                          {row.agentName}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="text-sm font-semibold text-black/80" data-testid={`text-client-name-${row.transaction.id}`}>
                            {row.clientName}
                          </div>
                          {row.clientPhone && (
                            <div className="text-xs text-black/40">{row.clientPhone}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-black/70" data-testid={`text-title-${row.transaction.id}`}>
                          {row.title}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-sm text-black/60">
                          <Calendar className="h-3.5 w-3.5 text-black/30" />
                          <span data-testid={`text-date-${row.transaction.id}`}>{formatDate(row.travelDate)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-black/60" data-testid={`text-guests-${row.transaction.id}`}>
                          {row.guests}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-semibold text-emerald-700" data-testid={`text-value-${row.transaction.id}`}>
                          {formatCurrency(row.value)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          className={`rounded-full text-[11px] font-medium ${statusBadgeClass(row.status)}`}
                          data-testid={`badge-status-${row.transaction.id}`}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-black/50" data-testid={`text-quote-status-${row.transaction.id}`}>
                          {row.quoteStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.clientId && (
                          <Link
                            href={`/clients/${row.clientId}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors no-underline"
                            data-testid={`link-view-${row.transaction.id}`}
                          >
                            View
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredRows.length > 0 && (
            <div className="border-t border-black/10 px-4 py-3 flex items-center justify-between bg-black/[0.02]">
              <span className="text-xs text-black/40">
                Showing {filteredRows.length} of {liveClients.length} live clients
              </span>
            </div>
          )}
        </Card>
      </motion.div>
    </CommandCenterShell>
  );
}
