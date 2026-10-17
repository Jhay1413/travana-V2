import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { STAGE_STYLE } from "@/features/pipeline/lib/pipeline-stage-style";

export function StagePill({ stage, className }: { stage: PipelineStage; className?: string }) {
  const style = STAGE_STYLE[stage];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-[3px] text-[12px] font-semibold",
        style.chipClass,
        className,
      )}
    >
      {stage === "Booked" && <Check className="h-3 w-3" strokeWidth={3} />}
      {style.pill}
    </span>
  );
}

/** Small count pill used in column headers and the collapsed rail. */
export function StageCountChip({ stage, count }: { stage: PipelineStage; count: number }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] min-w-6 items-center justify-center rounded-full px-2 text-[12px] font-semibold",
        STAGE_STYLE[stage].chipClass,
      )}
    >
      {count}
    </span>
  );
}
