import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  Calendar,
  ChevronRight,
  Filter,
  GripVertical,
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
import { usePipelineTransactions, useNeonClients, useCurrentUser, transactionKeys } from "@/hooks/queries";
import { useUpdateTransaction, useConvertToBooking } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { UserReassignSelect } from "@/components/ui/user-reassign-select";
import { QuoteCreateDialog } from "@/components/quote-create-dialog";
import type { Transaction } from "@/types/quote";

type PipelineStage = "Enquiry" | "Quoted" | "Booked";

const STAGES: PipelineStage[] = ["Enquiry", "Quoted", "Booked"];

const STAGE_TO_STATUS: Record<PipelineStage, string> = {
  "Enquiry": "on_enquiry",
  "Quoted": "on_quote",
  "Booked": "on_booking",
};

const STATUS_TO_STAGE: Record<string, PipelineStage> = {
  "on_enquiry": "Enquiry",
  "on_quote": "Quoted",
  "on_booking": "Booked",
};

function stageColor(stage: PipelineStage) {
  switch (stage) {
    case "Enquiry":
      return {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        text: "text-blue-700",
        dot: "bg-blue-500",
        header: "bg-blue-50 border-blue-200",
        dropHighlight: "ring-2 ring-blue-400 bg-blue-500/10",
      };
    case "Quoted":
      return {
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        text: "text-amber-700",
        dot: "bg-amber-500",
        header: "bg-amber-50 border-amber-200",
        dropHighlight: "ring-2 ring-amber-400 bg-amber-500/10",
      };
    case "Booked":
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
        header: "bg-emerald-50 border-emerald-200",
        dropHighlight: "ring-2 ring-emerald-400 bg-emerald-500/10",
      };
  }
}

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "No date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getTransactionValue(transaction: Transaction): number {
  if (transaction.quotes && transaction.quotes.length > 0) {
    return transaction.quotes.reduce((sum, q) => {
      return sum + (parseFloat(q.sales_price || "0") || 0);
    }, 0);
  }
  if (transaction.booking) {
    return parseFloat(transaction.booking.sales_price || "0") || 0;
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
  if (transaction.quotes && transaction.quotes.length > 0 && transaction.quotes[0].title) {
    return transaction.quotes[0].title;
  }
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
  if (transaction.enquiry) {
    return {
      adults: transaction.enquiry.adults || 0,
      children: transaction.enquiry.children || 0,
      infants: transaction.enquiry.infants || 0,
    };
  }
  if (transaction.quotes && transaction.quotes.length > 0) {
    const q = transaction.quotes[0];
    return {
      adults: q.adult || 0,
      children: q.child || 0,
      infants: q.infant || 0,
    };
  }
  if (transaction.booking) {
    return {
      adults: transaction.booking.adult || 0,
      children: transaction.booking.child || 0,
      infants: transaction.booking.infant || 0,
    };
  }
  return { adults: 0, children: 0, infants: 0 };
}

function classifyTransaction(transaction: Transaction): PipelineStage {
  const status = transaction.status || "on_enquiry";
  return STATUS_TO_STAGE[status] || "Enquiry";
}

interface PipelineCardProps {
  transaction: Transaction;
  stage: PipelineStage;
  clientName: string;
  onDragStart: (transaction: Transaction, stage: PipelineStage) => void;
}

function PipelineCard({ transaction, stage, clientName, onDragStart }: PipelineCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const profit = getTransactionProfit(transaction);
  const totalValue = getTransactionValue(transaction);
  const title = getTransactionTitle(transaction);
  const travelDate = getTransactionDate(transaction);
  const passengers = getTransactionPassengers(transaction);
  const colors = stageColor(stage);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ transactionId: transaction.id, fromStage: stage }));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
    setIsHovered(false);
    onDragStart(transaction, stage);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      className={`relative ${isDragging ? "opacity-40" : ""}`}
      onMouseEnter={() => !isDragging && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div
        whileHover={!isDragging ? { y: -2 } : undefined}
        className={`p-3.5 rounded-xl border ${colors.border} ${colors.bg} cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md`}
        data-testid={`pipeline-card-${transaction.id}`}
      >
        <div className="flex items-start gap-2">
          <GripVertical className="h-4 w-4 text-black/20 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-black/80 truncate mb-1.5" data-testid={`pipeline-title-${transaction.id}`}>
              {title}
            </h4>
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
                <span className="text-sm font-semibold text-emerald-700" data-testid={`pipeline-profit-${transaction.id}`}>
                  {profit > 0 ? formatCurrency(profit) : "TBC"}
                </span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-black/20" />
            </div>
          </div>
        </div>
      </motion.div>

      {isHovered && !isDragging && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 p-4 rounded-xl border border-black/15 bg-white shadow-xl"
          data-testid={`pipeline-hover-${transaction.id}`}
        >
          <h4 className="font-semibold text-black/90 mb-3">{title}</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Client</p>
              <p className="font-medium text-black/70">{clientName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Travel Date</p>
              <p className="font-medium text-black/70">{formatDate(travelDate)}</p>
            </div>
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
            {totalValue > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Total Value</p>
                <p className="font-semibold text-black/80">{formatCurrency(totalValue)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Profit</p>
              <p className="font-semibold text-emerald-700">
                {profit > 0 ? formatCurrency(profit) : "TBC"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Status</p>
              <p className="font-medium text-black/70">{stage}</p>
            </div>
            {transaction.lead_source && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Lead Source</p>
                <p className="font-medium text-black/70">{transaction.lead_source}</p>
              </div>
            )}
          </div>
          <div className="mt-3 pt-2 border-t border-black/10">
            <Link
              href={`/transactions/${transaction.id}`}
              className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors"
              data-testid={`pipeline-view-${transaction.id}`}
            >
              View details →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

interface PipelineColumnProps {
  stage: PipelineStage;
  transactions: Transaction[];
  getClientName: (clientId: string | null) => string;
  onDragStart: (transaction: Transaction, stage: PipelineStage) => void;
  onDrop: (transactionId: string, fromStage: PipelineStage, toStage: PipelineStage) => void;
  isDragActive: boolean;
  dragFromStage: PipelineStage | null;
}

const COLUMN_PAGE_SIZE = 10;

function PipelineColumn({ stage, transactions: stageTransactions, getClientName, onDragStart, onDrop, isDragActive, dragFromStage }: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const [displayCount, setDisplayCount] = useState(COLUMN_PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const colors = stageColor(stage);
  const isValidTarget = isDragActive && dragFromStage !== stage;

  // Reset display count when the transaction list changes (e.g. filter applied)
  useEffect(() => {
    setDisplayCount(COLUMN_PAGE_SIZE);
  }, [stageTransactions]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < stageTransactions.length) {
          setDisplayCount((prev) => Math.min(prev + COLUMN_PAGE_SIZE, stageTransactions.length));
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayCount, stageTransactions.length]);

  const visibleTransactions = stageTransactions.slice(0, displayCount);

  const handleDragOver = (e: React.DragEvent) => {
    if (!isValidTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      if (data.transactionId && data.fromStage !== stage) {
        onDrop(data.transactionId, data.fromStage, stage);
      }
    } catch {}
  };

  return (
    <div className="flex flex-col" data-testid={`pipeline-column-${stage.toLowerCase()}`}>
      <div className={`rounded-t-2xl border ${colors.header} p-3 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
          <h3 className={`text-sm font-semibold ${colors.text}`}>{stage}</h3>
        </div>
        <Badge className={`rounded-full text-[10px] ${colors.bg} ${colors.text} ${colors.border}`}>
          {stageTransactions.length}
        </Badge>
      </div>
      <div
        className={`flex-1 rounded-b-2xl border border-t-0 p-2 space-y-2 min-h-[200px] transition-all duration-200 ${
          isOver
            ? colors.dropHighlight
            : isValidTarget
            ? "border-black/20 bg-black/[0.03]"
            : "border-black/10 bg-black/[0.015]"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isOver && (
          <div className={`rounded-lg border-2 border-dashed ${colors.border} p-3 text-center`}>
            <p className={`text-xs font-medium ${colors.text}`}>
              Drop here to move to {stage}
            </p>
          </div>
        )}
        {stageTransactions.length === 0 && !isOver ? (
          <div className="flex items-center justify-center h-full min-h-[180px]">
            <p className="text-xs text-black/30">
              {isDragActive && isValidTarget ? `Drop here` : "No transactions"}
            </p>
          </div>
        ) : (
          <>
            {visibleTransactions.map((transaction) => (
              <PipelineCard
                key={transaction.id}
                transaction={transaction}
                stage={stage}
                clientName={getClientName(transaction.client_id)}
                onDragStart={onDragStart}
              />
            ))}
            {/* Sentinel for infinite scroll */}
            <div ref={sentinelRef} className="h-1" />
            {displayCount < stageTransactions.length && (
              <p className="text-center text-[10px] text-black/30 py-1">
                Showing {displayCount} of {stageTransactions.length}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { role, setRole } = useRole();
  const { data: transactions, isLoading: transactionsLoading } = usePipelineTransactions();
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 200 });
  const { data: currentUser } = useCurrentUser();
  const updateTransactionMutation = useUpdateTransaction();
  const convertToBookingMutation = useConvertToBooking();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<string>("all");

  // Conversion dialogs
  const [quoteDialog, setQuoteDialog] = useState<{ transactionId: string; clientId: string; userId: string } | null>(null);
  const [bookingDialog, setBookingDialog] = useState<{ quoteId: string } | null>(null);
  const [haysRef, setHaysRef] = useState("");
  const [tourRef, setTourRef] = useState("");

  // Default to current user once loaded
  useEffect(() => {
    if (currentUser?.id && !selectedAgentId) {
      setSelectedAgentId(currentUser.id);
    }
  }, [currentUser?.id]);

  const [dragState, setDragState] = useState<{
    active: boolean;
    fromStage: PipelineStage | null;
    transactionId: string | null;
  }>({ active: false, fromStage: null, transactionId: null });

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (neonClientsData?.clients) {
      for (const c of neonClientsData.clients) {
        const titlePart = c.title && c.title !== "NULL" ? c.title : "";
        const name = [titlePart, c.firstName, c.surename].filter(Boolean).join(" ");
        map.set(c.id, name);
      }
    }
    return map;
  }, [neonClientsData]);

  const ACTIVE_QUOTE_STATUSES = new Set([
    "QUOTE_IN_PROGRESS",
    "QUOTE_CALL",
    "AWAITING_DECISION",
    "HOT_QUOTE",
    "QUOTE_READY",
    "REQUOTE",
    "NEW_LEAD",
  ]);

  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    let result = transactions;

    // Quoted column: only show active, non-free-quote transactions
    result = result.filter((t) => {
      if (t.status !== "on_quote") return true;
      const nonFreeQuotes = (t.quotes || []).filter((q: any) => !q.isFreeQuote);
      if (nonFreeQuotes.length === 0) return false;
      return nonFreeQuotes.some((q: any) => ACTIVE_QUOTE_STATUSES.has(q.quote_status));
    });

    if (selectedAgentId && selectedAgentId !== "all") {
      result = result.filter(
        (t) => t.agent_id === selectedAgentId || t.user_id === selectedAgentId
      );
    }
    if (quoteStatusFilter !== "all") {
      result = result.filter((t) => {
        if (t.quotes && t.quotes.length > 0) {
          return t.quotes.some((q: any) => q.quote_status === quoteStatusFilter);
        }
        return false;
      });
    }
    return result;
  }, [transactions, selectedAgentId, quoteStatusFilter]);

  const pipeline = useMemo(() => {
    const stages: Record<PipelineStage, Transaction[]> = {
      "Enquiry": [],
      "Quoted": [],
      "Booked": [],
    };

    for (const transaction of filteredTransactions) {
      const stage = classifyTransaction(transaction);
      stages[stage].push(transaction);
    }

    return stages;
  }, [filteredTransactions]);

  const stageTotals = useMemo(() => {
    const totals: Record<PipelineStage, { count: number; profit: number; value: number }> = {
      "Enquiry": { count: 0, profit: 0, value: 0 },
      "Quoted": { count: 0, profit: 0, value: 0 },
      "Booked": { count: 0, profit: 0, value: 0 },
    };

    for (const stage of STAGES) {
      const stageTransactions = pipeline[stage];
      totals[stage].count = stageTransactions.length;
      totals[stage].profit = stageTransactions.reduce((sum, t) => sum + getTransactionProfit(t), 0);
      totals[stage].value = stageTransactions.reduce((sum, t) => sum + getTransactionValue(t), 0);
    }

    return totals;
  }, [pipeline]);

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Unknown Client";
    return clientNameMap.get(clientId) || "Unknown Client";
  };

  const handleDragStart = useCallback((transaction: Transaction, stage: PipelineStage) => {
    setDragState({ active: true, fromStage: stage, transactionId: transaction.id });
  }, []);

  const handleDrop = useCallback((transactionId: string, fromStage: PipelineStage, toStage: PipelineStage) => {
    setDragState({ active: false, fromStage: null, transactionId: null });

    if (fromStage === toStage) return;

    const allTransactions = transactions || [];
    const transaction = allTransactions.find((t) => t.id === transactionId);
    if (!transaction) return;

    // Enquiry → Quoted: open create-quote dialog
    if (fromStage === "Enquiry" && toStage === "Quoted") {
      setQuoteDialog({
        transactionId,
        clientId: transaction.client_id || "",
        userId: transaction.user_id || currentUser?.id || "",
      });
      return;
    }

    // Quoted → Booked: open convert-to-booking dialog
    if (fromStage === "Quoted" && toStage === "Booked") {
      const activeQuote = (transaction.quotes || []).find((q: any) => !q.isFreeQuote);
      if (!activeQuote) {
        toast({ title: "No quote found on this transaction", variant: "destructive" });
        return;
      }
      setHaysRef("");
      setTourRef("");
      setBookingDialog({ quoteId: activeQuote.id });
      return;
    }

    // All other moves: update status directly
    const newStatus = STAGE_TO_STATUS[toStage];
    updateTransactionMutation.mutate(
      { id: transactionId, data: { status: newStatus } as any },
      {
        onSuccess: () => {
          toast({
            title: `Moved to ${toStage}`,
            description: `${getTransactionTitle(transaction)} has been updated.`,
          });
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to move the transaction. Please try again.",
            variant: "destructive",
          });
        },
      }
    );
  }, [transactions, updateTransactionMutation, currentUser, toast]);

  const handleDragEnd = useCallback(() => {
    setDragState({ active: false, fromStage: null, transactionId: null });
  }, []);

  if (transactionsLoading) {
    return (
      <CommandCenterShell
        active="pipeline"
        title="Pipeline"
        subtitle="Sales pipeline"
        role={role}
        onRoleChange={setRole}
      >
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      </CommandCenterShell>
    );
  }

  const totalPipelineProfit = STAGES.reduce((sum, stage) => sum + stageTotals[stage].profit, 0);

  const QUOTE_STATUS_OPTIONS = [
    { value: "all", label: "All Statuses" },
    { value: "QUOTE_IN_PROGRESS", label: "Quote in Progress" },
    { value: "QUOTE_CALL", label: "Quote Call" },
    { value: "AWAITING_DECISION", label: "Awaiting Decision" },
    { value: "HOT_QUOTE", label: "Hot Quote" },
  ];

  const pipelineFilterSlot = (
    <>
      <Select value={quoteStatusFilter} onValueChange={setQuoteStatusFilter}>
        <SelectTrigger
          className="h-10 w-[200px] rounded-2xl border-black/10 bg-black/5 text-black dark:border-white/10 dark:bg-white/5 dark:text-white"
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
      {selectedAgentId && (
        <UserReassignSelect
          value={selectedAgentId}
          onValueChange={setSelectedAgentId}
          allowAll
          allLabel="All Agents"
          className="w-[190px]"
          data-testid="select-agent-filter"
        />
      )}
    </>
  );

  return (
    <>
    <CommandCenterShell
      active="pipeline"
      title="Pipeline"
      subtitle="Sales pipeline overview"
      role={role}
      onRoleChange={setRole}
      filterSlot={pipelineFilterSlot}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STAGES.map((stage) => {
            const colors = stageColor(stage);
            const totals = stageTotals[stage];
            return (
              <Card
                key={stage}
                className={`glass ringed grain rounded-2xl p-4 ${colors.bg} ${colors.border}`}
                data-testid={`pipeline-summary-${stage.toLowerCase()}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className={`h-2 w-2 rounded-full ${colors.dot}`} />
                  <span className={`text-xs font-semibold ${colors.text}`}>{stage}</span>
                </div>
                <p className="text-xl font-bold text-black/80">{totals.count}</p>
                <p className="text-xs text-black/50 mt-1">
                  Profit: <span className="font-semibold text-emerald-700">{formatCurrency(totals.profit)}</span>
                </p>
              </Card>
            );
          })}
        </div>

        <Card className="glass ringed grain rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-black/60">Total Pipeline</p>
                <p className="text-lg font-bold text-black/80">
                  {filteredTransactions.length} transactions
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-black/40">Total Profit</p>
              <p className="text-lg font-bold text-emerald-700" data-testid="pipeline-total-profit">
                {formatCurrency(totalPipelineProfit)}
              </p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STAGES.map((stage) => (
            <PipelineColumn
              key={stage}
              stage={stage}
              transactions={pipeline[stage]}
              getClientName={getClientName}
              onDragStart={handleDragStart}
              onDrop={handleDrop}
              isDragActive={dragState.active}
              dragFromStage={dragState.fromStage}
            />
          ))}
        </div>

        {dragState.active && (
          <p className="text-center text-xs text-black/40 animate-pulse">
            Drag to a column to move this transaction
          </p>
        )}
      </motion.div>
    </CommandCenterShell>

    {quoteDialog && (
      <QuoteCreateDialog
        transactionId={quoteDialog.transactionId}
        clientId={quoteDialog.clientId}
        userId={quoteDialog.userId}
        open={!!quoteDialog}
        onOpenChange={(open) => { if (!open) setQuoteDialog(null); }}
        onSuccess={() => {
          setQuoteDialog(null);
          queryClient.invalidateQueries({ queryKey: transactionKeys.all });
          toast({ title: "Quote created", description: "Transaction moved to Quoted." });
        }}
      />
    )}

    {/* Quoted → Booked: convert to booking */}
    <Dialog
      open={!!bookingDialog}
      onOpenChange={(open) => {
        if (!open) { setBookingDialog(null); setHaysRef(""); setTourRef(""); }
      }}
    >
      <DialogContent className="max-w-sm rounded-2xl border-black/10 bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">Convert to Booking</DialogTitle>
          <DialogDescription className="text-xs text-black/55">
            Enter the booking references to confirm this conversion.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-3 grid gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">HAYS Reference</Label>
            <Input
              value={haysRef}
              onChange={(e) => setHaysRef(e.target.value)}
              placeholder="e.g. HAYS-12345"
              className="h-9 rounded-xl border-black/10 bg-white/70"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-black/60">Tour Reference</Label>
            <Input
              value={tourRef}
              onChange={(e) => setTourRef(e.target.value)}
              placeholder="e.g. TOUR-67890"
              className="h-9 rounded-xl border-black/10 bg-white/70"
            />
          </div>
          <Button
            className="h-9 w-full rounded-xl bg-emerald-600 text-white hover:bg-emerald-600/90"
            disabled={convertToBookingMutation.isPending}
            onClick={() => {
              if (!bookingDialog) return;
              convertToBookingMutation.mutate(
                { quoteId: bookingDialog.quoteId, haysRef, supplierRef: tourRef },
                {
                  onSuccess: () => {
                    setBookingDialog(null);
                    setHaysRef("");
                    setTourRef("");
                    queryClient.invalidateQueries({ queryKey: transactionKeys.all });
                    toast({ title: "Quote converted to booking" });
                  },
                  onError: () => {
                    toast({ title: "Failed to convert", variant: "destructive" });
                  },
                }
              );
            }}
          >
            {convertToBookingMutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : "Convert to Booking"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
