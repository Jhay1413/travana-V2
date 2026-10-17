import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STAGE_LABEL, isValidDrop, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { STAGE_STYLE, STEPPER_STAGES, nextStage } from "@/features/pipeline/lib/pipeline-stage-style";
import { DANGER_GHOST, OUTLINE_ACTION, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { useState } from "react";

/** Sticky drawer footer: Mark as lost on the left; Move to… and the primary move on the right. */
export function DrawerFooter({
  stage,
  naturalStage,
  onMarkLost,
  onMove,
  onClose,
}: {
  stage: PipelineStage;
  /** The stepper stage — equals `stage` except for Future deals. */
  naturalStage: PipelineStage;
  onMarkLost: () => void;
  onMove: (to: PipelineStage) => void;
  onClose: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const next = nextStage(naturalStage);
  const canLose = stage !== "Lost" && stage !== "Booked";

  return (
    <div className="flex flex-none items-center justify-between gap-3 border-t border-pipeline-card-border bg-card px-7 py-4">
      {canLose ? (
        <Button type="button" variant="outline" className={DANGER_GHOST} onClick={onMarkLost} data-testid="button-drawer-mark-lost">
          Mark as lost
        </Button>
      ) : (
        <span />
      )}
      <div className="flex gap-2">
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" className={OUTLINE_ACTION} data-testid="button-drawer-move-to">
              Move to…
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="z-[600] w-[200px] p-1">
            {STEPPER_STAGES.filter((s) => isValidDrop(stage, s)).map((s) => (
              <button
                key={s}
                type="button"
                className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-muted"
                onClick={() => { setMenuOpen(false); onMove(s); }}
              >
                {STAGE_LABEL[s]}
              </button>
            ))}
          </PopoverContent>
        </Popover>
        {stage === "Lost" ? (
          <Button type="button" className={PRIMARY_ACTION} onClick={() => onMove("Enquiry")} data-testid="button-drawer-primary">
            Reopen deal
          </Button>
        ) : next ? (
          <Button type="button" className={PRIMARY_ACTION} onClick={() => onMove(next)} data-testid="button-drawer-primary">
            Move to {STAGE_STYLE[next].pill}
          </Button>
        ) : (
          <Button type="button" className={PRIMARY_ACTION} onClick={onClose} data-testid="button-drawer-primary">
            Done
          </Button>
        )}
      </div>
    </div>
  );
}
