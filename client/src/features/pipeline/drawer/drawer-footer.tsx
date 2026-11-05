import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { DANGER_GHOST, PRIMARY_ACTION } from "@/features/pipeline/shared/button-styles";
import { drawerFooterModel } from "./drawer-footer-model";

/** Sticky drawer footer: Mark as lost on the left; Open full deal on the right. */
export function DrawerFooter({
  stage,
  onMarkLost,
  onOpenFull,
  clientDeleted = false,
  canOpenDeletedClient = false,
}: {
  stage: PipelineStage;
  onMarkLost: () => void;
  onOpenFull: () => void;
  clientDeleted?: boolean;
  canOpenDeletedClient?: boolean;
}) {
  const model = drawerFooterModel(stage, { clientDeleted, canOpenDeletedClient });

  return (
    <div className="flex flex-none items-center justify-between gap-3 border-t border-pipeline-card-border bg-card px-7 py-4">
      {model.canMarkLost ? (
        <Button type="button" variant="outline" className={DANGER_GHOST} onClick={onMarkLost} data-testid="button-drawer-mark-lost">
          Mark as lost
        </Button>
      ) : (
        <span />
      )}
      <Button type="button" className={PRIMARY_ACTION} onClick={onOpenFull} disabled={model.openDisabled} title={model.disabledLabel ?? undefined} data-testid="button-drawer-primary">
        {model.disabledLabel ?? model.primaryLabel}
        <ExternalLink className="ml-1.5 h-3.5 w-3.5" strokeWidth={2} />
      </Button>
    </div>
  );
}
