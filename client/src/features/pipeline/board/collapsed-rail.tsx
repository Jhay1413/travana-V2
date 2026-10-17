import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { STAGE_LABEL, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { ICON_BUTTON } from "@/features/pipeline/shared/button-styles";
import { StageCountChip } from "@/features/pipeline/shared/stage-pill";

/** A column collapsed to a 52px rail: expand button, vertical label and count. It still accepts drops. */
export function CollapsedRail({
  stage,
  count,
  isOver,
  onExpand,
  dropHandlers,
}: {
  stage: PipelineStage;
  count: number;
  isOver: boolean;
  onExpand: () => void;
  dropHandlers: Pick<React.HTMLAttributes<HTMLDivElement>, "onDragOver" | "onDragLeave" | "onDrop">;
}) {
  return (
    <div
      className={cn(
        "flex w-[52px] flex-none flex-col items-center gap-3.5 rounded-2xl bg-pipeline-column-bg py-3.5",
        isOver && "bg-pipeline-drop-bg",
      )}
      {...dropHandlers}
      data-testid={`pipeline-column-${stage.toLowerCase().replace(" ", "-")}-collapsed`}
    >
      <button type="button" aria-label={`Expand ${STAGE_LABEL[stage]}`} className={ICON_BUTTON} onClick={onExpand} data-testid={`button-expand-${stage.toLowerCase()}`}>
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
      <span className="whitespace-nowrap text-[15px] font-semibold" style={{ writingMode: "vertical-rl" }}>
        {STAGE_LABEL[stage]}
      </span>
      <StageCountChip stage={stage} count={count} />
    </div>
  );
}
