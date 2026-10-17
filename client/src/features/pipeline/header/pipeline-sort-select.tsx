import { ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { PipelineSort } from "@/features/transaction";
import { PIPELINE_SORT_OPTIONS, sortLabel } from "@/features/pipeline/lib/pipeline-board-filters";

export function PipelineSortSelect({ value, onChange }: { value: PipelineSort; onChange: (value: PipelineSort) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as PipelineSort)}>
      <SelectTrigger
        className="h-10 w-[200px] gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] font-medium xl:w-[230px] xl:text-[13px]"
        aria-label="Sort deals"
        data-testid="select-pipeline-sort"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArrowUpDown className="h-[15px] w-[15px] shrink-0 text-social-muted" />
          <span className="truncate">Sort: {sortLabel(value)}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {PIPELINE_SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
