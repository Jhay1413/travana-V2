import { ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FreeQuoteStatusCounts } from "@/features/quote/api/quote.api";
import { useTags } from "@/features/tag";
import { cn } from "@/lib/utils";
import { StatusChips } from "./status-chips";
import type { StatusFilter, TagFilter, WhenFilter } from "./grid-filters";

interface GridToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  status: StatusFilter;
  onStatusChange: (value: StatusFilter) => void;
  counts: FreeQuoteStatusCounts | undefined;
  when: WhenFilter;
  onWhenChange: (value: WhenFilter) => void;
  from: string;
  to: string;
  onRangeChange: (range: { from: string; to: string }) => void;
  tag: TagFilter;
  onTagChange: (value: TagFilter) => void;
  tagNames: string[];
  onTagNamesChange: (names: string[]) => void;
}

const WHEN_OPTIONS: { value: WhenFilter; label: string }[] = [
  { value: "all", label: "All scheduled" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range…" },
];

const TAG_OPTIONS: { value: TagFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "portal", label: "Add to Portal" },
  { value: "featured", label: "Featured deal" },
];

const TRIGGER = "h-10 gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[13px] font-medium";
const DATE_INPUT = "h-10 rounded-[10px] border border-social-border bg-card px-3 text-[13px] text-foreground outline-none";
const PREFIX = "font-normal text-social-muted";

export function GridToolbar(props: GridToolbarProps) {
  const { data: availableTags } = useTags();
  const { tagNames, onTagNamesChange } = props;

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <label className="flex h-10 w-[300px] max-w-full items-center gap-2 rounded-[10px] border border-social-border bg-card px-3 text-[13px]">
        <Search className="h-4 w-4 shrink-0 text-[#8A94A6]" />
        <input
          type="search"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
          placeholder="Search title, hotel, destination"
          aria-label="Search social posts"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-[#8A94A6]"
          data-testid="input-search-social-posts"
        />
      </label>

      <StatusChips value={props.status} counts={props.counts} onChange={props.onStatusChange} />

      <span className="flex-1" />

      <Select value={props.when} onValueChange={(v) => WHEN_OPTIONS.some((o) => o.value === v) && props.onWhenChange(v as WhenFilter)}>
        <SelectTrigger className={cn(TRIGGER, "w-[200px]")} aria-label="When" data-testid="select-when">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={PREFIX}>When</span>
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {WHEN_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-[13px]">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {props.when === "custom" && (
        <>
          <label className="flex items-center gap-1.5 text-[13px]">
            <span className={PREFIX}>From</span>
            <input
              type="date"
              value={props.from}
              max={props.to || undefined}
              onChange={(e) => props.onRangeChange({ from: e.target.value, to: props.to })}
              aria-label="From date"
              className={DATE_INPUT}
              data-testid="input-when-from"
            />
          </label>
          <label className="flex items-center gap-1.5 text-[13px]">
            <span className={PREFIX}>To</span>
            <input
              type="date"
              value={props.to}
              min={props.from || undefined}
              onChange={(e) => props.onRangeChange({ from: props.from, to: e.target.value })}
              aria-label="To date"
              className={DATE_INPUT}
              data-testid="input-when-to"
            />
          </label>
        </>
      )}

      <Select value={props.tag} onValueChange={(v) => TAG_OPTIONS.some((o) => o.value === v) && props.onTagChange(v as TagFilter)}>
        <SelectTrigger className={cn(TRIGGER, "w-[150px]")} aria-label="Tags" data-testid="select-tag-filter">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={PREFIX}>Tags</span>
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {TAG_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-[13px]">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className={cn(TRIGGER, "w-[170px] justify-between hover:bg-card")} data-testid="button-filter-tags">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className={PREFIX}>Quote tags</span>
              {tagNames.length > 0 && <span className="font-semibold">{tagNames.length}</span>}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="max-h-80 w-56 overflow-y-auto">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-medium text-social-muted">Filter by tag</span>
            {tagNames.length > 0 && (
              <button type="button" onClick={() => onTagNamesChange([])} className="text-xs text-blue-600 hover:underline">
                Clear
              </button>
            )}
          </div>
          <DropdownMenuSeparator />
          {!availableTags || availableTags.length === 0 ? (
            <div className="px-2 py-3 text-xs text-social-muted">No tags yet</div>
          ) : (
            availableTags.map((t) => (
              <DropdownMenuCheckboxItem
                key={t.id}
                checked={tagNames.includes(t.name)}
                onSelect={(e) => e.preventDefault()}
                onCheckedChange={(checked) => onTagNamesChange(checked ? [...tagNames, t.name] : tagNames.filter((n) => n !== t.name))}
                className="text-xs"
              >
                {t.name}
              </DropdownMenuCheckboxItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
