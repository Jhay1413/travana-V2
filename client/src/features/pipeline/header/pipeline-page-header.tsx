import { Search } from "lucide-react";
import type { DealPriority, PipelineSort } from "@/features/transaction";
import { formatCurrency } from "@/features/pipeline/lib/pipeline-helpers";
import type { OpenTotals } from "@/features/pipeline/lib/pipeline-money";
import { CreateMenu } from "@/components/shared/create-menu";
import { PipelineFiltersPopover } from "./pipeline-filters-popover";
import { PipelineSortSelect } from "./pipeline-sort-select";

interface PipelinePageHeaderProps {
  embedded: boolean;
  totals: OpenTotals;
  searchInput: string;
  onSearchChange: (value: string) => void;
  priority: ReadonlySet<DealPriority>;
  operators: ReadonlySet<string>;
  onTogglePriority: (p: DealPriority) => void;
  onToggleOperator: (id: string) => void;
  onClearFilters: () => void;
  sort: PipelineSort;
  onSortChange: (value: PipelineSort) => void;
}

/** Title + "n open deals · £ value · £ expected profit" on the left; search,
 *  filters, sort and the "+" create menu on the right. No box — it sits on the page. */
export function PipelinePageHeader({
  embedded,
  totals,
  searchInput,
  onSearchChange,
  priority,
  operators,
  onTogglePriority,
  onToggleOperator,
  onClearFilters,
  sort,
  onSortChange,
}: PipelinePageHeaderProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      {!embedded && (
        <div className="min-w-[220px] flex-1">
          <h1 className="text-[22px] font-semibold leading-[1.2] xl:text-[24px]" data-testid="pipeline-title">
            Pipeline
          </h1>
          <p className="mt-0.5 text-[12px] text-social-muted" data-testid="pipeline-subline">
            <b className="font-semibold text-foreground">{totals.count}</b> open {totals.count === 1 ? "deal" : "deals"} ·{" "}
            <b className="font-semibold text-foreground">{formatCurrency(totals.value)}</b> value ·{" "}
            <b className="font-semibold text-pipeline-profit">{formatCurrency(totals.profit)}</b> expected profit
          </p>
        </div>
      )}
      {embedded && <span className="flex-1" />}

      <label className="flex h-10 w-[300px] max-w-full shrink-0 items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] xl:text-[13px]">
        <Search className="h-4 w-4 shrink-0 text-[#8A94A6]" />
        <input
          type="search"
          maxLength={100}
          value={searchInput}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search deals, clients, refs"
          aria-label="Search deals, clients, refs"
          className="min-w-0 flex-1 bg-transparent text-foreground outline-none placeholder:text-[#8A94A6]"
          data-testid="input-pipeline-search"
        />
      </label>
      <PipelineFiltersPopover
        priority={priority}
        operators={operators}
        onTogglePriority={onTogglePriority}
        onToggleOperator={onToggleOperator}
        onClear={onClearFilters}
      />
      <PipelineSortSelect value={sort} onChange={onSortChange} />
      {!embedded && <CreateMenu trigger="blue" testId="button-new-deal" />}
    </div>
  );
}
