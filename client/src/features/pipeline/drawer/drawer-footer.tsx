import { Button } from "@/components/ui/button";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { STAGE_STYLE, nextStage } from "@/features/pipeline/lib/pipeline-stage-style";
import { DANGER_GHOST, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";

/** Sticky drawer footer: Mark as lost on the left; the primary move on the right. */
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
