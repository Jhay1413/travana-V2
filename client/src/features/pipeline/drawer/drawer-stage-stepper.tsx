import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { STEPPER_STAGES, STAGE_STYLE } from "@/features/pipeline/lib/pipeline-stage-style";
import type { PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";

/** Four 6px bars: done (navy), current (orange), to do (grey). Hidden for Lost. */
export function DrawerStageStepper({ stage }: { stage: PipelineStage }) {
  const idx = STEPPER_STAGES.indexOf(stage);
  return (
    <div className="flex gap-2" data-testid="drawer-stage-stepper">
      {STEPPER_STAGES.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "cur" : "todo";
        return (
          <div key={s} className="flex-1">
            <div className={cn("h-1.5 rounded-[3px]", state === "done" && "bg-stage-booked-bg", state === "cur" && "bg-social-orange", state === "todo" && "bg-pipeline-card-border")} />
            <div className={cn("mt-1.5 flex items-center gap-1 text-[12px]", state === "todo" ? "font-medium text-social-muted" : "font-semibold")}>
              {state === "done" && <Check className="h-3 w-3" strokeWidth={3} />}
              {STAGE_STYLE[s].pill}
            </div>
          </div>
        );
      })}
    </div>
  );
}
