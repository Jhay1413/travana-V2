import { useState } from "react";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
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
  /** Label to display for the selected value when it may not be present in current options */
  selectedLabel?: string;
  /** If provided, an "Add" button is always shown pinned at the bottom of the list and this callback is invoked when clicked */
  onAddNew?: () => void;
  /** Label for the add-new button (default: "Add new") */
  addNewLabel?: string;
  /** Disable the trigger (e.g. while loading or until an upstream value is chosen) */
  disabled?: boolean;
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

export function SearchableSelect({
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
  selectedLabel,
  onAddNew,
  addNewLabel = "Add new",
  disabled,
  modal = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);

  const resolvedLabel = selectedLabel || options.find((opt) => opt.value === value)?.label;

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-9 w-full justify-between rounded-xl border-black/10 bg-white/70 font-normal",
            !value && "text-muted-foreground",
            className
          )}
          data-testid={dataTestId}
        >
          <span className="truncate">{resolvedLabel || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[500] max-h-[--radix-popover-content-available-height] w-[--radix-popover-trigger-width] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
      >
        <Command
          {...(onSearch
            ? { shouldFilter: false }
            : { filter: (val, search) => val.toLowerCase().includes(search.toLowerCase()) ? 1 : 0 }
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
                  onSelect={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
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
                  setOpen(false);
                  onAddNew();
                }}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-2 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                data-testid="button-searchable-add-new"
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
