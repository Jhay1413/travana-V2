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
    <Popover open={open} onOpenChange={setOpen}>
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
        // `@radix-ui/react-dismissable-layer` computes this popover's
        // `pointer-events` at RENDER time from a shared layer-set context, then
        // applies it as an inline style — the same layer bookkeeping that races
        // on slow environments (see docs/form-drawer-pointer-events-fix.md). If
        // this popover renders before the context finishes propagating that it's
        // the active layer, it inlines `pointer-events: none`: the dropdown
        // paints normally but swallows every click/keystroke. A Tailwind class
        // can't fix this (inline styles win), but `style` props are merged in
        // via Radix's `asChild`/Slot with the *child's* value winning on
        // conflict, so this forces it back to `auto` regardless of which way
        // that race went. Safe here because the "Add new" button below closes
        // this popover before opening anything on top of it, so it is never
        // legitimately meant to be non-interactive while mounted.
        style={{ pointerEvents: "auto" }}
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
                  // popover's `pointer-events` is forced to `auto` above, so
                  // leaving it open underneath a real modal would let clicks
                  // leak through to it while the modal is supposed to be the
                  // only interactive layer.
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
