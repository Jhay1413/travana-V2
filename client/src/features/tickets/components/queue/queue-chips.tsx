import { FilterChip } from "@/features/pipeline/shared/filter-chip";
import type { QueueChip, QueueCounts } from "../../lib/ticket-queue";

const CHIPS: Array<{ key: QueueChip; label: string }> = [
  { key: "open", label: "All open" },
  { key: "attention", label: "Needs attention" },
  { key: "unassigned", label: "Unassigned" },
  { key: "closed", label: "Closed" },
];

/** Single-select count chips over the current scope. */
export function QueueChips({ value, counts, onChange, nowrap = false }: { value: QueueChip; counts: QueueCounts; onChange: (value: QueueChip) => void; nowrap?: boolean }) {
  return (
    <div className={nowrap ? "flex gap-2 overflow-x-auto" : "flex flex-wrap gap-2"} data-testid="ticket-chips">
      {CHIPS.map((chip) => (
        <FilterChip key={chip.key} active={value === chip.key} onClick={() => onChange(chip.key)} testId={`chip-ticket-${chip.key}`} className="flex-none">
          {chip.label} {counts[chip.key]}
        </FilterChip>
      ))}
    </div>
  );
}
