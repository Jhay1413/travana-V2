import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, STAGE_LABEL, type PipelineStage } from "@/features/pipeline/lib/pipeline-helpers";
import { STAGE_STYLE } from "@/features/pipeline/lib/pipeline-stage-style";
import { ICON_BUTTON } from "@/features/pipeline/shared/button-styles";
import { StageCountChip } from "@/features/pipeline/shared/stage-pill";

/** Column header: coloured top bar, name, count pill, collapse button and value / profit totals. */
export function ColumnHeader({
  stage,
  total,
  totalValue,
  totalProfit,
  onCollapse,
}: {
  stage: PipelineStage;
  total: number;
  totalValue: number;
  totalProfit: number;
  onCollapse: () => void;
}) {
  return (
    <div className="relative flex-none px-3.5 pb-3 pt-3.5">
      <div className={cn("absolute left-3.5 right-3.5 top-0 h-[3px] rounded-b-[3px]", STAGE_STYLE[stage].barClass)} />
      <div className="mt-1 flex items-center gap-2">
        <h2 className="text-[16px] font-semibold">{STAGE_LABEL[stage]}</h2>
        <StageCountChip stage={stage} count={total} />
        <span className="flex-1" />
        <button type="button" aria-label={`Collapse ${STAGE_LABEL[stage]}`} className={ICON_BUTTON} onClick={onCollapse} data-testid={`button-collapse-${stage.toLowerCase()}`}>
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
      {stage !== "Lost" && (
        <div className="mt-1.5 flex items-baseline gap-1.5 whitespace-nowrap text-[12px] xl:text-[12.5px]" data-testid={`column-totals-${stage.toLowerCase().replace(" ", "-")}`}>
          <b className="font-semibold">{formatCurrency(totalValue)}</b>
          <span className="text-social-muted">value</span>
          <span className="text-[#B7C0CE]">·</span>
          <b className="font-semibold text-pipeline-profit">{formatCurrency(totalProfit)}</b>
          <span className="text-social-muted">profit</span>
        </div>
      )}
    </div>
  );
}
