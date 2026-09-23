import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFixedDropdownPosition } from "@/hooks/use-fixed-dropdown-position";
import { useCloseOnOutsideOrEscape } from "@/hooks/use-close-on-outside-or-escape";

interface MultiSearchableSelectOption {
  value: string;
  label: string;
}

interface MultiSearchableSelectProps {
  value: string[];
  onValueChange: (value: string[]) => void;
  options: MultiSearchableSelectOption[];
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

/**
 * A multi-select combobox with an in-place search input, chips for selected values, and
 * toggle (not replace) selection.
 *
 * Rendered the same way as `SearchableSelect` — see that component's doc comment and
 * `docs/form-drawer-pointer-events-fix.md` (section 6) for why: the dropdown is a plain
 * sibling in this component's own JSX (not a Radix `Popover` portaled to `document.body`),
 * positioned with `position: fixed` from the trigger's `getBoundingClientRect()`. Shares
 * its position and dismiss logic with `SearchableSelect` via `useFixedDropdownPosition`
 * and `useCloseOnOutsideOrEscape`.
 */
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
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = (index: number) => `${baseId}-option-${index}`;

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

  const filteredOptions = useMemo(() => {
    if (onSearch || !search) return options;
    const term = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search, onSearch]);

  const position = useFixedDropdownPosition(triggerRef, open);

  // Close on outside pointerdown or Escape; Escape also returns focus to the trigger.
  useCloseOnOutsideOrEscape(open, () => setOpen(false), [triggerRef, dropdownRef], triggerRef);

  // Reset search + highlight on every open, and focus the search input.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }, [open]);

  // Reset the active-option highlight whenever the filtered list changes.
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[highlightedIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, highlightedIndex]);

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (filteredOptions.length === 0) return;
        setHighlightedIndex((i) => (i + 1) % filteredOptions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (filteredOptions.length === 0) return;
        setHighlightedIndex((i) => (i - 1 + filteredOptions.length) % filteredOptions.length);
        break;
      case "Enter": {
        e.preventDefault();
        const opt = filteredOptions[highlightedIndex];
        // Toggle, not replace — unlike SearchableSelect, Enter keeps the dropdown open so
        // more options can be picked.
        if (opt) toggle(opt.value);
        break;
      }
      default:
        break;
    }
  };

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        className={cn(
          "h-auto min-h-9 w-full justify-between rounded-xl border-black/10 bg-white/70 py-1.5 font-normal",
          className
        )}
        data-testid={dataTestId}
        onClick={() => setOpen((prev) => !prev)}
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

      {open && position && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
          aria-multiselectable="true"
          className="fixed z-[500] flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none dark:border-white/10"
          style={{
            left: position.left,
            width: position.width,
            maxHeight: position.maxHeight,
            top: position.top,
            bottom: position.bottom,
          }}
        >
          <div className="flex items-center border-b px-3 dark:border-white/10">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                const val = e.target.value;
                setSearch(val);
                if (onSearch) onSearch(val);
                if (onSearchCapture) onSearchCapture(val);
              }}
              onKeyDown={handleInputKeyDown}
              placeholder={searchPlaceholder}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              aria-autocomplete="list"
              aria-controls={listboxId}
              aria-activedescendant={
                filteredOptions.length > 0 ? getOptionId(highlightedIndex) : undefined
              }
              className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-1">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm">
                {isLoading ? "Searching…" : emptyMessage}
              </div>
            ) : (
              filteredOptions.map((opt, index) => (
                <div
                  key={opt.value}
                  id={getOptionId(index)}
                  ref={(el) => {
                    optionRefs.current[index] = el;
                  }}
                  role="option"
                  aria-selected={value.includes(opt.value)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => toggle(opt.value)}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    index === highlightedIndex && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value.includes(opt.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {opt.label}
                </div>
              ))
            )}
          </div>
          {onAddNew && (
            <div className="border-t border-black/10 p-1 dark:border-white/10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  // Close before calling onAddNew — it opens a modal on top, and the
                  // ordering matters the same way it did with the old Popover-based
                  // implementation.
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
        </div>
      )}
    </>
  );
}
