import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Filter,
  GripVertical,
  Loader2,
  StickyNote,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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

function stageColor(stage: PipelineStage) {
  switch (stage) {
    case "Enquiry":
      return { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-700", dot: "bg-blue-500", header: "bg-blue-50 border-blue-200", dropHighlight: "ring-2 ring-blue-400 bg-blue-500/10" };
    case "Quoted":
      return { bg: "bg-amber-500/10", border: "border-amber-500/20", text: "text-amber-700", dot: "bg-amber-500", header: "bg-amber-50 border-amber-200", dropHighlight: "ring-2 ring-amber-400 bg-amber-500/10" };
    case "In Play":
      return { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-700", dot: "bg-purple-500", header: "bg-purple-50 border-purple-200", dropHighlight: "ring-2 ring-purple-400 bg-purple-500/10" };
    case "Booked":
      return { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-700", dot: "bg-emerald-500", header: "bg-emerald-50 border-emerald-200", dropHighlight: "ring-2 ring-emerald-400 bg-emerald-500/10" };
  }
}

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

function getTransactionPassengers(transaction: Transaction): { adults: number; children: number; infants: number } {
  if (transaction.enquiry) return { adults: transaction.enquiry.adults || 0, children: transaction.enquiry.children || 0, infants: transaction.enquiry.infants || 0 };
  if (transaction.quotes && transaction.quotes.length > 0) { const q = transaction.quotes[0]; return { adults: q.adult || 0, children: q.child || 0, infants: q.infant || 0 }; }
  if (transaction.booking) return { adults: transaction.booking.adult || 0, children: transaction.booking.child || 0, infants: transaction.booking.infant || 0 };
  return { adults: 0, children: 0, infants: 0 };
}

interface PipelineCardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onDragStart: (transaction: Transaction, stage: PipelineStage) => void;
}

function PipelineCard({ transaction, stage, clientName, onDragStart }: PipelineCardProps) {
  const [, setLocation] = useLocation();
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showCopyQuotes, setShowCopyQuotes] = useState(false);
  const profit = getTransactionProfit(transaction);
  const totalValue = getTransactionValue(transaction);
  const title = getTransactionTitle(transaction);
  const travelDate = getTransactionDate(transaction);
  const passengers = getTransactionPassengers(transaction);
  const colors = stageColor(stage);
  const { data: notes = [] } = useNotes(transaction.id);

  // Count copy quotes (only for Quoted and In Play stages)
  const showCopyIndicator = (stage === "Quoted" || stage === "In Play");
  const copyQuotes = showCopyIndicator && transaction.quotes 
    ? transaction.quotes.filter(q => q.isQuoteCopy === true)
    : [];
  const copyQuoteCount = copyQuotes.length;

  // Determine navigation URL based on stage
  const getNavigationUrl = () => {
    if (!transaction.client_id) return `/pipeline`;

    // Enquiry stage
    if (stage === "Enquiry" && transaction.enquiry) {
      return `/clients/${transaction.client_id}/enquiries/${transaction.enquiry.id}`;
    }

    // Quoted or In Play stages - navigate to first non-copy quote
    if ((stage === "Quoted" || stage === "In Play") && transaction.quotes?.length) {
      const mainQuote = transaction.quotes.find(q => !q.isQuoteCopy) || transaction.quotes[0];
      return `/clients/${transaction.client_id}/quotes/${mainQuote.id}`;
    }

    // Booked stage
    if (stage === "Booked" && transaction.booking) {
      return `/clients/${transaction.client_id}/bookings/${transaction.booking.id}`;
    }

    // Fallback to client page
    return `/clients/${transaction.client_id}`;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ transactionId: transaction.id, fromStage: stage }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    setIsHovered(false);
    onDragStart(transaction, stage);
  };

  const handleDragEnd = () => { setIsDragging(false); };
  const isTouchDevice = typeof window !== "undefined" && "ontouchstart" in window;
  const handleTap = () => { if (!isDragging && isTouchDevice) setIsHovered((prev) => !prev); };

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if dragging or if clicking on interactive elements
    if (isDragging) return;
    const target = e.target as HTMLElement;
    if (target.closest('button')) return;
    
    const url = getNavigationUrl();
    setLocation(url);
  };

  return (
    <div
      className={`relative ${isDragging ? "opacity-40" : ""}`}
      onMouseEnter={() => !isDragging && !isTouchDevice && setIsHovered(true)}
      onMouseLeave={() => !isTouchDevice && setIsHovered(false)}
      onClick={handleTap}
      draggable={!isTouchDevice}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        whileHover={!isDragging ? { y: -2 } : undefined}
        className={`p-3.5 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer transition-shadow hover:shadow-md`}
        data-testid={`pipeline-card-${transaction.id}`}
        onClick={handleCardClick}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-black/20 mt-0.5 flex-shrink-0 cursor-grab active:cursor-grabbing" />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <h4 className="text-sm font-semibold text-black/80 truncate flex-1" data-testid={`pipeline-title-${transaction.id}`}>{title}</h4>
              {copyQuoteCount > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCopyQuotes(!showCopyQuotes);
                  }}
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-700 hover:bg-blue-500/20 transition-colors"
                  title={`${copyQuoteCount} copy quote${copyQuoteCount !== 1 ? 's' : ''}`}
                >
                  <Copy className="h-3 w-3" />
                  <span className="text-[10px] font-semibold">{copyQuoteCount}</span>
                  {showCopyQuotes ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-black/50 mb-1">
              <Users className="h-3 w-3" />
              <span className="truncate" data-testid={`pipeline-client-${transaction.id}`}>{clientName}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-black/50 mb-2">
              <Calendar className="h-3 w-3" />
              <span data-testid={`pipeline-date-${transaction.id}`}>{formatDate(travelDate)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <PoundSterling className="h-3 w-3 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-700" data-testid={`pipeline-profit-${transaction.id}`}>{profit > 0 ? formatCurrency(profit) : "TBC"}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-black/20" />
            </div>
          </div>
        </div>

        {/* Copy Quotes Dropdown */}
        {showCopyQuotes && copyQuoteCount > 0 && (
          <div className="mt-3 pt-3 border-t border-black/10 space-y-2" onClick={(e) => e.stopPropagation()}>
            <p className="text-[10px] uppercase tracking-wider text-black/40 font-semibold mb-2">Copy Quotes</p>
            {copyQuotes.map((quote, idx) => {
              const quoteSalesPrice = parseFloat(quote.sales_price || "0");
              const quoteDiscount = parseFloat(quote.discounts || "0");
              const quoteServiceCharge = parseFloat(quote.service_charge || "0");
              const quoteTotal = quoteSalesPrice - quoteDiscount + quoteServiceCharge;
              const quoteCommission = parseFloat(quote.package_commission || "0");

              return (
                <div 
                  key={quote.id} 
                  className="p-2 rounded-lg bg-white/60 border border-black/5 text-xs hover:bg-white hover:border-black/10 transition-colors cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (transaction.client_id) {
                      setLocation(`/clients/${transaction.client_id}/quotes/${quote.id}`);
                    }
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <span className="font-medium text-black/70 flex-1 truncate">
                      {quote.title || `Copy ${idx + 1}`}
                    </span>
                    
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-black/50 mt-1.5">
                    <div>
                      <span className="text-black/40">Travel:</span> {formatDate(quote.travel_date)}
                    </div>
                    {quoteTotal > 0 && (
                      <div>
                        <span className="text-black/40">Value:</span> {formatCurrency(quoteTotal)}
                      </div>
                    )}
                    {quoteCommission > 0 && (
                      <div>
                        <span className="text-black/40">Profit:</span> {formatCurrency(quoteCommission)}
                      </div>
                    )}
                    {(quote.adult || 0) > 0 && (
                      <div>
                        <span className="text-black/40">Pax:</span> {quote.adult}A
                        {(quote.child || 0) > 0 && ` ${quote.child}C`}
                        {(quote.infant || 0) > 0 && ` ${quote.infant}I`}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {isHovered && !isDragging && (
        <>
          <div className="fixed inset-0 z-40 md:hidden" onClick={(e) => { e.stopPropagation(); setIsHovered(false); }} />
          <div className="fixed inset-x-3 bottom-3 z-50 p-4 rounded-xl border border-black/15 bg-white shadow-2xl md:absolute md:inset-auto md:left-0 md:right-0 md:top-full md:mt-1 md:bottom-auto md:shadow-xl max-h-[70vh] overflow-y-auto" data-testid={`pipeline-hover-${transaction.id}`} onClick={(e) => e.stopPropagation()}>
            <h4 className="font-semibold text-black/90 mb-3">{title}</h4>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Client</p><p className="font-medium text-black/70">{clientName}</p></div>
              <div><p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Travel Date</p><p className="font-medium text-black/70">{formatDate(travelDate)}</p></div>
              {passengers.adults > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Passengers</p>
                  <p className="font-medium text-black/70">
                    {passengers.adults} Adult{passengers.adults !== 1 ? "s" : ""}
                    {passengers.children > 0 && `, ${passengers.children} Child${passengers.children !== 1 ? "ren" : ""}`}
                    {passengers.infants > 0 && `, ${passengers.infants} Infant${passengers.infants !== 1 ? "s" : ""}`}
                  </p>
                </div>
              )}
              {totalValue > 0 && <div><p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Total Value</p><p className="font-semibold text-black/80">{formatCurrency(totalValue)}</p></div>}
              <div><p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Profit</p><p className="font-semibold text-emerald-700">{profit > 0 ? formatCurrency(profit) : "TBC"}</p></div>
            </div>
            <div className="mt-3 pt-2 border-t border-black/10">
              <div className="flex items-center gap-1 mb-1"><StickyNote className="h-3 w-3 text-black/40" /><p className="text-[10px] uppercase tracking-wider text-black/40">Latest Note</p></div>
              {notes.length > 0 ? (
                <><p className="text-xs text-black/60 line-clamp-3 leading-relaxed">{(notes[0].content || notes[0].description || "No content").replace(/<[^>]*>/g, "")}</p><p className="text-[10px] text-black/30 mt-1">{new Date(notes[0].createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</p></>
              ) : (<p className="text-xs text-black/40 italic">No notes yet</p>)}
            </div>
            <div className="mt-3 pt-2 border-t border-black/10">
              <Link
                href={getNavigationUrl()}
                className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
                data-testid={`pipeline-view-${transaction.id}`}
              >
                View details →
              </Link>
            </div>
          </div>
        </>
      )}
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
  const colors = stageColor(stage);
  const isValidTarget = isDragActive && dragFromStage !== stage;

  const localStart = localPage * VISIBLE_PAGE_SIZE;
  const localEnd = localStart + VISIBLE_PAGE_SIZE;
  const visibleItems = stageTransactions.slice(localStart, localEnd);
  const needsMoreData = localEnd >= stageTransactions.length && hasNextPage;
  const canGoNext = localEnd < stageTransactions.length || hasNextPage;
  const canGoPrev = localPage > 0;
  const totalPages = Math.max(1, Math.ceil((hasNextPage ? stageTransactions.length + 1 : stageTransactions.length) / VISIBLE_PAGE_SIZE));

  const handleNext = () => {
    if (needsMoreData && hasNextPage) {
      fetchNextPage();
    }
    setLocalPage((p) => p + 1);
  };

  const handleDragOver = (e: React.DragEvent) => { if (!isValidTarget) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsOver(false); try { const data = JSON.parse(e.dataTransfer.getData("application/json")); if (data.transactionId && data.fromStage !== stage) onDrop(data.transactionId, data.fromStage, stage); } catch {} };

  return (
    <div className="flex flex-col min-h-0" data-testid={`pipeline-column-${stage.toLowerCase()}`}>
      <div className={`rounded-t-2xl border ${colors.header} p-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
          <h3 className={`text-sm font-semibold ${colors.text}`}>{stage}</h3>
          {(stage === "Quoted" || stage === "In Play") && totalValue > 0 && <span className={`text-[11px] font-medium ${colors.text} opacity-70`}>{formatCurrency(totalValue)}&nbsp;/&nbsp;{formatCurrency(totalProfit)}</span>}
        </div>
        <Badge className={`rounded-full text-[10px] ${colors.bg} ${colors.text} ${colors.border}`}>{total}</Badge>
      </div>
      <div className={`flex-1 rounded-b-2xl border border-t-0 p-2 space-y-2 transition-all duration-200 ${isOver ? colors.dropHighlight : isValidTarget ? "border-black/20 bg-black/[0.03]" : "border-black/10 bg-black/[0.015]"}`} style={{ minHeight: "180px" }} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
        {isOver && <div className={`rounded-lg border-2 border-dashed ${colors.border} p-3 text-center`}><p className={`text-xs font-medium ${colors.text}`}>Drop here to move to {stage}</p></div>}
        {isLoading ? (
          <div className="flex items-center justify-center h-full min-h-[180px]"><Spinner /></div>
        ) : stageTransactions.length === 0 && !isOver ? (
          <div className="flex items-center justify-center h-full min-h-[180px]"><p className="text-xs text-black/30">{isDragActive && isValidTarget ? `Drop here` : "No transactions"}</p></div>
        ) : (
          <>
            {visibleItems.map((transaction) => (<PipelineCard key={transaction.id} transaction={transaction} stage={stage} clientName={getClientName(transaction.client_id)} onDragStart={onDragStart} />))}
            {isFetchingNextPage && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-black/30" /></div>}
            {(canGoPrev || canGoNext) && (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  disabled={!canGoPrev}
                  onClick={() => setLocalPage((p) => p - 1)}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-black/50 transition hover:bg-black/[0.05] disabled:opacity-30 disabled:pointer-events-none"
                  data-testid={`button-prev-${stage.toLowerCase()}`}
                >
                  ← Prev
                </button>
                <span className="text-[10px] text-black/35">{localPage + 1} / {totalPages}</span>
                <button
                  type="button"
                  disabled={!canGoNext || isFetchingNextPage}
                  onClick={handleNext}
                  className="rounded-lg px-2.5 py-1 text-[10px] font-semibold text-black/50 transition hover:bg-black/[0.05] disabled:opacity-30 disabled:pointer-events-none"
                  data-testid={`button-next-${stage.toLowerCase()}`}
                >
                  Next →
                </button>
              </div>
            )}
            {!canGoNext && stageTransactions.length > 0 && stageTransactions.length <= VISIBLE_PAGE_SIZE && <p className="text-center text-[10px] text-black/30 py-1">Showing all {stageTransactions.length}</p>}
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
  const [quoteDialog, setQuoteDialog] = useState<{ transactionId: string; clientId: string; userId: string } | null>(null);
  const [bookingDialog, setBookingDialog] = useState<{ quoteId: string } | null>(null);
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");

  // Set default filter: "all" for Admin/Manager, current user for restricted roles
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

  const stageTotals = useMemo(() => ({
    Enquiry: { count: enquiryData.total, profit: enquiryData.totalProfit },
    Quoted: { count: quoteData.total, profit: quoteData.totalProfit },
    "In Play": { count: inPlayData.total, profit: inPlayData.totalProfit },
    Booked: { count: bookingData.total, profit: bookingData.totalProfit },
  }), [enquiryData, quoteData, inPlayData, bookingData]);

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
        onSuccess: () => { toast({ title: `Moved to ${toStage}`, description: `${getTransactionTitle(transaction)} has been updated.` }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
        onError: () => { toast({ title: "Error", description: "Failed to move the transaction. Please try again.", variant: "destructive" }); },
      }
    );
  }, [allLoadedTransactions, updateTransactionMutation, currentUser, toast, queryClient]);

  const handleDragEnd = useCallback(() => { setDragState({ active: false, fromStage: null, transactionId: null }); }, []);

  const isInitialLoading = enquiryQuery.isLoading && quoteQuery.isLoading && inPlayQuery.isLoading && bookingQuery.isLoading;

  const totalPipelineProfit = stageTotals.Enquiry.profit + stageTotals.Quoted.profit + stageTotals["In Play"].profit + stageTotals.Booked.profit;
  const totalTransactions = stageTotals.Enquiry.count + stageTotals.Quoted.count + stageTotals["In Play"].count + stageTotals.Booked.count;

  const stageQueryMap: Record<PipelineStage, typeof enquiryQuery> = { Enquiry: enquiryQuery, Quoted: quoteQuery, "In Play": inPlayQuery, Booked: bookingQuery };
  const stageDataMap: Record<PipelineStage, { items: Transaction[]; total: number; totalProfit: number; totalValue: number }> = { Enquiry: enquiryData, Quoted: quoteData, "In Play": inPlayData, Booked: bookingData };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 sm:space-y-6" onDragEnd={handleDragEnd}>
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
            <SelectTrigger className="h-9 sm:h-10 w-full sm:w-[200px] rounded-2xl border-black/10 bg-black/5 text-black dark:border-white/10 dark:bg-white/5 dark:text-white text-xs sm:text-sm" data-testid="select-quote-status">
              <Filter className="mr-1.5 sm:mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 opacity-60" />
              <SelectValue placeholder="Quote Status" />
            </SelectTrigger>
            <SelectContent>
              {QUOTE_STATUS_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value} data-testid={`select-quote-status-${opt.value}`}>{opt.label}</SelectItem>))}
            </SelectContent>
          </Select>
          {selectedAgentId && (
            <UserReassignSelect value={selectedAgentId} onValueChange={setSelectedAgentId} allowAll allLabel="All Agents" className="w-full sm:w-[190px]" data-testid="select-agent-filter" />
          )}
        </div>

        {/* Stage summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          {STAGES.map((stage) => {
            const colors = stageColor(stage);
            const totals = stageTotals[stage];
            return (
              <Card key={stage} className={`glass ringed grain rounded-2xl p-3 sm:p-4 ${colors.bg} ${colors.border}`} data-testid={`pipeline-summary-${stage.toLowerCase()}`}>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2"><div className={`h-2 w-2 rounded-full ${colors.dot}`} /><span className={`text-[11px] sm:text-xs font-semibold ${colors.text}`}>{stage}</span></div>
                <p className="text-lg sm:text-xl font-bold text-black/80">{totals.count}</p>
                <p className="text-[10px] sm:text-xs text-black/50 mt-1">Profit: <span className="font-semibold text-emerald-700">{formatCurrency(totals.profit)}</span></p>
              </Card>
            );
          })}
        </div>

        {/* Total pipeline card */}
        <Card className="glass ringed grain rounded-2xl p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600" />
              <div><p className="text-xs sm:text-sm font-medium text-black/60">Total Pipeline</p><p className="text-base sm:text-lg font-bold text-black/80">{isInitialLoading ? "Loading…" : `${totalTransactions} transactions`}</p></div>
            </div>
            <div className="text-right"><p className="text-[10px] sm:text-xs text-black/40">Total Profit</p><p className="text-base sm:text-lg font-bold text-emerald-700" data-testid="pipeline-total-profit">{formatCurrency(totalPipelineProfit)}</p></div>
          </div>
        </Card>

        {/* Board columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {STAGES.map((stage) => {
            const query = stageQueryMap[stage];
            const data = stageDataMap[stage];
            return (
              <div key={stage}>
                <PipelineColumn stage={stage} transactions={data.items} total={data.total} totalValue={data.totalValue} totalProfit={data.totalProfit} getClientName={getClientName} onDragStart={handleDragStart} onDrop={handleDrop} isDragActive={dragState.active} dragFromStage={dragState.fromStage} hasNextPage={!!query.hasNextPage} isFetchingNextPage={query.isFetchingNextPage} fetchNextPage={query.fetchNextPage} isLoading={query.isLoading} />
              </div>
            );
          })}
        </div>

        {dragState.active && <p className="text-center text-xs text-black/40 animate-pulse">Drag to a column to move this transaction</p>}
      </motion.div>

      {quoteDialog && (
        <QuoteCreateDialog transactionId={quoteDialog.transactionId} clientId={quoteDialog.clientId} userId={quoteDialog.userId} open={!!quoteDialog} onOpenChange={(open) => { if (!open) setQuoteDialog(null); }} onSuccess={() => { setQuoteDialog(null); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Quote created", description: "Transaction moved to Quoted." }); }} />
      )}

      <Dialog open={!!bookingDialog} onOpenChange={(open) => { if (!open) { setBookingDialog(null); setHaysRef(""); setTourRef(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-black/55">Enter the booking references to confirm this conversion.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
              <Input value={haysRef} onChange={(e) => setHaysRef(e.target.value)} placeholder="e.g. HAYS-12345" className="h-9 rounded-xl border-black/10 bg-white/70" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
              <Input value={tourRef} onChange={(e) => setTourRef(e.target.value)} placeholder="e.g. TOUR-67890" className="h-9 rounded-xl border-black/10 bg-white/70" />
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
