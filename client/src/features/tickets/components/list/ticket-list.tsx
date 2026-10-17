import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { DuePillModel } from "../../lib/ticket-due";
import type { QueueChip, QueueGroup } from "../../lib/ticket-queue";
import { EmptyQueue } from "../queue/empty-queue";
import { LIST_GRID_COLS, LIST_HEADERS } from "./list-columns";
import { TicketListRow } from "./ticket-list-row";

const GROUP_DOT: Record<string, string> = {
  attention: "bg-priority-urgent",
  open: "bg-stage-inplay-dot",
  unassigned: "bg-stage-lost-dot",
  closed: "bg-stage-booked-dot",
};

/** List view: one rounded card; the open chip splits into "Needs attention" and "Open" groups. */
export function TicketList({
  groups,
  chip,
  now,
  pills,
  pinned,
  picked,
  isLoading,
  onPick,
  onPickAll,
}: {
  groups: QueueGroup[];
  chip: QueueChip;
  now: Date;
  pills: ReadonlyMap<string, DuePillModel>;
  pinned: ReadonlyMap<string, number>;
  picked: ReadonlySet<string>;
  isLoading: boolean;
  onPick: (id: string) => void;
  onPickAll: (ids: string[], on: boolean) => void;
}) {
  const [shut, setShut] = useState<Record<string, boolean>>({});
  const all = groups.flatMap((g) => g.rows);
  // Select-all covers the rows on screen only; collapsed groups are skipped.
  const visible = groups.filter((g) => !shut[g.key]).flatMap((g) => g.rows);
  const allOn = visible.length > 0 && visible.every((t) => picked.has(t.id));

  if (isLoading) return <div className="flex items-center justify-center py-20"><Spinner /></div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-pipeline-card-border bg-card" data-testid="ticket-list">
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div className="flex min-h-0 min-w-[1020px] flex-1 flex-col" role="table" aria-label="Tickets">
          <div
            className="grid h-10 flex-none items-center gap-3.5 border-b border-pipeline-card-border bg-card px-[18px]"
            role="row"
            style={{ gridTemplateColumns: LIST_GRID_COLS }}
          >
            <Checkbox
              checked={allOn}
              onCheckedChange={(on) => onPickAll(visible.map((t) => t.id), on === true)}
              aria-label="Select all tickets"
              data-testid="ticket-pick-all"
            />
            {LIST_HEADERS.map((label) => (
              <div key={label} role="columnheader" className="text-[11px] font-semibold uppercase tracking-[.06em] text-social-muted">
                {label}
              </div>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {groups.map((group) => {
              if (chip === "open" && group.rows.length === 0) return null;
              const isShut = !!shut[group.key];
              return (
                <div key={group.key} data-testid={`ticket-group-${group.key}`}>
                  <button
                    type="button"
                    aria-expanded={!isShut}
                    onClick={() => setShut({ ...shut, [group.key]: !isShut })}
                    className="flex h-10 w-full items-center gap-2.5 border-b border-pipeline-card-border bg-muted/60 px-[18px] text-left"
                  >
                    <ChevronDown className={cn("h-4 w-4 text-social-muted transition-transform", isShut && "-rotate-90")} strokeWidth={2} />
                    <span className={cn("h-2 w-2 rounded-full", GROUP_DOT[group.key] ?? "bg-stage-future-dot")} />
                    <span className="text-[13px] font-semibold">{group.label}</span>
                    <span className="text-[12px] text-social-muted">{group.rows.length} {group.rows.length === 1 ? "ticket" : "tickets"}</span>
                    <span className="flex-1" />
                    <span className="text-[12px] text-social-muted">{group.hint}</span>
                  </button>
                  {!isShut &&
                    group.rows.map((t) => (
                      <TicketListRow key={t.id} ticket={t} now={now} pill={pills.get(t.id)} pinned={pinned.has(t.id)} picked={picked.has(t.id)} onPick={() => onPick(t.id)} />
                    ))}
                </div>
              );
            })}
            {all.length === 0 && <EmptyQueue chip={chip} />}
          </div>
        </div>
      </div>
    </div>
  );
}
