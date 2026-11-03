import type { PipelineCounts, PipelineQuick } from "@/features/transaction";
import { FilterChip } from "@/features/pipeline/shared/filter-chip";

const CHIPS: Array<{ key: PipelineQuick | null; label: string; count: keyof PipelineCounts }> = [
  { key: null, label: "All deals", count: "all" },
  { key: "no_task", label: "No task scheduled", count: "no_task" },
  { key: "quiet_7", label: "Quiet 7+ days", count: "quiet_7" },
];

/** Single-select quick filters with live counts over the open deals. */
export function QuickChips({
  value,
  counts,
  onChange,
}: {
  value: PipelineQuick | null;
  counts: PipelineCounts | undefined;
  onChange: (value: PipelineQuick | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" data-testid="pipeline-quick-chips">
      {CHIPS.map((chip) => (
        <FilterChip key={chip.label} active={value === chip.key} onClick={() => onChange(chip.key)} testId={`chip-quick-${chip.key ?? "all"}`}>
          {chip.label}
          {counts ? ` ${counts[chip.count]}` : ""}
        </FilterChip>
      ))}
    </div>
  );
}
