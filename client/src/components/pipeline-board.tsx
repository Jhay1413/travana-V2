import { useState, useMemo, useCallback, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Calendar,
  Copy,
  Filter,
  Loader2,
  PoundSterling,
  TrendingUp,
  Users,
  Search,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Star,
  MapPin,
  Building2,
  Clock,
  Layers,
  SlidersHorizontal,
  X,
  Phone,
  Mail,
  Home,
  Plane,
  Bed,
  ArrowRight,
  ExternalLink,
  Tag,
  Hash,
  FileText,
  ChevronRight,
} from "lucide-react";
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
import { usePipelineColumn, useNeonClients, useNeonClient, useCurrentUser, useTransaction, useNotes, transactionKeys } from "@/hooks/queries";
import { useUpdateTransaction, useConvertToBooking } from "@/hooks/mutations";
import type { NeonClient } from "@/types/neon-client";
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

const STAGE_HEX: Record<PipelineStage, string> = {
  "Enquiry": "#3B82F6",
  "Quoted": "#F59E0B",
  "In Play": "#8B5CF6",
  "Booked": "#10B981",
};

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

function getTransactionValue(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce((s, q) => {
      return s + (parseFloat(q.sales_price || "0") || 0) - (parseFloat(q.discounts || "0") || 0) + (parseFloat(q.service_charge || "0") || 0);
    }, 0);
  }
  if (t.booking) {
    return (parseFloat(t.booking.sales_price || "0") || 0) - (parseFloat(t.booking.discounts || "0") || 0) + (parseFloat(t.booking.service_charge || "0") || 0);
  }
  return 0;
}

function getTransactionProfit(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce((s, q) => {
      const pkg = parseFloat((q as any).package_commission || "0") || 0;
      const svc = parseFloat((q as any).service_commission || "0") || 0;
      return s + pkg + svc;
    }, 0);
  }
  if (t.booking) {
    return parseFloat(t.booking.package_commission || "0") || 0;
  }
  return 0;
}

function getTransactionTitle(t: Transaction): string {
  return t.enquiry?.title || t.quotes?.[0]?.title || t.booking?.title || `#${t.id.slice(0, 8)}`;
}

function getTransactionDate(t: Transaction): string | null {
  return t.enquiry?.travel_date || t.quotes?.[0]?.travel_date || t.booking?.travel_date || t.created_at;
}

function getPax(t: Transaction): string {
  let a = 0, c = 0, i = 0;
  if (t.enquiry) { a = t.enquiry.adults || 0; c = t.enquiry.children || 0; i = t.enquiry.infants || 0; }
  else if (t.quotes?.[0]) { const q = t.quotes[0]; a = q.adult || 0; c = q.child || 0; i = q.infant || 0; }
  else if (t.booking) { a = t.booking.adult || 0; c = t.booking.child || 0; i = t.booking.infant || 0; }
  const p: string[] = [];
  if (a > 0) p.push(`${a}A`);
  if (c > 0) p.push(`${c}C`);
  if (i > 0) p.push(`${i}I`);
  return p.join(" ") || "—";
}

function getDest(t: Transaction): { dest: string; country: string } {
  const q0 = t.quotes?.[0] as any;
  const bk = t.booking as any;
  const dest = q0?.destination || bk?.destination || (t.enquiry as any)?.destination || "TBC";
  const country = q0?.country || bk?.country || (t.enquiry as any)?.country || "";
  return { dest, country };
}

function getTourOp(t: Transaction): string | null {
  return (t.quotes?.[0] as any)?.main_tour_operator_name || (t.booking as any)?.main_tour_operator_name || null;
}

function getTimeAgo(d: string | null | undefined): string {
  if (!d) return "";
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getAgentInitial(t: Transaction): string {
  return (t as any).assignedUser?.firstName?.[0]?.toUpperCase() || "?";
}

function getAgentName(t: Transaction): string {
  const u = (t as any).assignedUser;
  return u?.firstName || u?.username || "Unassigned";
}

interface CardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onDragStart: (t: Transaction, s: PipelineStage) => void;
  onCardClick: (t: Transaction, s: PipelineStage) => void;
}

function DealCard({ transaction: t, stage, clientName, onDragStart, onCardClick }: CardProps) {
  const [, setLocation] = useLocation();
  const [isDragging, setIsDragging] = useState(false);
  const profit = getTransactionProfit(t);
  const value = getTransactionValue(t);
  const { dest, country } = getDest(t);
  const tourOp = getTourOp(t);
  const quoteCount = t.quotes?.length || 0;
  const quoteStatus = (t.quotes?.[0] as any)?.quote_status || null;
  const hex = STAGE_HEX[stage];

  const navUrl = () => {
    if (!t.client_id) return "/pipeline";
    if (stage === "Enquiry" && t.enquiry) return `/clients/${t.client_id}/enquiries/${t.enquiry.id}`;
    if ((stage === "Quoted" || stage === "In Play") && t.quotes?.length) {
      const main = t.quotes.find(q => !q.isQuoteCopy) || t.quotes[0];
      return `/clients/${t.client_id}/quotes/${main.id}`;
    }
    if (stage === "Booked" && t.booking) return `/clients/${t.client_id}/bookings/${t.booking.id}`;
    return `/clients/${t.client_id}`;
  };

  const statusStyle: Record<string, string> = {
    AWAITING_DECISION: "bg-amber-50 text-amber-600",
    QUOTE_READY: "bg-blue-50 text-blue-600",
    QUOTE_IN_PROGRESS: "bg-gray-100 text-gray-500",
    QUOTE_CALL: "bg-purple-50 text-purple-600",
    NEW_LEAD: "bg-sky-50 text-sky-600",
    REQUOTE: "bg-orange-50 text-orange-600",
    WON: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div
      className={`group/card bg-white rounded-xl border border-gray-100 shadow-sm relative cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 transition-all duration-200 active:scale-[1.02] ${isDragging ? "opacity-40" : ""}`}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("application/json", JSON.stringify({ transactionId: t.id, fromStage: stage }));
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
        onDragStart(t, stage);
      }}
      onDragEnd={() => setIsDragging(false)}
      onClick={(e) => { if (isDragging || (e.target as HTMLElement).closest("button")) return; onCardClick(t, stage); }}
      data-testid={`pipeline-card-${t.id}`}
    >
      <div className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full" style={{ backgroundColor: hex }} />
      <div className="p-3.5 pl-4">
        {/* Row 1: Client name + time ago */}
        <div className="flex items-start justify-between mb-1">
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-[13px] text-gray-900 truncate" data-testid={`pipeline-title-${t.id}`}>{clientName}</h4>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0 ml-2">
            <span className="text-[11px] text-gray-400">{getTimeAgo(t.created_at)}</span>
            <div className="flex items-center gap-0.5 opacity-0 group-hover/card:opacity-100 transition-opacity">
              <button className="p-1 rounded-md hover:bg-gray-100" onClick={(e) => { e.stopPropagation(); setLocation(navUrl()); }}><Eye className="w-3.5 h-3.5 text-gray-400" /></button>
              <button className="p-1 rounded-md hover:bg-gray-100" onClick={(e) => e.stopPropagation()}><MoreHorizontal className="w-3.5 h-3.5 text-gray-400" /></button>
            </div>
          </div>
        </div>

        {/* Row 2: Title + destination */}
        <p className="text-[12px] text-gray-500 truncate font-medium">{getTransactionTitle(t)}</p>
        {dest !== "TBC" && (
          <div className="flex items-center gap-1 mt-0.5">
            <MapPin className="w-3 h-3 text-gray-400 flex-shrink-0" />
            <span className="text-[12px] text-gray-500 truncate">{dest}</span>
            {country && country !== dest && <span className="text-[11px] text-gray-400">· {country}</span>}
          </div>
        )}

        {/* Row 3: Value + potential profit */}
        <div className="flex items-center gap-2 mt-1.5 mb-1.5">
          <div className="flex items-center gap-1">
            <span className="text-gray-400 text-[13px]">£</span>
            <span className="font-semibold text-[13px] text-gray-900">{value > 0 ? formatCurrency(profit) : "TBC"}</span>
          </div>
          {profit > 0 && (stage === "Quoted" || stage === "In Play") && (
            <span className="text-[11px] font-medium text-emerald-600">
              Profit: {formatCurrency(profit)}
            </span>
          )}
          {profit > 0 && stage === "Booked" && (
            <span className="text-[11px] font-medium text-emerald-600">
              Profit: {formatCurrency(profit)}
            </span>
          )}
        </div>

        {/* Row 4: Footer — agent + tour op + quotes + arrow */}
        <div className="flex items-center justify-between pt-1.5 border-t border-gray-50">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center flex-shrink-0">
                <span className="text-[9px] text-white font-medium">{getAgentInitial(t)}</span>
              </div>
              <span className="text-[11px] text-gray-500">{getAgentName(t)}</span>
            </div>
            {tourOp && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] text-gray-500 truncate max-w-[100px]">{tourOp}</span>
              </>
            )}
            {quoteCount > 0 && (stage === "Quoted" || stage === "In Play") && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] text-gray-500">{quoteCount} quote{quoteCount > 1 ? "s" : ""}</span>
              </>
            )}
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 ml-1" />
        </div>
      </div>
    </div>
  );
}

interface ColProps {
  stage: PipelineStage;
  transactions: Transaction[];
  total: number;
  totalValue: number;
  totalProfit: number;
  getClientName: (id: string | null) => string;
  onDragStart: (t: Transaction, s: PipelineStage) => void;
  onDrop: (id: string, from: PipelineStage, to: PipelineStage) => void;
  onCardClick: (t: Transaction, s: PipelineStage) => void;
  isDragActive: boolean;
  dragFromStage: PipelineStage | null;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => void;
  isLoading: boolean;
}

const PAGE_SIZE = 10;

function StageColumn({ stage, transactions, total, totalValue, totalProfit, getClientName, onDragStart, onDrop, onCardClick, isDragActive, dragFromStage, hasNextPage, isFetchingNextPage, fetchNextPage, isLoading }: ColProps) {
  const [isOver, setIsOver] = useState(false);
  const [page, setPage] = useState(0);
  const hex = STAGE_HEX[stage];
  const isTarget = isDragActive && dragFromStage !== stage;
  const progress = Math.min((total / 20) * 100, 100);

  const start = page * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visible = transactions.slice(start, end);
  const canNext = end < transactions.length || hasNextPage;
  const canPrev = page > 0;

  return (
    <div
      className="flex flex-col min-w-[280px] max-w-[320px] flex-1"
      onDragOver={(e) => { if (!isTarget) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; setIsOver(true); }}
      onDragLeave={(e) => { if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsOver(false); }}
      onDrop={(e) => {
        e.preventDefault(); setIsOver(false);
        try { const d = JSON.parse(e.dataTransfer.getData("application/json")); if (d.transactionId && d.fromStage !== stage) onDrop(d.transactionId, d.fromStage, stage); } catch {}
      }}
      data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}`}
    >
      {/* Column header */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hex }} />
            <h3 className="font-semibold text-sm text-gray-800">{stage}</h3>
            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full font-medium">{total}</span>
          </div>
          <button className="p-1 rounded-md hover:bg-gray-100"><Plus className="w-3.5 h-3.5 text-gray-400" /></button>
        </div>
        <div className="h-1 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, backgroundColor: hex }} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-gray-700">{formatCurrency(totalProfit)}</span>
          {(stage === "Quoted" || stage === "In Play") && (
            <span className="text-[11px] text-emerald-600 font-medium">
              Potential: {formatCurrency(totalProfit * (stage === "Quoted" ? 0.2 : 0.28))}
            </span>
          )}
          {(stage === "Enquiry" || stage === "Booked") && (
            <span className="text-[11px] text-emerald-600 font-medium">Profit: {formatCurrency(totalProfit)}</span>
          )}
        </div>
      </div>

      {/* Cards */}
      <div
        className={`flex-1 space-y-2.5 overflow-y-auto pb-4 pr-1 transition-colors duration-200 ${isOver ? "bg-blue-50/60 rounded-xl" : ""}`}
        style={{ maxHeight: "calc(100vh - 200px)" }}
      >
        {isOver && (
          <div className="rounded-lg border-2 border-dashed border-blue-300 p-3 text-center">
            <p className="text-xs font-medium text-blue-500">Drop here to move to {stage}</p>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : transactions.length === 0 && !isOver ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-xs text-gray-400">{isTarget ? "Drop here" : "No transactions"}</p>
          </div>
        ) : (
          <>
            {visible.map((tx) => (
              <DealCard key={tx.id} transaction={tx} stage={stage} clientName={getClientName(tx.client_id)} onDragStart={onDragStart} onCardClick={onCardClick} />
            ))}
            {isFetchingNextPage && <div className="flex justify-center py-2"><Loader2 className="h-4 w-4 animate-spin text-gray-300" /></div>}
            {(canPrev || canNext) && (
              <div className="flex items-center justify-between pt-1">
                <button disabled={!canPrev} onClick={() => setPage(p => p - 1)} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" data-testid={`button-prev-${stage.toLowerCase()}`}>← Prev</button>
                <button disabled={!canNext || isFetchingNextPage} onClick={() => { if (end >= transactions.length && hasNextPage) fetchNextPage(); setPage(p => p + 1); }} className="px-2.5 py-1 text-[10px] font-semibold text-gray-500 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:pointer-events-none" data-testid={`button-next-${stage.toLowerCase()}`}>Next →</button>
              </div>
            )}
            <button className="w-full py-2.5 border border-dashed border-gray-200 rounded-xl text-[12px] text-gray-400 hover:text-gray-600 hover:border-gray-300 hover:bg-gray-50 transition-all flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add deal
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface DetailPanelProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onClose: () => void;
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: any }) {
  if (!value || value === "NULL") return null;
  return (
    <div className="flex items-start gap-2.5 py-2">
      {Icon && <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />}
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{label}</p>
        <p className="text-[13px] text-gray-800 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2 mt-5 mb-2">
      <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{title}</h4>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function TransactionDetailPanel({ transaction: t, stage, clientName, onClose }: DetailPanelProps) {
  const [, setLocation] = useLocation();
  const { data: client } = useNeonClient(t.client_id || "");
  const { data: fullTx } = useTransaction(t.id);
  const { data: notes } = useNotes(t.id);
  const tx = fullTx || t;
  const value = getTransactionValue(tx);
  const profit = getTransactionProfit(tx);
  const { dest, country } = getDest(tx);
  const tourOp = getTourOp(tx);
  const hex = STAGE_HEX[stage];

  const navUrl = () => {
    if (!t.client_id) return "/pipeline";
    if (stage === "Enquiry" && t.enquiry) return `/clients/${t.client_id}/enquiries/${t.enquiry.id}`;
    if ((stage === "Quoted" || stage === "In Play") && t.quotes?.length) {
      const main = t.quotes.find(q => !q.isQuoteCopy) || t.quotes[0];
      return `/clients/${t.client_id}/quotes/${main.id}`;
    }
    if (stage === "Booked" && t.booking) return `/clients/${t.client_id}/bookings/${t.booking.id}`;
    return `/clients/${t.client_id}`;
  };

  const enquiry = t.enquiry;
  const quote = t.quotes?.[0];
  const booking = t.booking;

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-[500] transition-opacity" onClick={onClose} data-testid="panel-backdrop" />
      <div className="fixed top-0 right-0 bottom-0 w-[420px] bg-white z-[501] shadow-2xl border-l border-gray-200 flex flex-col animate-in slide-in-from-right duration-300" data-testid="transaction-detail-panel">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: hex }} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{stage}</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => { onClose(); setLocation(navUrl()); }} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-open-full">
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors" data-testid="button-close-panel">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <h3 className="text-lg font-bold text-gray-900 mb-0.5">{clientName}</h3>
          {client?.phoneNumber && client.phoneNumber !== "NULL" && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-sm text-gray-600">{client.phoneNumber}</span>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3 mb-1">
            <div className="flex items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-lg">
              <span className="text-gray-400 text-sm">£</span>
              <span className="font-bold text-sm text-gray-900">{value > 0 ? formatCurrency(value) : "TBC"}</span>
            </div>
            {profit > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-lg">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-sm font-semibold text-emerald-600">{formatCurrency(profit)}</span>
              </div>
            )}
          </div>

          {(() => {
            const quote = tx.quotes?.find(q => !q.isQuoteCopy) || tx.quotes?.[0];
            const booking = tx.booking;
            const enquiry = tx.enquiry;
            const title = quote?.title || booking?.title || enquiry?.title || null;
            const accom = quote?.accommodations?.[0] || booking?.accommodations?.[0];
            const accomDest = (accom as any)?.destination_name || null;
            const accomResort = (accom as any)?.resort_name || null;
            const resort = accomDest || accomResort || (dest !== "TBC" ? dest : null);
            const costPP = quote?.price_per_person ? `£${parseFloat(quote.price_per_person).toLocaleString()}` : booking?.sales_price && getPax(tx) ? `£${Math.round(parseFloat(booking.sales_price) / parseInt(getPax(tx) || "1")).toLocaleString()}` : null;
            const hotel = (accom as any)?.accomodation_name || null;
            const roomType = (accom as any)?.room_type_name || null;
            const boardBasis = (accom as any)?.board_basis_name || null;
            const pax = getPax(tx);
            const nights = quote?.num_of_nights?.toString() || booking?.num_of_nights?.toString() || enquiry?.no_of_nights?.toString() || null;
            const departure = formatDate(quote?.travel_date || booking?.travel_date || enquiry?.travel_date);
            const sectionTitle = booking ? "Booking Details" : quote ? "Quote Details" : "Enquiry Details";

            const cells: { label: string; val: string | null | undefined }[] = [
              { label: "Title", val: title },
              { label: "Resort", val: resort },
              { label: "Cost Per Person", val: costPP },
              { label: "Hotel", val: hotel },
              { label: "Room Type", val: roomType },
              { label: "Board Basis", val: boardBasis },
              { label: "Passengers", val: pax },
              { label: "Nights", val: nights },
              { label: "Departure", val: departure },
            ];

            return (
              <>
                <SectionHeader title={sectionTitle} />
                <div className="bg-gray-50 rounded-xl p-3.5">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
                    {cells.map(c => (
                      <div key={c.label}>
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium">{c.label}</p>
                        <p className="text-[13px] text-gray-800 mt-0.5 truncate font-semibold">{c.val || "—"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}

          <SectionHeader title="Notes" />
          {notes && notes.filter(n => !n.parent_id).length > 0 ? (
            <div className="space-y-2">
              {notes.filter(n => !n.parent_id).slice(0, 5).map(n => (
                <div key={n.id} className="bg-amber-50/40 rounded-xl p-3">
                  <p className="text-[13px] text-gray-700 whitespace-pre-wrap line-clamp-3">{(n.content || "").replace(/<[^>]*>/g, "")}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-gray-400">
                    <span>{(n as any).created_by_name || (n as any).description || "Agent"}</span>
                    <span>·</span>
                    <span>{getTimeAgo(n.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl p-3.5 text-center">
              <p className="text-[13px] text-gray-400">No notes yet</p>
            </div>
          )}

          <div className="mt-4 mb-6 flex items-center gap-2 text-[11px] text-gray-400">
            <Clock className="w-3 h-3" />
            <span>Last updated {getTimeAgo(tx.created_at)}</span>
            <span>·</span>
            <span>Agent: {getAgentName(tx)}</span>
          </div>
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <Button onClick={() => { onClose(); setLocation(navUrl()); }} className="w-full h-9 rounded-xl bg-gray-900 text-white hover:bg-gray-800 text-sm font-medium" data-testid="button-view-full-details">
            <ExternalLink className="w-3.5 h-3.5 mr-2" />View Full Details
          </Button>
        </div>
      </div>
    </>
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
  const [activeFilter, setActiveFilter] = useState<"all" | "mine">("all");
  const [showFilters, setShowFilters] = useState(false);
  const [quoteDialog, setQuoteDialog] = useState<{ transactionId: string; clientId: string; userId: string } | null>(null);
  const [bookingDialog, setBookingDialog] = useState<{ quoteId: string } | null>(null);
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<{ transaction: Transaction; stage: PipelineStage } | null>(null);

  useEffect(() => {
    if (currentUser?.id && !selectedAgentId) {
      const restricted = currentUser.role !== "Admin" && currentUser.role !== "Manager";
      setSelectedAgentId(restricted ? currentUser.id : "all");
    }
  }, [currentUser?.id, currentUser?.role, selectedAgentId]);

  const agentFilter = selectedAgentId && selectedAgentId !== "all" ? selectedAgentId : undefined;
  const quoteStatusParam = quoteStatusFilter !== "all" ? quoteStatusFilter : undefined;

  const enquiryQ = usePipelineColumn("enquiry", PIPELINE_PAGE_SIZE, agentFilter);
  const quoteQ = usePipelineColumn("quote", PIPELINE_PAGE_SIZE, agentFilter, quoteStatusParam);
  const inPlayQ = usePipelineColumn("in_play", PIPELINE_PAGE_SIZE, agentFilter);
  const bookingQ = usePipelineColumn("booking", PIPELINE_PAGE_SIZE, agentFilter);

  const flatten = (q: typeof enquiryQ) => {
    if (!q.data?.pages) return { items: [] as Transaction[], total: 0, totalProfit: 0, totalValue: 0 };
    return { items: q.data.pages.flatMap(p => p.items), total: q.data.pages[0]?.total || 0, totalProfit: q.data.pages[0]?.totalProfit || 0, totalValue: q.data.pages[0]?.totalValue || 0 };
  };

  const eD = flatten(enquiryQ), qD = flatten(quoteQ), iD = flatten(inPlayQ), bD = flatten(bookingQ);

  const [dragState, setDragState] = useState<{ active: boolean; fromStage: PipelineStage | null }>({ active: false, fromStage: null });

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    if (neonClientsData?.clients) {
      for (const c of neonClientsData.clients) {
        const t = c.title && c.title !== "NULL" ? c.title : "";
        m.set(c.id, [t, c.firstName, c.surename].filter(Boolean).join(" "));
      }
    }
    return m;
  }, [neonClientsData]);

  const getName = (id: string | null) => id ? (clientMap.get(id) || "Unknown Client") : "Unknown Client";

  const handleDragStart = useCallback((t: Transaction, s: PipelineStage) => {
    setDragState({ active: true, fromStage: s });
  }, []);

  const handleCardClick = useCallback((t: Transaction, s: PipelineStage) => {
    setSelectedDeal({ transaction: t, stage: s });
  }, []);

  const allTx = useMemo(() => [...eD.items, ...qD.items, ...iD.items, ...bD.items], [eD.items, qD.items, iD.items, bD.items]);

  const handleDrop = useCallback((txId: string, from: PipelineStage, to: PipelineStage) => {
    setDragState({ active: false, fromStage: null });
    if (from === to) return;
    const tx = allTx.find(t => t.id === txId);
    if (!tx) return;
    if (from === "Enquiry" && to === "Quoted") { setQuoteDialog({ transactionId: txId, clientId: tx.client_id || "", userId: tx.user_id || currentUser?.id || "" }); return; }
    if (from === "Quoted" && to === "Booked") {
      const aq = (tx.quotes || []).find((q: any) => !q.isFreeQuote);
      if (!aq) { toast({ title: "No quote found", variant: "destructive" }); return; }
      setHaysRef(""); setTourRef(""); setBookingDialog({ quoteId: aq.id }); return;
    }
    updateTransactionMutation.mutate(
      { id: txId, data: { status: STAGE_TO_STATUS[to] } as any },
      {
        onSuccess: () => { toast({ title: `Moved to ${to}` }); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); },
        onError: () => { toast({ title: "Error moving transaction", variant: "destructive" }); },
      }
    );
  }, [allTx, updateTransactionMutation, currentUser, toast, queryClient]);

  const isLoading = enquiryQ.isLoading && quoteQ.isLoading && inPlayQ.isLoading && bookingQ.isLoading;
  const totalDeals = eD.total + qD.total + iD.total + bD.total;
  const totalVal = eD.totalValue + qD.totalValue + iD.totalValue + bD.totalValue;
  const totalProf = eD.totalProfit + qD.totalProfit + iD.totalProfit + bD.totalProfit;

  const qMap: Record<PipelineStage, typeof enquiryQ> = { Enquiry: enquiryQ, Quoted: quoteQ, "In Play": inPlayQ, Booked: bookingQ };
  const dMap: Record<PipelineStage, ReturnType<typeof flatten>> = { Enquiry: eD, Quoted: qD, "In Play": iD, Booked: bD };

  return (
    <>
      <div className="min-h-0" style={{ background: "#FAFBFC" }} onDragEnd={() => setDragState({ active: false, fromStage: null })}>
        {/* ─── Header ─── */}
        <div className="border-b border-gray-200 bg-white -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="py-3">
            {/* Top row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Pipeline</h2>
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
                  <button className="px-3 py-1.5 rounded-md text-xs font-medium bg-white text-gray-900 shadow-sm">Board</button>
                  <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700">List</button>
                  <button className="px-3 py-1.5 rounded-md text-xs font-medium text-gray-500 hover:text-gray-700">Forecast</button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="Search deals..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-gray-50 placeholder:text-gray-400" data-testid="input-pipeline-search" />
                </div>
                <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded-lg transition-colors ${showFilters ? "border-blue-300 bg-blue-50 text-blue-600" : "text-gray-600 border-gray-200 hover:bg-gray-50"}`} data-testid="button-toggle-filters">
                  <SlidersHorizontal className="w-3.5 h-3.5" />Filters
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
                  Reports
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm">
                  <Plus className="w-4 h-4" />New Deal
                </button>
              </div>
            </div>

            {/* Filter row (expandable) */}
            {showFilters && (
              <div className="flex flex-wrap items-center gap-3 py-2 mb-2 border-t border-gray-100">
                <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
                  <SelectTrigger className="h-8 w-[180px] rounded-lg border-gray-200 bg-white text-xs" data-testid="select-quote-status">
                    <Filter className="mr-1.5 h-3.5 w-3.5 opacity-60" /><SelectValue placeholder="Quote Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUOTE_STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value} data-testid={`select-quote-status-${o.value}`}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {selectedAgentId && <UserReassignSelect value={selectedAgentId} onValueChange={setSelectedAgentId} allowAll allLabel="All Agents" className="w-[180px]" data-testid="select-agent-filter" />}
              </div>
            )}

            {/* Bottom row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {(["all", "mine"] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => { setActiveFilter(f); if (f === "mine" && currentUser?.id) setSelectedAgentId(currentUser.id); else setSelectedAgentId("all"); }}
                      className={`px-3 py-1 text-xs rounded-full font-medium transition-all ${activeFilter === f ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"}`}
                      data-testid={`button-filter-${f}`}
                    >
                      {f === "all" ? "All Deals" : "My Deals"}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-gray-300">|</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500">Agent:</span>
                  {selectedAgentId && <UserReassignSelect value={selectedAgentId} onValueChange={setSelectedAgentId} allowAll allLabel="All Agents" className="w-[140px] h-7 text-xs" data-testid="select-agent-inline" />}
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="text-gray-400">Deals:</span><span className="font-semibold text-gray-700" data-testid="pipeline-total-deals">{isLoading ? "…" : totalDeals}</span></div>
                <div className="hidden sm:flex items-center gap-1.5"><span className="text-gray-400">Total Value:</span><span className="font-semibold text-gray-700">{formatCurrency(totalVal)}</span></div>
                <div className="flex items-center gap-1.5"><span className="text-gray-400">Total Profit:</span><span className="font-semibold text-emerald-600" data-testid="pipeline-total-profit">{formatCurrency(totalProf)}</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Board ─── */}
        <div className="flex gap-4 p-5 overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
          {STAGES.map(s => {
            const q = qMap[s], d = dMap[s];
            return (
              <StageColumn
                key={s}
                stage={s}
                transactions={d.items}
                total={d.total}
                totalValue={d.totalValue}
                totalProfit={d.totalProfit}
                getClientName={getName}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onCardClick={handleCardClick}
                isDragActive={dragState.active}
                dragFromStage={dragState.fromStage}
                hasNextPage={!!q.hasNextPage}
                isFetchingNextPage={q.isFetchingNextPage}
                fetchNextPage={q.fetchNextPage}
                isLoading={q.isLoading}
              />
            );
          })}
        </div>

        {dragState.active && <p className="text-center text-xs text-gray-400 animate-pulse pb-2">Drag to a column to move this transaction</p>}
      </div>

      {/* ─── Dialogs ─── */}
      {quoteDialog && (
        <QuoteCreateDialog transactionId={quoteDialog.transactionId} clientId={quoteDialog.clientId} userId={quoteDialog.userId} open={!!quoteDialog} onOpenChange={o => { if (!o) setQuoteDialog(null); }} onSuccess={() => { setQuoteDialog(null); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Quote created" }); }} />
      )}

      <Dialog open={!!bookingDialog} onOpenChange={o => { if (!o) { setBookingDialog(null); setHaysRef(""); setTourRef(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl border-gray-200 bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">Enter the booking references to confirm.</DialogDescription>
          </DialogHeader>
          <div className="mt-3 grid gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">HAYS Reference</Label>
              <Input value={haysRef} onChange={e => setHaysRef(e.target.value)} placeholder="e.g. HAYS-12345" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Tour Reference</Label>
              <Input value={tourRef} onChange={e => setTourRef(e.target.value)} placeholder="e.g. TOUR-67890" className="h-9 rounded-xl border-gray-200 bg-gray-50" />
            </div>
            <Button className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90" disabled={convertToBookingMutation.isPending} onClick={() => {
              if (!bookingDialog) return;
              convertToBookingMutation.mutate(
                { quoteId: bookingDialog.quoteId, haysRef, supplierRef: tourRef },
                { onSuccess: () => { setBookingDialog(null); setHaysRef(""); setTourRef(""); queryClient.invalidateQueries({ queryKey: transactionKeys.all }); toast({ title: "Converted to booking" }); }, onError: () => { toast({ title: "Failed to convert", variant: "destructive" }); } }
              );
            }}>
              {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedDeal && (
        <TransactionDetailPanel
          transaction={selectedDeal.transaction}
          stage={selectedDeal.stage}
          clientName={getName(selectedDeal.transaction.client_id)}
          onClose={() => setSelectedDeal(null)}
        />
      )}
    </>
  );
}
