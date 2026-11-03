import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import type { Transaction } from "@/features/quote/types";
import { DealCard, type CardActions } from "@/features/pipeline/card/deal-card";
import { formatCurrency, STAGE_LABEL, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import type { ColumnData } from "@/features/pipeline/state/use-pipeline-columns";
import type { PipelineScope } from "@/features/pipeline/state/use-pipeline-filters";
import { AMBER_LINK } from "@/features/pipeline/shared/button-styles";
import { CreateMenu } from "@/components/shared/create-menu";
import { FilterChip } from "@/features/pipeline/shared/filter-chip";

const MOBILE_STAGES: PipelineStage[] = ["Enquiry", "Quoted", "In Play", "Booked", "Future", "Lost"];

interface PipelineMobileProps {
  columns: Record<PipelineStage, ColumnData>;
  stages: PipelineStage[];
  isLoading: boolean;
  searchInput: string;
  onSearchChange: (value: string) => void;
  scope: PipelineScope;
  onScopeChange: (value: PipelineScope) => void;
  /** Number of active quick / priority / operator filters. */
  activeFilters: number;
  onClearFilters: () => void;
  getClientName: (id: string | null) => string;
  selectedId: string | null;
  onDragStart: (t: Transaction, stage: PipelineStage) => void;
  actionsFor: (stage: PipelineStage) => CardActions;
  /** Inside another page (agent profile): no create menu. */
  embedded?: boolean;
}

/** ≤900px: one stage at a time, no drag-and-drop, no list view. */
export function PipelineMobile({
  columns,
  stages,
  isLoading,
  searchInput,
  onSearchChange,
  scope,
  onScopeChange,
  activeFilters,
  onClearFilters,
  getClientName,
  selectedId,
  onDragStart,
  actionsFor,
  embedded = false,
}: PipelineMobileProps) {
  const [stage, setStage] = useState<PipelineStage>("Quoted");
  const visibleStages = MOBILE_STAGES.filter((s) => stages.includes(s));
  const column = columns[stage];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="pipeline-mobile">
      <div className="flex items-center gap-2.5">
        <h1 className="flex-1 text-[22px] font-semibold" data-testid="pipeline-title">Pipeline</h1>
        {!embedded && <CreateMenu trigger="blue" testId="button-new-deal" />}
      </div>
      <label className="flex h-10 w-full items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[13px]">
        <Search className="h-4 w-4 shrink-0 text-[#8A94A6]" />
        <input
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deals, clients, refs"
          aria-label="Search deals, clients, refs"
          className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#8A94A6]"
        />
      </label>
      {activeFilters > 0 && (
        <div className="flex flex-none items-center gap-2 text-[12px] text-social-muted" data-testid="pipeline-mobile-filters">
          <span>{activeFilters} {activeFilters === 1 ? "filter" : "filters"} active</span>
          <button type="button" className={AMBER_LINK} onClick={onClearFilters} data-testid="button-mobile-clear-filters">Clear</button>
        </div>
      )}
      <div className="flex flex-none gap-1.5 overflow-x-auto pb-0.5">
        {visibleStages.map((s) => (
          <FilterChip key={s} active={stage === s} onClick={() => setStage(s)} className="flex-none">
            {STAGE_LABEL[s].replace(" Deals", "")} {columns[s].total}
          </FilterChip>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[12px] text-social-muted">
          <b className="font-semibold text-foreground">{formatCurrency(column.totalValue)}</b> value ·{" "}
          <b className="font-semibold text-pipeline-profit">{formatCurrency(column.totalProfit)}</b> profit
        </div>
        <Select value={scope} onValueChange={(v) => onScopeChange(v as PipelineScope)}>
          <SelectTrigger className="h-[34px] w-[130px] rounded-[10px] border-social-border bg-card text-[13px]" aria-label="Deal owner">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="mine">My Deals</SelectItem>
            <SelectItem value="all">All Deals</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto rounded-2xl bg-pipeline-column-bg p-3">
        {isLoading ? (
          <div className="flex justify-center py-10"><Spinner /></div>
        ) : column.items.length === 0 ? (
          <div className="p-6 text-center text-[13px] text-social-muted">No deals here.</div>
        ) : (
          column.items.map((tx) => (
            <DealCard
              key={tx.id}
              transaction={tx}
              stage={stage}
              clientName={getClientName(tx.client_id)}
              selected={tx.id === selectedId}
              draggable={false}
              onDragStart={onDragStart}
              {...actionsFor(stage)}
            />
          ))
        )}
        {column.hasNextPage && (
          <Button type="button" variant="outline" className="h-[38px] flex-none rounded-[10px] border-social-border bg-card text-[13px]" onClick={column.fetchNextPage} disabled={column.isFetchingNextPage}>
            {column.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        )}
      </div>
    </div>
  );
}
