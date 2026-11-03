import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import type { QueueChip, QueueCounts, QueueResult, QueueScope } from "../../lib/ticket-queue";
import { BoardCard } from "../board/board-card";
import { EmptyQueue } from "./empty-queue";
import { QueueChips } from "./queue-chips";
import { QueueSearch } from "./queue-search";

/** 900px and below: search, chips, a scope select and a card list. */
export function MobileQueue({
  result,
  counts,
  chip,
  onChipChange,
  scope,
  onScopeChange,
  canViewAll,
  search,
  onSearchChange,
  now,
  pinned,
  isLoading,
  onNewTicket,
}: {
  result: QueueResult;
  counts: QueueCounts;
  chip: QueueChip;
  onChipChange: (chip: QueueChip) => void;
  scope: QueueScope;
  onScopeChange: (scope: QueueScope) => void;
  canViewAll: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  now: Date;
  pinned: ReadonlyMap<string, number>;
  isLoading: boolean;
  onNewTicket: () => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="tickets-mobile">
      <div className="flex items-center gap-2.5">
        <h1 className="flex-1 text-[22px] font-semibold" data-testid="tickets-title">Tickets</h1>
        <Button type="button" className={`${PRIMARY_ACTION} h-[38px]`} onClick={onNewTicket} data-testid="ticket-compose">
          <Plus className="h-4 w-4" />
          New ticket
        </Button>
      </div>
      <QueueSearch value={search} onChange={onSearchChange} className="w-full" />
      <QueueChips value={chip} counts={counts} onChange={onChipChange} nowrap />
      <div className="flex items-center gap-2">
        <div className="flex-1 text-[12px] text-social-muted">
          <b className="font-semibold text-status-failed-fg">{counts.attention}</b> need attention
        </div>
        <Select value={scope} onValueChange={(v) => onScopeChange(v as QueueScope)}>
          <SelectTrigger className="h-[34px] w-[150px] rounded-[10px] border-social-border bg-card text-[12px]" aria-label="Ticket owner" data-testid="ticket-scope-select">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="mine">My tickets</SelectItem>
            <SelectItem value="raised">Raised by me</SelectItem>
            {canViewAll && <SelectItem value="all">All tickets</SelectItem>}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Spinner /></div>
        ) : result.rows.length === 0 ? (
          <EmptyQueue chip={chip} />
        ) : (
          result.rows.map((t) => <BoardCard key={t.id} ticket={t} now={now} pill={result.pills.get(t.id)} pinned={pinned.has(t.id)} draggable={false} />)
        )}
      </div>
    </div>
  );
}
