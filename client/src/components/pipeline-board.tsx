import { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Copy,
  Filter,
  Loader2,
  StickyNote,
  PoundSterling,
  TrendingUp,
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Edit,
  Star,
  MapPin,
  Building2,
  Clock,
  Layers,
  SlidersHorizontal,
  BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePipelineColumn, useNeonClients, useCurrentUser, transactionKeys } from "@/hooks/queries";
import { useNotes } from "@/hooks/queries";
import { useUpdateTransaction, useConvertToBooking } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";
import type { Transaction } from "@/types/quote";

type PipelineStage = "Enquiry" | "Quoted" | "In Play" | "Booked";

const STAGES: PipelineStage[] = ["Enquiry", "Quoted", "In Play", "Booked"];

const STAGE_TO_STATUS: Record<PipelineStage, string> = {
  "Enquiry": "on_enquiry",
  "Quoted": "on_quote",
  "In Play": "in_play",
  "Booked": "on_booking",
};

const STAGE_COLORS: Record<PipelineStage, { hex: string; bgLight: string; text: string; dot: string }> = {
  "Enquiry": { hex: "#3B82F6", bgLight: "bg-blue-50", text: "text-blue-600", dot: "bg-blue-500" },
  "Quoted": { hex: "#F59E0B", bgLight: "bg-amber-50", text: "text-amber-600", dot: "bg-amber-500" },
  "In Play": { hex: "#8B5CF6", bgLight: "bg-purple-50", text: "text-purple-600", dot: "bg-purple-500" },
  "Booked": { hex: "#10B981", bgLight: "bg-emerald-50", text: "text-emerald-600", dot: "bg-emerald-500" },
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function getTransactionValue(transaction: Transaction): number {
  if (transaction.quotes && transaction.quotes.length > 0) {
    return transaction.quotes.reduce((sum, q) => {
      const salesPrice = parseFloat(q.sales_price || "0") || 0;
      const discount = parseFloat(q.discounts || "0") || 0;
      const serviceCharge = parseFloat(q.service_charge || "0") || 0;
      return sum + (salesPrice - discount + serviceCharge);
    }, 0);
  }
  if (transaction.booking) {
    const salesPrice = parseFloat(transaction.booking.sales_price || "0") || 0;
    const discount = parseFloat(transaction.booking.discounts || "0") || 0;
    const serviceCharge = parseFloat(transaction.booking.service_charge || "0") || 0;
    return salesPrice - discount + serviceCharge;
  }
  return 0;
}

function getTransactionProfit(transaction: Transaction): number {
  if (transaction.quotes && transaction.quotes.length > 0) {
    return transaction.quotes.reduce((sum, q) => {
      const commission = parseFloat(q.package_commission || "0") || 0;
      if (commission > 0) return sum + commission;
      const price = parseFloat(q.sales_price || "0") || 0;
      if (price > 0) return sum + price * 0.1;
      return sum;
    }, 0);
  }
  if (transaction.booking) {
    const commission = parseFloat(transaction.booking.package_commission || "0") || 0;
    if (commission > 0) return commission;
    const price = parseFloat(transaction.booking.sales_price || "0") || 0;
    if (price > 0) return price * 0.1;
  }
  return 0;
}

function getTransactionTitle(transaction: Transaction): string {
  if (transaction.enquiry?.title) return transaction.enquiry.title;
  if (transaction.quotes && transaction.quotes.length > 0 && transaction.quotes[0].title) return transaction.quotes[0].title;
  if (transaction.booking?.title) return transaction.booking.title;
  return `Transaction #${transaction.id.slice(0, 8)}`;
}

function getTransactionDate(transaction: Transaction): string | null {
  if (transaction.enquiry?.travel_date) return transaction.enquiry.travel_date;
  if (transaction.quotes && transaction.quotes.length > 0) return transaction.quotes[0].travel_date;
  if (transaction.booking) return transaction.booking.travel_date;
  return transaction.created_at;
}

function getTransactionPassengers(transaction: Transaction): string {
  let adults = 0, children = 0, infants = 0;
  if (transaction.enquiry) { adults = transaction.enquiry.adults || 0; children = transaction.enquiry.children || 0; infants = transaction.enquiry.infants || 0; }
  else if (transaction.quotes && transaction.quotes.length > 0) { const q = transaction.quotes[0]; adults = q.adult || 0; children = q.child || 0; infants = q.infant || 0; }
  else if (transaction.booking) { adults = transaction.booking.adult || 0; children = transaction.booking.child || 0; infants = transaction.booking.infant || 0; }
  const parts: string[] = [];
  if (adults > 0) parts.push(`${adults}A`);
  if (children > 0) parts.push(`${children}C`);
  if (infants > 0) parts.push(`${infants}I`);
  return parts.join(" ") || "—";
}

function getTransactionDestination(transaction: Transaction): { destination: string; country: string } {
  const q = transaction.quotes?.[0];
  const b = transaction.booking;
  const e = transaction.enquiry;
  const destination = q?.destination || b?.destination || (e as any)?.destination || "";
  const country = q?.country || b?.country || (e as any)?.country || "";
  return { destination: destination || "TBC", country };
}

function getTransactionTourOp(transaction: Transaction): string | null {
  const q = transaction.quotes?.[0];
  const b = transaction.booking;
  return (q as any)?.main_tour_operator_name || (b as any)?.main_tour_operator_name || null;
}

function getQuoteStatus(transaction: Transaction): string | null {
  const q = transaction.quotes?.[0];
  return (q as any)?.quote_status || null;
}

function getTimeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface PipelineCardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onDragStart: (transaction: Transaction, stage: PipelineStage) => void;
}

function PipelineCard({ transaction, stage, clientName, onDragStart }: PipelineCardProps) {
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const profit = getTransactionProfit(transaction);
  const totalValue = getTransactionValue(transaction);
  const travelDate = getTransactionDate(transaction);
  const pax = getTransactionPassengers(transaction);
  const { destination, country } = getTransactionDestination(transaction);
  const tourOp = getTransactionTourOp(transaction);
  const quoteStatus = getQuoteStatus(transaction);
  const colors = STAGE_COLORS[stage];
  const { data: notes = [] } = useNotes(transaction.id);

  const copyQuotes = (stage === "Quoted" || stage === "In Play") && transaction.quotes
    ? transaction.quotes.filter(q => q.isQuoteCopy === true) : [];
  const quoteCount = transaction.quotes?.length || 0;
  const latestNote = notes.length > 0 ? (notes[0].content || notes[0].description || "").replace(/<[^>]*>/g, "") : null;

  const getNavigationUrl = () => {
    if (!transaction.client_id) return `/pipeline`;
    if (stage === "Enquiry" && transaction.enquiry) return `/clients/${transaction.client_id}/enquiries/${transaction.enquiry.id}`;
    if ((stage === "Quoted" || stage === "In Play") && transaction.quotes?.length) {
      const mainQuote = transaction.quotes.find(q => !q.isQuoteCopy) || transaction.quotes[0];
      return `/clients/${transaction.client_id}/quotes/${mainQuote.id}`;
    }
    if (stage === "Booked" && transaction.booking) return `/clients/${transaction.client_id}/bookings/${transaction.booking.id}`;
    return `/clients/${transaction.client_id}`;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ transactionId: transaction.id, fromStage: stage }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    onDragStart(transaction, stage);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    if ((e.target as HTMLElement).closest('button')) return;
    setLocation(getNavigationUrl());
  };

  const statusColors: Record<string, string> = {
    "AWAITING_DECISION": "bg-amber-50 text-amber-600",
    "QUOTE_READY": "bg-blue-50 text-blue-600",
    "QUOTE_IN_PROGRESS": "bg-gray-100 text-gray-500",
    "QUOTE_CALL": "bg-purple-50 text-purple-600",
    "NEW_LEAD": "bg-sky-50 text-sky-600",
    "REQUOTE": "bg-orange-50 text-orange-600",
    "WON": "bg-emerald-50 text-emerald-600",
  };

  return (
    <div
      className={`group bg-white rounded-xl border border-gray-100 hover:border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing active:shadow-lg active:scale-[1.02] relative ${isDragging ? "opacity-40" : ""}`}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={() => setIsDragging(false)}
      onClick={handleCardClick}
      data-testid={`pipeline-card-${transaction.id}`}
    >
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: colors.hex }} />

      <div className="p-3.5 pl-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[13px] text-gray-900 truncate" data-testid={`pipeline-title-${transaction.id}`}>
              {clientName}
            </h4>
            <div className="flex items-center gap-1 mt-0.5">
              <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
              <span className="text-[12px] text-gray-500 truncate">{destination}</span>
              {country && country !== destination && (
                <span className="text-[11px] text-gray-400">· {country}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button className="p-1 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); setLocation(getNavigationUrl()); }}>
              <Eye className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <button className="p-1 rounded-md hover:bg-gray-100" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1">
            <PoundSterling className="w-3 h-3 text-gray-400" />
            <span className="font-semibold text-[13px] text-gray-900">{totalValue > 0 ? formatCurrency(totalValue) : "TBC"}</span>
          </div>
          {profit > 0 && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <span className="text-[12px] text-emerald-600 font-medium">{formatCurrency(profit)}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 mb-2 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md">
            <Calendar className="w-3 h-3" />{formatDate(travelDate)}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md">
            <Users className="w-3 h-3" />{pax}
          </span>
          {tourOp && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-1.5 py-0.5 rounded-md truncate max-w-[140px]">
              <Building2 className="w-3 h-3 flex-shrink-0" />{tourOp}
            </span>
          )}
        </div>

        {quoteCount > 0 && (stage === "Quoted" || stage === "In Play") && (
          <div className="flex items-center gap-1.5 mb-2">
            <Layers className="w-3 h-3 text-gray-400" />
            <span className="text-[11px] text-gray-500">{quoteCount} quote{quoteCount > 1 ? "s" : ""}</span>
            {copyQuotes.length > 0 && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-medium">
                <Copy className="w-2.5 h-2.5" />{copyQuotes.length} copy
              </span>
            )}
            {quoteStatus && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusColors[quoteStatus] || "bg-gray-50 text-gray-500"}`}>
                {quoteStatus.replace(/_/g, " ")}
              </span>
            )}
          </div>
        )}

        {latestNote && (
          <p className="text-[11px] text-gray-400 italic truncate mb-2">"{latestNote}"</p>
        )}

        <div className="flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-[11px] text-gray-500 truncate max-w-[60%]" data-testid={`pipeline-client-${transaction.id}`}>
            {getTransactionTitle(transaction)}
          </span>
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-gray-300" />
            <span className="text-[11px] text-gray-400">{getTimeAgo(transaction.created_at)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface PipelineColumnProps {
  stage: PipelineStage;
  transactions: Transaction[];
  total: number;
  totalValue: number;
  totalProfit: number;
  getClientName: (clientId: string | null) => string;
  onDragStart: (transaction: Transaction, stage: PipelineStage) => void;
  onDrop: (transactionId: string, fromStage: PipelineStage, toStage: PipelineStage) => void;
  isDragActive: boolean;
  dragFromStage: PipelineStage | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

const VISIBLE_PAGE_SIZE = 10;

function PipelineColumn({ stage, transactions: stageTransactions, total, totalValue, totalProfit, getClientName, onDragStart, onDrop, isDragActive, dragFromStage, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading }: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const [localPage, setLocalPage] = useState(0);
  const colors = STAGE_COLORS[stage];
  const isValidTarget = isDragActive && dragFromStage !== stage;
  const progressWidth = Math.min((total / 20) * 100, 100);

  const localStart = localPage * VISIBLE_PAGE_SIZE;
  const localEnd = localStart + VISIBLE_PAGE_SIZE;
  const visibleItems = stageTransactions.slice(localStart, localEnd);
  const needsMoreData = localEnd >= stageTransactions.length && hasNextPage;
  const canGoNext = localEnd < stageTransactions.length || hasNextPage;
  const canGoPrev = localPage > 0;

  const handleNext = () => {
    if (needsMoreData && hasNextPage) fetchNextPage();
    setLocalPage((p) => p + 1);
  };

  const handleDragOver = (e: React.DragEvent) => { if (!isValidTarget) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsOver(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setIsOver(false);
    try { const data = JSON.parse(e.dataTransfer.getData("application/json")); if (data.transactionId && data.fromStage !== stage) onDrop(data.transactionId, data.fromStage, stage); } catch {}
  };

  return (
    <div
      className="flex flex-col min-w-[280px] flex-1"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}`}
    >
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            <h3 className="font-semibold text-sm text-gray-800">{stage}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{total}</span>
          </div>
        </div>

        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressWidth}%`, backgroundColor: colors.hex }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-700">{formatCurrency(totalValue)}</span>
          <span className="text-[11px] text-emerald-600 font-medium">Profit: {formatCurrency(totalProfit)}</span>
        </div>
      </div>

      <div className={`flex-1 space-y-2.5 overflow-y-auto pb-4 pr-1 rounded-xl transition-all duration-200 ${isOver ? "ring-2 ring-blue-400 bg-blue-50/50 p-2" : isValidTarget ? "bg-gray-50/50 p-1" : ""}`} style={{ maxHeight: "calc(100vh - 220px)" }}>
        {isOver && (
          <div className="rounded-lg border-2 border-dashed border-blue-300 p-3 text-center">
            <p className="text-xs font-medium text-blue-500">Drop here to move to {stage}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Spinner /></div>
        ) : stageTransactions.length === 0 && !isOver ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-xs text-gray-400">{isDragActive && isValidTarget ? "Drop here" : "No transactions"}</p>
          </div>
        ) : (
          <>
            {visibleItems.map((transaction) => (
              <PipelineCard key={transaction.id} transaction={transaction} stage={stage} clientName={getClientName(transaction.client_id)} onDragStart={onDragStart} />
            ))}
            {isFetchingNextPage && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>}
            {(canGoPrev || canGoNext) && (
              <div className="flex items-center justify-between pt-1">
                <button type="button" disabled={!canGoPrev} onClick={() => setLocalPage((p) => p - 1)} className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" data-testid={`button-prev-${stage.toLowerCase()}`}>← Prev</button>
                <button type="button" disabled={!canGoNext || isFetchingNextPage} onClick={handleNext} className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" data-testid={`button-next-${stage.toLowerCase()}`}>Next →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const PIPELINE_PAGE_SIZE = 10;

const QUOTE_STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "QUOTE_IN_PROGRESS", label: "Quote in Progress" },
  { value: "QUOTE_SENT", label: "Quote Sent" },
  { value: "QUOTE_ACCEPTED", label: "Quote Accepted" },
  { value: "QUOTE_REJECTED", label: "Quote Rejected" },
  { value: "AWAITING_DEPOSIT", label: "Awaiting Deposit" },
];

export default function PipelineBoard() {
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 200 });
  const { data: currentUser } = useCurrentUser();
  const updateTransactionMutation = useUpdateTransaction();
  const convertToBookingMutation = useConvertToBooking();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");
  const [activeFilter, setActiveFilter] = useState<"all" | "mine" | "starred">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [quoteDialog, setQuoteDialog] = useState<{ transactionId: string; clientId: string; userId: string } | null>(null);
  const [bookingDialog, setBookingDialog] = useState<{ quoteId: string } | null>(null);
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");

  useEffect(() => {
    if (currentUser?.id && !selectedAgentId) {
      const isRestrictedRole = currentUser.role !== "Admin" && currentUser.role !== "Manager";
      setSelectedAgentId(isRestrictedRole ? currentUser.id : "all");
    }
  }, [currentUser?.id, currentUser?.role, selectedAgentId]);

  const agentFilter = selectedAgentId && selectedAgentId !== "all" ? selectedAgentId : undefined;
  const quoteStatusParam = quoteStatusFilter !== "all" ? quoteStatusFilter : undefined;

  const enquiryQuery = usePipelineColumn("enquiry", PIPELINE_PAGE_SIZE, agentFilter);
  const quoteQuery = usePipelineColumn("quote", PIPELINE_PAGE_SIZE, agentFilter, quoteStatusParam);
  const inPlayQuery = usePipelineColumn("in_play", PIPELINE_PAGE_SIZE, agentFilter);
  const bookingQuery = usePipelineColumn("booking", PIPELINE_PAGE_SIZE, agentFilter);

  const flattenPages = (query: typeof enquiryQuery): { items: Transaction[]; total: number; totalProfit: number; totalValue: number } => {
    if (!query.data?.pages) return { items: [], total: 0, totalProfit: 0, totalValue: 0 };
    const items = query.data.pages.flatMap((p) => p.items);
    const total = query.data.pages[0]?.total || 0;
    const totalProfit = query.data.pages[0]?.totalProfit || 0;
    const totalValue = query.data.pages[0]?.totalValue || 0;
    return { items, total, totalProfit, totalValue };
  };

  const enquiryData = flattenPages(enquiryQuery);
  const quoteData = flattenPages(quoteQuery);
  const inPlayData = flattenPages(inPlayQuery);
  const bookingData = flattenPages(bookingQuery);

  const [dragState, setDragState] = useState<{ active: boolean; fromStage: PipelineStage | null; transactionId: string | null }>({ active: false, fromStage: null, transactionId: null });

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (neonClientsData?.clients) {
      for (const c of neonClientsData.clients) {
        const titlePart = c.title && c.title !== "NULL" ? c.title : "";
        map.set(c.id, [titlePart, c.firstName, c.surename].filter(Boolean).join(" "));
      }
    }
    return map;
  }, [neonClientsData]);

  const getClientName = (clientId: string | null) => clientId ? (clientNameMap.get(clientId) || "Unknown Client") : "Unknown Client";

  const handleDragStart = useCallback((transaction: Transaction, stage: PipelineStage) => {
    setDragState({ active: true, fromStage: stage, transactionId: transaction.id });
  }, []);

  const allLoadedTransactions = useMemo(() => [...enquiryData.items, ...quoteData.items, ...inPlayData.items, ...bookingData.items], [enquiryData.items, quoteData.items, inPlayData.items, bookingData.items]);

  const handleDrop = useCallback((transactionId: string, fromStage: PipelineStage, toStage: PipelineStage) => {
    setDragState({ active: false, fromStage: null, transactionId: null });
    if (fromStage === toStage) return;
    const transaction = allLoadedTransactions.find((t) => t.id === transactionId);
    if (!transaction) return;
    if (fromStage === "Enquiry" && toStage === "Quoted") { setQuoteDialog({ transactionId, clientId: transaction.client_id || "", userId: transaction.user_id || currentUser?.id || "" }); return; }
    if (fromStage === "Quoted" && toStage === "Booked") {
      const activeQuote = (transaction.quotes || []).find((q: any) => !q.isFreeQuote);
      if (!activeQuote) { toast({ title: "No quote found on this transaction", variant: "destructive" }); return; }
      setHaysRef(""); setTourRef(""); setBookingDialog({ quoteId: activeQuote.id }); return;
    }
    updateTransactionMutation.mutate(
      { id: transactionId, data: { status: STAGE_TO_STATUS[toStage] } as any },
      {
        onSuccess: () => { toast({ title: `Moved to ${toStage}`, description: `Transaction has been updated.` }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
        onError: () => { toast({ title: "Error", description: "Failed to move the transaction.", variant: "destructive" }); },
      }
    );
  }, [allLoadedTransactions, updateTransactionMutation, currentUser, toast, queryClient]);

  const handleDragEnd = useCallback(() => { setDragState({ active: false, fromStage: null, transactionId: null }); }, []);

  const isInitialLoading = enquiryQuery.isLoading && quoteQuery.isLoading && inPlayQuery.isLoading && bookingQuery.isLoading;

  const totalPipelineValue = enquiryData.totalValue + quoteData.totalValue + inPlayData.totalValue + bookingData.totalValue;
  const totalPipelineProfit = enquiryData.totalProfit + quoteData.totalProfit + inPlayData.totalProfit + bookingData.totalProfit;
  const totalTransactions = enquiryData.total + quoteData.total + inPlayData.total + bookingData.total;

  const stageQueryMap: Record<PipelineStage, typeof enquiryQuery> = { Enquiry: enquiryQuery, Quoted: quoteQuery, "In Play": inPlayQuery, Booked: bookingQuery };
  const stageDataMap: Record<PipelineStage, { items: Transaction[]; total: number; totalProfit: number; totalValue: number }> = { Enquiry: enquiryData, Quoted: quoteData, "In Play": inPlayData, Booked: bookingData };

  return (
    <>
      <div className="space-y-0" onDragEnd={handleDragEnd}>
        <div className="border-b border-gray-200 bg-white rounded-t-2xl -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="py-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-gray-900">Pipeline</h2>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-900 shadow-sm">Board</button>
                  <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700">List</button>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search deals..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 placeholder:text-gray-400"
                    data-testid="input-pipeline-search"
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${showFilters ? "border-blue-300 bg-blue-50 text-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`}
                  data-testid="button-toggle-filters"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  Filters
                </button>
              </div>
            </div>

            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 py-2 mb-2 border-t border-gray-100">
                <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                  <SelectTrigger className="h-8 w-[180px] rounded-lg border-gray-200 bg-white text-xs" data-testid="select-quote-status">
                    <Filter className="mr-1.5 h-3.5 w-3.5 opacity-60" />
                    <SelectValue placeholder="Quote Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUS_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value} data-testid={`select-quote-status-${opt.value}`}>{opt.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                {selectedAgentId && (
                  <UserReassignSelect value={selectedAgentId} onValueChange={setSelectedAgentId} allowAll allLabel="All Agents" className="w-[180px]" data-testid="select-agent-filter" />
                )}
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  {(["all", "mine"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setActiveFilter(f);
                        if (f === "mine" && currentUser?.id) setSelectedAgentId(currentUser.id);
                        else if (f === "all") setSelectedAgentId("all");
                      }}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${activeFilter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                      data-testid={`button-filter-${f}`}
                    >
                      {f === "all" ? "All Deals" : "My Deals"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 text-[12px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Deals:</span>
                  <span className="font-semibold text-gray-700" data-testid="pipeline-total-deals">{isInitialLoading ? "…" : totalTransactions}</span>
                </div>
                <div className="flex items-center gap-1.5 hidden sm:flex">
                  <span className="text-gray-400">Value:</span>
                  <span className="font-semibold text-gray-700">{formatCurrency(totalPipelineValue)}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-400">Profit:</span>
                  <span className="font-semibold text-emerald-600" data-testid="pipeline-total-profit">{formatCurrency(totalPipelineProfit)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 pt-5 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 pb-4">
          {STAGES.map((stage) => {
            const query = stageQueryMap[stage];
            const data = stageDataMap[stage];
            return (
              <PipelineColumn
                key={stage}
                stage={stage}
                transactions={data.items}
                total={data.total}
                totalValue={data.totalValue}
                totalProfit={data.totalProfit}
                getClientName={getClientName}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                isDragActive={dragState.active}
                dragFromStage={dragState.fromStage}
                hasNextPage={!!query.hasNextPage}
                isFetchingNextPage={query.isFetchingNextPage}
                fetchNextPage={query.fetchNextPage}
                isLoading={query.isLoading}
              />
            );
          })}
        </div>

        {dragState.active && <p className="text-center text-xs text-gray-400 animate-pulse pb-2">Drag to a column to move this transaction</p>}
      </div>

      {quoteDialog && (
        <QuoteCreateDialog transactionId={quoteDialog.transactionId} clientId={quoteDialog.clientId} userId={quoteDialog.userId} open={!!quoteDialog} onOpenChange={(open) => { if (!open) setQuoteDialog(null); }} onSuccess={() => { setQuoteDialog(null); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Quote created", description: "Transaction moved to Quoted." }); }} />
      )}

      <Dialog open={!!bookingDialog} onOpenChange={(open) => { if (!open) { setBookingDialog(null); setHaysRef(""); setTourRef(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Enter the booking references to confirm this conversion.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">HAYS Reference</Label>
              <Input value={haysRef} onChange={(e) => setHaysRef(e.target.value)} placeholder="e.g. HAYS-12345" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Tour Reference</Label>
              <Input value={tourRef} onChange={(e) => setTourRef(e.target.value)} placeholder="e.g. TOUR-67890" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <Button className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={convertToBookingMutation.isPending} onClick={() => {
              if (!bookingDialog) return;
              convertToBookingMutation.mutate(
                { quoteId: bookingDialog.quoteId, haysRef, supplierRef: tourRef },
                { onSuccess: () => { setBookingDialog(null); setHaysRef(""); setTourRef(""); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Quote converted to booking" }); }, onError: () => { toast({ title: "Failed to convert", variant: "destructive" }); } }
              );
            }}>
              {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
