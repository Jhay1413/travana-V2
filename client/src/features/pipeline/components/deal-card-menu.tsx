import { Ellipsis, PartyPopper } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORITY_META, PRIORITY_OPTIONS, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";

type Priority = "low" | "medium" | "high";

/** The clickable priority dot + label; opens a small menu to change it. For
 *  the Booked column the caller renders the "Nice One !!" badge instead. */
export function PriorityControl({
  priority,
  onChange,
  disabled,
}: {
  priority: Priority;
  onChange: (priority: Priority) => void;
  disabled?: boolean;
}) {
  const meta = PRIORITY_META[priority];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md px-1 py-0.5 hover:bg-black/[0.04]"
          onClick={(e) => e.stopPropagation()}
          data-testid="button-deal-priority"
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: meta.color }} />
          <span className="text-xs font-medium text-black/70 3xl:text-[13px]">{meta.label}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {PRIORITY_OPTIONS.map((p) => (
          <DropdownMenuItem key={p} onClick={() => onChange(p)} data-testid={`menu-priority-${p}`}>
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_META[p].color }} />
            {PRIORITY_META[p].label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Booked-stage cards swap the priority indicator for a celebratory badge. */
export function NiceOneBadge() {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium text-black/70 3xl:text-[13px]">
      <PartyPopper className="h-3.5 w-3.5 text-[#f59e0b]" />
      Nice One !!
    </span>
  );
}

export function DealCardOverflowMenu({
  stage,
  onOpen,
  onSetPriority,
  onMoveToFuture,
  onReturnToPipeline,
  onMarkLost,
  onRestore,
}: {
  stage: PipelineStage;
  onOpen: () => void;
  onSetPriority: (priority: Priority) => void;
  onMoveToFuture: () => void;
  onReturnToPipeline: () => void;
  onMarkLost: () => void;
  onRestore: () => void;
}) {
  const canMarkLost = stage === "Enquiry" || stage === "Quoted" || stage === "In Play";
  const isFuture = stage === "Future";
  const isLost = stage === "Lost";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn("rounded-md p-1 hover:bg-black/[0.06]")}
          onClick={(e) => e.stopPropagation()}
          data-testid="button-deal-menu"
        >
          <Ellipsis className="h-3.5 w-3.5 text-black/50" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()} className="w-48">
        <DropdownMenuItem onClick={onOpen} data-testid="menu-open-deal">Open</DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger data-testid="menu-set-priority">Set priority</DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent>
              {PRIORITY_OPTIONS.map((p) => (
                <DropdownMenuItem key={p} onClick={() => onSetPriority(p)} data-testid={`menu-set-priority-${p}`}>
                  <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_META[p].color }} />
                  {PRIORITY_META[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        {isFuture ? (
          <DropdownMenuItem onClick={onReturnToPipeline} data-testid="menu-return-to-pipeline">Return to pipeline</DropdownMenuItem>
        ) : !isLost ? (
          <DropdownMenuItem onClick={onMoveToFuture} data-testid="menu-move-to-future">Move to Future…</DropdownMenuItem>
        ) : null}
        {isLost ? (
          <DropdownMenuItem onClick={onRestore} data-testid="menu-restore-deal">Restore</DropdownMenuItem>
        ) : canMarkLost ? (
          <DropdownMenuItem onClick={onMarkLost} className="text-rose-600 focus:text-rose-600" data-testid="menu-mark-lost">Mark as Lost</DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
