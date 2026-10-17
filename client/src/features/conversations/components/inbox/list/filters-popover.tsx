import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ConversationChannel, ConversationTag } from "../../../types";
import {
  EMPTY_FILTERS,
  countActiveFilters,
  type AssignedFilter,
  type InboxFilters,
  type LastMessageFilter,
  type StatusFilter,
} from "../lib";
import { CHANNEL_META, Segmented } from "../shared";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "needs_reply", label: "Needs reply" },
  { value: "waiting", label: "Waiting on client" },
  { value: "overdue", label: "Overdue" },
];

const CHANNEL_ORDER = Object.keys(CHANNEL_META) as ConversationChannel[];

function toggle<T>(list: T[], item: T): T[] {
  return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}

function SectionLabel({ children }: { children: string }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-social-muted">{children}</p>;
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-[12px] font-medium transition",
        active
          ? "border-[#1F2937] bg-[#1F2937] text-white"
          : "border-social-border bg-card text-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  );
}

export interface FiltersPopoverProps {
  filters: InboxFilters;
  onFiltersChange: (f: InboxFilters) => void;
  channelCounts: Record<ConversationChannel, number>;
  tagOptions: ConversationTag[];
  unassignedCount: number;
}

export function FiltersPopover({ filters, onFiltersChange, channelCounts, tagOptions, unassignedCount }: FiltersPopoverProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<InboxFilters>(filters);
  const active = countActiveFilters(filters);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(filters);
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[38px] items-center gap-2 rounded-lg border border-social-border bg-card px-3 text-[13px] font-medium hover:bg-muted/40"
          data-testid="inbox-filters"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {active > 0 && (
            <span className="rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold text-white">{active}</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b border-social-border px-4 py-3">
          <h3 className="text-[14px] font-semibold">Filters</h3>
          <button
            type="button"
            onClick={() => setDraft(EMPTY_FILTERS)}
            className="text-[12px] font-medium text-social-orange-text hover:underline"
          >
            Clear all
          </button>
        </div>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <SectionLabel>Channels</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {CHANNEL_ORDER.map((ch) => (
                <Label key={ch} className="flex cursor-pointer items-center gap-2 text-[13px] font-normal">
                  <Checkbox
                    checked={draft.channels.includes(ch)}
                    onCheckedChange={() => setDraft((d) => ({ ...d, channels: toggle(d.channels, ch) }))}
                  />
                  <span>{CHANNEL_META[ch].label}</span>
                  <span className="text-social-muted">{channelCounts[ch]}</span>
                </Label>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Assigned to</SectionLabel>
            <Segmented<AssignedFilter>
              value={draft.assigned}
              onChange={(assigned) => setDraft((d) => ({ ...d, assigned }))}
              items={[
                { value: "anyone", label: "Anyone" },
                { value: "me", label: "Me" },
                { value: "unassigned", label: "Unassigned", count: unassignedCount },
              ]}
            />
          </div>
          {tagOptions.length > 0 && (
            <div>
              <SectionLabel>Tag</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {tagOptions.map((t) => (
                  <ToggleChip
                    key={t.id}
                    active={draft.tags.includes(t.id)}
                    onClick={() => setDraft((d) => ({ ...d, tags: toggle(d.tags, t.id) }))}
                  >
                    {t.name}
                  </ToggleChip>
                ))}
              </div>
            </div>
          )}
          <div>
            <SectionLabel>Status</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((s) => (
                <ToggleChip
                  key={s.value}
                  active={draft.status.includes(s.value)}
                  onClick={() => setDraft((d) => ({ ...d, status: toggle(d.status, s.value) }))}
                >
                  {s.label}
                </ToggleChip>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Last message</SectionLabel>
            <Select
              value={draft.lastMessage}
              onValueChange={(v) => setDraft((d) => ({ ...d, lastMessage: v as LastMessageFilter }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end border-t border-social-border px-4 py-3">
          <button
            type="button"
            onClick={() => {
              onFiltersChange(draft);
              setOpen(false);
            }}
            className="h-9 rounded-lg bg-social-navy px-4 text-[13px] font-semibold text-white hover:opacity-90"
            data-testid="inbox-filters-apply"
          >
            Apply
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
