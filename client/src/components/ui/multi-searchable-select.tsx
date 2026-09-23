import { useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface MultiSearchableSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  "data-testid"?: string;
  /** Called with the typed search string — enables server-side search (disables client-side filtering) */
  onSearch?: (search: string) => void;
  /** Called with the typed search string without disabling client-side filtering — use to capture the term for modals */
  onSearchCapture?: (search: string) => void;
  /** Show a loading indicator in the dropdown while fetching */
  isLoading?: boolean;
  /** Labels for selected values that may not be present in the current options (async search). Keyed by value. */
  selectedLabels?: Record<string, string>;
  /** If provided, an "Add" button is always shown pinned at the bottom of the list and this callback is invoked when clicked */
  onAddNew?: () => void;
  /** Label for the add-new button (default: "Add new") */
  addNewLabel?: string;
  /** Maximum number of chips to render before collapsing to a "+N more" count (default: 3) */
  maxChips?: number;
  /**
   * Whether the popover traps focus and locks page scroll while open (Radix's
   * `Popover` `modal` prop). Defaults to `true`: this popover is portaled to
   * `document.body`, so when it's rendered inside a Radix `Dialog` (e.g. a
   * form drawer), the Dialog's own `FocusScope`/`RemoveScroll` fight a
   * non-modal popover for focus and scroll — you can't click into the search
   * box or scroll the list. Modal gives the popover its own focus trap and
   * its own scroll-lock scoped to itself, so it stops fighting the Dialog.
   * Set to `false` to opt out for a call site that isn't inside a Dialog and
   * doesn't want the scroll-lock/focus-trap/`aria-hidden` side effects.
   */
  modal?: boolean;
}

export function MultiSearchableSelect({
  value,
  onValueChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  className,
  "data-testid": dataTestId,
  onSearch,
  onSearchCapture,
  isLoading,
  selectedLabels,
  onAddNew,
  addNewLabel = "Add new",
  maxChips = 3,
  modal = true,
}: MultiSearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const labelFor = (val: string) =>
    selectedLabels?.[val] || options.find((opt) => opt.value === val)?.label || val;

  const toggle = (val: string) => {
    if (value.includes(val)) {
      onValueChange(value.filter((v) => v !== val));
    } else {
      onValueChange([...value, val]);
    }
  };

  const remove = (val: string) => onValueChange(value.filter((v) => v !== val));

  const visible = value.slice(0, maxChips);
  const overflow = value.length - visible.length;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-auto min-h-9 w-full justify-between rounded-xl border-black/10 bg-white/70 py-1.5 font-normal",
            className
          )}
          data-testid={dataTestId}
        >
          {value.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            <span className="flex flex-wrap items-center gap-1">
              {visible.map((val) => (
                <Badge
                  key={val}
                  variant="secondary"
                  className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium"
                >
                  <span className="max-w-[120px] truncate">{labelFor(val)}</span>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      remove(val);
                    }}
                    className="rounded-sm opacity-60 hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
              {overflow > 0 && (
                <Badge variant="secondary" className="rounded-md px-1.5 py-0.5 text-[11px] font-medium">
                  +{overflow} more
                </Badge>
              )}
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[500] w-[--radix-popover-trigger-width] p-0"
        align="start"
        side="bottom"
      >
        <Command
          {...(onSearch
            ? { shouldFilter: false }
            : { filter: (val, search) => (val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0) }
          )}
        >
          <CommandInput
            placeholder={searchPlaceholder}
            onValueChange={(val) => {
              if (onSearch) onSearch(val);
              if (onSearchCapture) onSearchCapture(val);
            }}
          />
          <CommandList>
            <CommandEmpty>{isLoading ? "Searching…" : emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => toggle(opt.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(opt.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {onAddNew && (
            <div className="border-t border-black/10 p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Close before opening the "Add new" dialog on top — this
                  // popover is modal (see the `modal` prop above), so it holds
                  // its own focus trap while mounted. Opening `AddAirportModal`
                  // on top of a still-open popover would leave two competing
                  // focus traps; closing first avoids that.
                  setOpen(false);
                  onAddNew();
                }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-multi-add-new"
              >
                <Plus className="h-3.5 w-3.5" /> {addNewLabel}
              </button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
