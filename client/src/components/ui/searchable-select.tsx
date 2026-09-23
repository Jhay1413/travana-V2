import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SearchableSelectOption[];
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
}

/** Computed placement for the dropdown, in viewport (`position: fixed`) coordinates. */
interface DropdownPosition {
  left: number;
  width: number;
  top?: number;
  bottom?: number;
  maxHeight: number;
}

const VIEWPORT_PADDING = 8; // mirrors the old Popover's `collisionPadding={8}`
const TRIGGER_OFFSET = 4; // mirrors the old Popover's `sideOffset={4}`
const MIN_DROPDOWN_HEIGHT = 150; // below this much room, prefer flipping above the trigger

/**
 * A combobox-style select with an in-place search input.
 *
 * Two decisions here are non-obvious — both are explained in detail in
 * `docs/form-drawer-pointer-events-fix.md` (section 6), which documents the bug this
 * rewrite fixes:
 *
 * 1. The dropdown is rendered as a plain sibling of the trigger in this component's own
 *    JSX — it is **not** portaled to `document.body` (as Radix `Popover`/`PopoverContent`
 *    did). When this component is used inside a Radix `Dialog` (e.g. a `Sheet` form
 *    drawer), a portaled popover renders *outside* the Dialog's DOM subtree, and the
 *    Dialog's own `FocusScope`/`RemoveScroll` — both scoped to the Dialog's content node —
 *    fight the portaled popover for focus and scroll. That's what made the search input
 *    unfocusable. Keeping the dropdown inside this component's own subtree means it's
 *    naturally inside the Dialog's focus scope, so there's nothing left to fight.
 * 2. Because the dropdown is no longer portaled, it would otherwise be clipped by any
 *    ancestor with `overflow: hidden`/`overflow-y: auto` — which the drawer's scroll
 *    container is. `position: fixed`, with coordinates computed from the trigger's
 *    `getBoundingClientRect()`, escapes that clipping the same way a portal would have,
 *    without leaving the component's own DOM subtree.
 */
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
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [position, setPosition] = useState<DropdownPosition | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);

  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const getOptionId = (index: number) => `${baseId}-option-${index}`;

  const resolvedLabel = selectedLabel || options.find((opt) => opt.value === value)?.label;

  const filteredOptions = useMemo(() => {
    if (onSearch || !search) return options;
    const term = search.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, search, onSearch]);

  // Compute (and, while open, keep recomputing) the dropdown's fixed-position
  // coordinates from the trigger's current bounding rect. useLayoutEffect so the
  // first paint after opening already has the right position — no flash at (0, 0).
  useLayoutEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;

      const rect = trigger.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const spaceBelow = viewportHeight - rect.bottom - VIEWPORT_PADDING;
      const spaceAbove = rect.top - VIEWPORT_PADDING;
      const placeAbove = spaceBelow < MIN_DROPDOWN_HEIGHT && spaceAbove > spaceBelow;

      let left = rect.left;
      const width = rect.width;
      if (left + width > viewportWidth - VIEWPORT_PADDING) {
        left = viewportWidth - VIEWPORT_PADDING - width;
      }
      if (left < VIEWPORT_PADDING) left = VIEWPORT_PADDING;

      setPosition(
        placeAbove
          ? {
              left,
              width,
              bottom: viewportHeight - rect.top + TRIGGER_OFFSET,
              maxHeight: Math.max(100, spaceAbove),
            }
          : {
              left,
              width,
              top: rect.bottom + TRIGGER_OFFSET,
              maxHeight: Math.max(100, spaceBelow),
            }
      );
    };

    updatePosition();

    // The drawer's own container scrolls (not the window), and `position: fixed`
    // coordinates go stale as soon as that happens — `capture: true` catches scroll
    // events from any ancestor scroll container, not just `window`.
    document.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      document.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  // Reset search + highlight on every open, and focus the search input. This is the
  // fix for the bug this component was rewritten to solve, made explicit: no portal
  // fighting the Dialog for focus, so a plain ref focus works.
  useEffect(() => {
    if (!open) return;
    setSearch("");
    setHighlightedIndex(0);
    inputRef.current?.focus();
  }, [open]);

  // Close on outside pointerdown. Listening for `pointerdown` (not `click`) and only
  // attaching this while `open` is what keeps the click that *opens* the dropdown from
  // being immediately treated as an "outside" click: by the time this listener is
  // attached (after the open state commits), that pointerdown has already happened.
  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
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
        if (opt) {
          onValueChange(opt.value);
          setOpen(false);
        }
        break;
      }
      case "Escape":
        e.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
        break;
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
        disabled={disabled}
        className={cn(
          "h-9 w-full justify-between rounded-xl border-black/10 bg-white/70 font-normal",
          !value && "text-muted-foreground",
          className
        )}
        data-testid={dataTestId}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
      >
        <span className="truncate">{resolvedLabel || placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>

      {open && position && (
        <div
          ref={dropdownRef}
          id={listboxId}
          role="listbox"
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
                  aria-selected={value === opt.value}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onClick={() => {
                    onValueChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none",
                    index === highlightedIndex && "bg-accent text-accent-foreground"
                  )}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt.value ? "opacity-100" : "opacity-0"
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
                data-testid="button-searchable-add-new"
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
