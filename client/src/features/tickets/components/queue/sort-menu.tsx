import { ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import type { QueueSort } from "../../lib/ticket-queue";

export const SORT_OPTIONS: Array<{ value: QueueSort; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "due", label: "Due soonest" },
  { value: "priority", label: "Priority, highest first" },
  { value: "updated", label: "Recently updated" },
  { value: "client", label: "Client name" },
];

export function sortLabel(value: QueueSort): string {
  return SORT_OPTIONS.find((o) => o.value === value)?.label ?? "";
}

export function SortMenu({ value, onChange }: { value: QueueSort; onChange: (value: QueueSort) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as QueueSort)}>
      <SelectTrigger
        className="h-10 w-[200px] gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[12px] font-medium xl:w-[230px] xl:text-[13px]"
        aria-label="Sort tickets"
        data-testid="select-ticket-sort"
      >
        <span className="flex min-w-0 items-center gap-2">
          <ArrowUpDown className="h-[15px] w-[15px] shrink-0 text-social-muted" />
          <span className="truncate">Sort: {sortLabel(value)}</span>
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {SORT_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} className="text-[13px]">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
