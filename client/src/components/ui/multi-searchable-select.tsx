import { useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
  /** If provided, an "Add" button is shown in the empty state and this callback is invoked when clicked */
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
      <PopoverContent className="z-[500] w-[--radix-popover-trigger-width] p-0" align="start" side="bottom" avoidCollisions={false}>
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
            <CommandEmpty>
              {isLoading ? (
                "Searching…"
              ) : onAddNew ? (
                <div className="flex flex-col items-center gap-2 py-1">
                  <span className="text-sm text-muted-foreground">{emptyMessage}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAddNew();
                    }}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    + {addNewLabel}
                  </button>
                </div>
              ) : (
                emptyMessage
              )}
            </CommandEmpty>
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
        </Command>
      </PopoverContent>
    </Popover>
  );
}
