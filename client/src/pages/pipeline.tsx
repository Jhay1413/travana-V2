import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import {
  Calendar,
  ChevronRight,
  MapPin,
  Plane,
  PoundSterling,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useQuotes, useNeonClients } from "@/hooks/queries";
import type { Quote } from "@/types/quote";

type PipelineStage = "New Lead" | "In Play" | "Booked" | "Lost";

const STAGES: PipelineStage[] = ["New Lead", "In Play", "Booked", "Lost"];

function stageColor(stage: PipelineStage) {
  switch (stage) {
    case "New Lead":
      return {
        bg: "bg-blue-500/10",
        border: "border-blue-500/20",
        text: "text-blue-700",
        dot: "bg-blue-500",
        header: "bg-blue-50 border-blue-200",
      };
    case "In Play":
      return {
        bg: "bg-amber-500/10",
        border: "border-amber-500/20",
        text: "text-amber-700",
        dot: "bg-amber-500",
        header: "bg-amber-50 border-amber-200",
      };
    case "Booked":
      return {
        bg: "bg-emerald-500/10",
        border: "border-emerald-500/20",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
        header: "bg-emerald-50 border-emerald-200",
      };
    case "Lost":
      return {
        bg: "bg-red-500/10",
        border: "border-red-500/20",
        text: "text-red-700",
        dot: "bg-red-500",
        header: "bg-red-50 border-red-200",
      };
  }
}

function formatDate(dateString: string): string {
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

function getProfit(quote: Quote, stage: PipelineStage): number {
  if (quote.commission) {
    const agentSplit = parseFloat(quote.commission.agentSplitValue) || 0;
    if (agentSplit > 0) return agentSplit;
    const price = parseFloat(quote.commission.price) || 0;
    if (price > 0) return price * 0.1;
    return 0;
  }
  return 0;
}

function getTotalValue(quote: Quote): number {
  if (quote.commission) {
    return parseFloat(quote.commission.price) || 0;
  }
  return 0;
}

function classifyQuote(quote: Quote): PipelineStage {
  if (quote.status === "Booked" || quote.status === "Won") return "Booked";
  if (quote.status === "Lost") return "Lost";
  if (quote.commission) return "In Play";
  return "New Lead";
}

interface PipelineCardProps {
  quote: Quote;
  stage: PipelineStage;
  clientName: string;
}

function PipelineCard({ quote, stage, clientName }: PipelineCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const profit = getProfit(quote, stage);
  const totalValue = getTotalValue(quote);
  const colors = stageColor(stage);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link href={`/clients/${quote.clientId}/quotes/${quote.id}`}>
        <motion.div
          whileHover={{ y: -2 }}
          className={`p-3.5 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer transition-shadow hover:shadow-md`}
          data-testid={`pipeline-card-${quote.id}`}
        >
          <h4 className="text-sm font-semibold text-black/80 truncate mb-1.5" data-testid={`pipeline-title-${quote.id}`}>
            {quote.quoteTitle}
          </h4>
          <div className="flex items-center gap-1.5 text-xs text-black/50 mb-1">
            <Users className="h-3 w-3" />
            <span className="truncate" data-testid={`pipeline-client-${quote.id}`}>{clientName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-black/50 mb-2">
            <Calendar className="h-3 w-3" />
            <span data-testid={`pipeline-date-${quote.id}`}>{formatDate(quote.travelDate)}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <PoundSterling className="h-3 w-3 text-emerald-600" />
              <span className="text-sm font-semibold text-emerald-700" data-testid={`pipeline-profit-${quote.id}`}>
                {profit > 0 ? formatCurrency(profit) : "TBC"}
              </span>
              {profit > 0 && quote.commission && !(parseFloat(quote.commission.agentSplitValue) > 0) && (
                <span className="text-[10px] text-black/30 ml-0.5">(est.)</span>
              )}
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-black/20" />
          </div>
        </motion.div>
      </Link>

      {isHovered && (
        <div
          className="absolute left-0 right-0 top-full mt-1 z-50 p-4 rounded-xl border border-black/15 bg-white shadow-xl"
          data-testid={`pipeline-hover-${quote.id}`}
        >
          <h4 className="font-semibold text-black/90 mb-3">{quote.quoteTitle}</h4>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Client</p>
              <p className="font-medium text-black/70">{clientName}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Travel Date</p>
              <p className="font-medium text-black/70">{formatDate(quote.travelDate)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Destination</p>
              <p className="font-medium text-black/70 flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {quote.destination}
                {quote.country ? `, ${quote.country}` : ""}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Package</p>
              <p className="font-medium text-black/70">{quote.packageType}</p>
            </div>
            {quote.nights && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Duration</p>
                <p className="font-medium text-black/70">{quote.nights} nights</p>
              </div>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Passengers</p>
              <p className="font-medium text-black/70">
                {quote.passengersAdults} Adult{quote.passengersAdults !== 1 ? "s" : ""}
                {quote.passengersChildren > 0 && `, ${quote.passengersChildren} Child${quote.passengersChildren !== 1 ? "ren" : ""}`}
                {quote.passengersInfants > 0 && `, ${quote.passengersInfants} Infant${quote.passengersInfants !== 1 ? "s" : ""}`}
              </p>
            </div>
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
                {profit > 0 && quote.commission && !(parseFloat(quote.commission.agentSplitValue) > 0) && (
                  <span className="text-[10px] text-black/30 ml-1">(estimated 10%)</span>
                )}
              </p>
            </div>
            {quote.commission?.tourOperator && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Tour Operator</p>
                <p className="font-medium text-black/70">{quote.commission.tourOperator}</p>
              </div>
            )}
            {quote.resort && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Resort</p>
                <p className="font-medium text-black/70">{quote.resort}</p>
              </div>
            )}
            {quote.leadSource && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-black/40 mb-0.5">Lead Source</p>
                <p className="font-medium text-black/70">{quote.leadSource}</p>
              </div>
            )}
          </div>
          {quote.haysReference || quote.tourReference ? (
            <div className="flex gap-2 mt-3 pt-2 border-t border-black/10">
              {quote.haysReference && (
                <Badge className="text-[10px] rounded-full bg-black/5 text-black/50 border-black/10">
                  HAYS: {quote.haysReference}
                </Badge>
              )}
              {quote.tourReference && (
                <Badge className="text-[10px] rounded-full bg-black/5 text-black/50 border-black/10">
                  Tour: {quote.tourReference}
                </Badge>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function PipelinePage() {
  const { role, setRole } = useRole();
  const { data: quotes, isLoading: quotesLoading } = useQuotes();
  const { data: neonClientsData } = useNeonClients({ page: 1, limit: 200 });

  const clientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (neonClientsData?.clients) {
      for (const c of neonClientsData.clients) {
        const title = c.title && c.title !== "NULL" ? c.title : "";
        const name = [title, c.firstName, c.surename].filter(Boolean).join(" ");
        map.set(c.id, name);
      }
    }
    return map;
  }, [neonClientsData]);

  const pipeline = useMemo(() => {
    const stages: Record<PipelineStage, Quote[]> = {
      "New Lead": [],
      "In Play": [],
      "Booked": [],
      "Lost": [],
    };

    if (!quotes) return stages;

    for (const quote of quotes) {
      const stage = classifyQuote(quote);
      stages[stage].push(quote);
    }

    return stages;
  }, [quotes]);

  const stageTotals = useMemo(() => {
    const totals: Record<PipelineStage, { count: number; profit: number; value: number }> = {
      "New Lead": { count: 0, profit: 0, value: 0 },
      "In Play": { count: 0, profit: 0, value: 0 },
      "Booked": { count: 0, profit: 0, value: 0 },
      "Lost": { count: 0, profit: 0, value: 0 },
    };

    for (const stage of STAGES) {
      const stageQuotes = pipeline[stage];
      totals[stage].count = stageQuotes.length;
      totals[stage].profit = stageQuotes.reduce((sum, q) => sum + getProfit(q, stage), 0);
      totals[stage].value = stageQuotes.reduce((sum, q) => sum + getTotalValue(q), 0);
    }

    return totals;
  }, [pipeline]);

  const getClientName = (clientId: string) => {
    return clientNameMap.get(clientId) || "Unknown Client";
  };

  if (quotesLoading) {
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
  const totalPipelineValue = STAGES.reduce((sum, stage) => sum + stageTotals[stage].value, 0);

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
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAGES.map((stage) => {
            const colors = stageColor(stage);
            const totals = stageTotals[stage];
            return (
              <Card
                key={stage}
                className={`glass ringed grain rounded-2xl p-4 ${colors.bg} ${colors.border}`}
                data-testid={`pipeline-summary-${stage.toLowerCase().replace(" ", "-")}`}
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
                  {quotes?.length || 0} quotes
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STAGES.map((stage) => {
            const colors = stageColor(stage);
            const stageQuotes = pipeline[stage];
            return (
              <div key={stage} className="flex flex-col" data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}`}>
                <div className={`rounded-t-2xl border ${colors.header} p-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${colors.dot}`} />
                    <h3 className={`text-sm font-semibold ${colors.text}`}>{stage}</h3>
                  </div>
                  <Badge className={`rounded-full text-[10px] ${colors.bg} ${colors.text} ${colors.border}`}>
                    {stageQuotes.length}
                  </Badge>
                </div>
                <div className="flex-1 rounded-b-2xl border border-t-0 border-black/10 bg-black/[0.015] p-2 space-y-2 min-h-[200px]">
                  {stageQuotes.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[180px]">
                      <p className="text-xs text-black/30">No quotes</p>
                    </div>
                  ) : (
                    stageQuotes.map((quote) => (
                      <PipelineCard
                        key={quote.id}
                        quote={quote}
                        stage={stage}
                        clientName={getClientName(quote.clientId)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>
    </CommandCenterShell>
  );
}
