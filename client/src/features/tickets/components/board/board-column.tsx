import { useState, type DragEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DuePillModel } from "../../lib/ticket-due";
import { statusMeta } from "../../lib/ticket-display";
import type { Ticket, TicketStatusValue } from "../../types";
import { BoardCard } from "./board-card";

const PER_COLUMN = 4;

export function BoardColumn({
  status,
  tickets,
  now,
  pills,
  pinned,
  dragId,
  onDragStart,
  onDragEnd,
  onDropTicket,
  onAdd,
}: {
  status: TicketStatusValue;
  tickets: Ticket[];
  now: Date;
  pills: ReadonlyMap<string, DuePillModel>;
  pinned: ReadonlyMap<string, number>;
  dragId: string | null;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropTicket: (id: string, status: TicketStatusValue) => void;
  onAdd: (status: TicketStatusValue) => void;
}) {
  const [isOver, setIsOver] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const meta = statusMeta(status);
  const hidden = expanded ? 0 : Math.max(0, tickets.length - PER_COLUMN);
  const visible = hidden ? tickets.slice(0, PER_COLUMN) : tickets;

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    const id = e.dataTransfer.getData("text/plain") || dragId;
    if (id) onDropTicket(id, status);
  };

  return (
    <section
      aria-label={meta.label}
      className={cn(
        "relative flex min-h-0 min-w-[250px] flex-1 flex-col overflow-hidden rounded-2xl border-2 border-transparent bg-pipeline-column-bg",
        isOver && "border-dashed border-social-orange bg-pipeline-drop-bg",
      )}
      onDragOver={(e) => {
        if (!dragId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setIsOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsOver(false);
      }}
      onDrop={handleDrop}
      data-testid={`ticket-column-${meta.slug}`}
    >
      <div className="relative flex-none px-3.5 pb-3 pt-[14px]">
        <div className={cn("absolute inset-x-3.5 top-0 h-[3px] rounded-b-[3px]", meta.dotClass)} />
        <div className="mt-1 flex items-center gap-2">
          <span className="whitespace-nowrap text-[15.5px] font-semibold">{meta.label}</span>
          <span className={cn("inline-flex h-[22px] min-w-6 items-center justify-center rounded-full px-2 text-[12px] font-semibold", meta.chipClass)}>
            {tickets.length}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label={`Add ticket to ${meta.label}`}
            onClick={() => onAdd(status)}
            className="grid h-[30px] w-[30px] place-items-center rounded-[4px] border border-black/15 bg-card text-social-muted transition hover:bg-muted hover:text-foreground dark:border-white/15"
            data-testid={`ticket-column-add-${meta.slug}`}
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-3 pb-3">
        {visible.map((t) => (
          <BoardCard
            key={t.id}
            ticket={t}
            now={now}
            pill={pills.get(t.id)}
            pinned={pinned.has(t.id)}
            dragging={dragId === t.id}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", t.id);
              e.dataTransfer.effectAllowed = "move";
              onDragStart(t.id);
            }}
            onDragEnd={() => {
              setIsOver(false);
              onDragEnd();
            }}
          />
        ))}
        {tickets.length === 0 && (
          <p className="px-2 py-[18px] text-center text-[12.5px] text-social-muted">
            Nothing here. Drop a ticket to move it to {meta.label}.
          </p>
        )}
        {hidden > 0 && (
          <Button
            type="button"
            variant="outline"
            className="h-[38px] w-full flex-none rounded-[10px] border-social-border bg-card text-[13px] font-semibold"
            onClick={() => setExpanded(true)}
            data-testid={`ticket-column-more-${meta.slug}`}
          >
            Show {hidden} more
          </Button>
        )}
      </div>
    </section>
  );
}
