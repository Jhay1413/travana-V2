import type { MouseEvent, ReactNode } from "react";
import { CheckCircle2, Clock, RotateCcw, UserPlus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SNOOZE_PRESETS, snoozeLabel, snoozeUntil, type SnoozePresetId } from "../lib";

const BTN =
  "grid h-7 w-7 place-items-center rounded-md border border-social-border bg-card text-social-muted transition hover:bg-muted hover:text-foreground";

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation();
}

function IconButton({ title, onClick, children }: { title: string; onClick: (e: MouseEvent) => void; children: ReactNode }) {
  return (
    <button type="button" title={title} aria-label={title} className={BTN} onClick={onClick}>
      {children}
    </button>
  );
}

export interface RowHoverActionsProps {
  snoozed: boolean;
  isDoneTab: boolean;
  staff: { id: string; name: string }[];
  currentUserId?: string | null;
  now: Date;
  onSnooze: (presetId: SnoozePresetId) => void;
  onUnsnooze: () => void;
  onDone: () => void;
  onReopen: () => void;
  onAssign: (userId: string | null) => void;
}

export function RowHoverActions({ snoozed, isDoneTab, staff, currentUserId, now, onSnooze, onUnsnooze, onDone, onReopen, onAssign }: RowHoverActionsProps) {
  return (
    <div className="flex items-center gap-1" onClick={stop} onKeyDown={stop}>
      {snoozed ? (
        <IconButton
          title="Wake now"
          onClick={(e) => {
            stop(e);
            onUnsnooze();
          }}
        >
          <Clock className="h-3.5 w-3.5" />
        </IconButton>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Snooze" aria-label="Snooze" className={BTN} onClick={stop}>
              <Clock className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={stop}>
            {SNOOZE_PRESETS.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => onSnooze(p.id)} className="flex flex-col items-start gap-0">
                <span className="text-[13px]">{p.label}</span>
                <span className="text-[11px] text-social-muted">{snoozeLabel(snoozeUntil(p.id, now), now)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {isDoneTab ? (
        <IconButton
          title="Reopen"
          onClick={(e) => {
            stop(e);
            onReopen();
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </IconButton>
      ) : (
        <IconButton
          title="Done"
          onClick={(e) => {
            stop(e);
            onDone();
          }}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
        </IconButton>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" title="Assign" aria-label="Assign" className={BTN} onClick={stop}>
            <UserPlus className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" onClick={stop} className="max-h-64 overflow-y-auto">
          {currentUserId && (
            <DropdownMenuItem onSelect={() => onAssign(currentUserId)} className="text-[13px] font-medium">
              Assign to me
            </DropdownMenuItem>
          )}
          {staff.map((s) => (
            <DropdownMenuItem key={s.id} onSelect={() => onAssign(s.id)} className="text-[13px]">
              {s.name}
            </DropdownMenuItem>
          ))}
          {staff.length > 0 && <DropdownMenuSeparator />}
          <DropdownMenuItem onSelect={() => onAssign(null)} className="text-[13px] text-social-muted">
            Unassigned
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
