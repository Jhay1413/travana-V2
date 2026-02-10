import { useState, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  Calendar,
  ChevronRight,
  GripVertical,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useTransactions, useNeonClients } from "@/hooks/queries";
import { useUpdateTransaction } from "@/hooks/mutations";
import { useToast } from "@/hooks/use-toast";
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

function PipelineColumn({ stage, transactions: stageTransactions, getClientName, onDragStart, onDrop, isDragActive, dragFromStage }: PipelineColumnProps) {
  const [isOver, setIsOver] = useState(false);
  const colors = stageColor(stage);
  const isValidTarget = isDragActive && dragFromStage !== stage;

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
          stageTransactions.map((transaction) => (
            <PipelineCard
              key={transaction.id}
              transaction={transaction}
              stage={stage}
              clientName={getClientName(transaction.client_id)}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const { role, setRole } = useRole();
  const { data: transactions, isLoading: transactionsLoading } = useTransactions();
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 200 });
  const updateTransactionMutation = useUpdateTransaction();
  const { toast } = useToast();
  const [, navigate] = useLocation();

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

  const pipeline = useMemo(() => {
    const stages: Record<PipelineStage, Transaction[]> = {
      "Enquiry": [],
      "Quoted": [],
      "Booked": [],
    };

    if (!transactions) return stages;

    for (const transaction of transactions) {
      const stage = classifyTransaction(transaction);
      stages[stage].push(transaction);
    }

    return stages;
  }, [transactions]);

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
  }, [transactions, updateTransactionMutation, toast]);

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

  return (
    <CommandCenterShell
      active="pipeline"
      title="Pipeline"
      subtitle="Sales pipeline overview"
      role={role}
      onRoleChange={setRole}
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
                  {transactions?.length || 0} transactions
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
  );
}
