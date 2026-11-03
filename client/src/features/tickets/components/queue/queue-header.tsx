import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import type { QueueCounts, QueueFilters, QueueSort } from "../../lib/ticket-queue";
import { FiltersPopover } from "./filters-popover";
import { QueueSearch } from "./queue-search";
import { SortMenu } from "./sort-menu";

interface QueueHeaderProps {
  counts: QueueCounts;
  search: string;
  onSearchChange: (value: string) => void;
  filters: QueueFilters;
  onFiltersChange: (next: QueueFilters) => void;
  sort: QueueSort;
  onSortChange: (value: QueueSort) => void;
  onNewTicket: () => void;
}

/** Title + "n open · n need attention · n unassigned" on the left; search, filters, sort and New ticket on the right. No box. */
export function QueueHeader({ counts, search, onSearchChange, filters, onFiltersChange, sort, onSortChange, onNewTicket }: QueueHeaderProps) {
  return (
    <div className="flex flex-none flex-wrap items-center gap-3">
      <div className="min-w-[220px] flex-1">
        <h1 className="text-[22px] font-semibold leading-[1.2] xl:text-[24px]" data-testid="tickets-title">
          Tickets
        </h1>
        <p className="mt-0.5 text-[12px] text-social-muted" data-testid="tickets-subline">
          <b className="font-semibold text-foreground">{counts.open}</b> open ·{" "}
          <b className="font-semibold text-status-failed-fg">{counts.attention}</b> need attention ·{" "}
          <b className="font-semibold text-foreground">{counts.unassigned}</b> unassigned
        </p>
      </div>
      <QueueSearch value={search} onChange={onSearchChange} />
      <FiltersPopover filters={filters} onChange={onFiltersChange} />
      <SortMenu value={sort} onChange={onSortChange} />
      <Button type="button" className={PRIMARY_ACTION} onClick={onNewTicket} data-testid="ticket-compose">
        <Plus className="h-4 w-4" />
        New ticket
      </Button>
    </div>
  );
}
