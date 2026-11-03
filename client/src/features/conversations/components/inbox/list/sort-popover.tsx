import { ChevronDown } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { SORT_OPTIONS, type SortKey, type SortPreference } from "../lib";

export interface SortPopoverProps {
  sort: SortPreference;
  onSortChange: (pref: SortPreference) => void;
}

export function SortPopover({ sort, onSortChange }: SortPopoverProps) {
  const current = SORT_OPTIONS.find((o) => o.key === sort.key) ?? SORT_OPTIONS[0];
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[38px] min-w-0 flex-1 items-center justify-between gap-2 rounded-lg border border-social-border bg-card px-3 text-[13px] font-medium hover:bg-muted/40"
          data-testid="inbox-sort"
        >
          <span className="truncate">{current.label}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-social-muted" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-social-muted">Sort by</p>
        <RadioGroup value={sort.key} onValueChange={(v) => onSortChange({ ...sort, key: v as SortKey })} className="gap-1">
          {SORT_OPTIONS.map((o) => (
            <Label
              key={o.key}
              htmlFor={`sort-${o.key}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-muted/40"
            >
              <RadioGroupItem id={`sort-${o.key}`} value={o.key} className="mt-0.5" />
              <span className="flex flex-col">
                <span className="text-[14px] font-medium">{o.label}</span>
                <span className="text-[12px] font-normal text-social-muted">{o.sub}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <div className="mt-2 space-y-2 border-t border-social-border pt-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="sort-unread-top" className="text-[13px] font-normal">Keep unread at the top</Label>
            <Switch
              id="sort-unread-top"
              checked={sort.unreadFirst}
              onCheckedChange={(v) => onSortChange({ ...sort, unreadFirst: v })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="sort-remember" className="text-[13px] font-normal">Remember my choice</Label>
            <Switch
              id="sort-remember"
              checked={sort.remember}
              onCheckedChange={(v) => onSortChange({ ...sort, remember: v })}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
