import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, MapPinOff, Search, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { GuruDestinationItem } from "@/features/destination-guru/types";

interface DestinationSearchOverlayProps {
  items: GuruDestinationItem[];
  query: string;
  onQueryChange: (query: string) => void;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  className?: string;
}

// Floating light-glass search panel that sits over the globe's top-left
// corner. Collapsed by default (just the search box) so it doesn't cover the
// globe with all ~128 destinations — results show as soon as the user types,
// or "Browse all" is pressed.
export function DestinationSearchOverlay({
  items,
  query,
  onQueryChange,
  selectedKey,
  onSelect,
  className,
}: DestinationSearchOverlayProps) {
  const [browseAll, setBrowseAll] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) => item.destination.toLowerCase().includes(q) || item.country.toLowerCase().includes(q),
    );
  }, [items, query]);

  const unplacedCount = useMemo(() => items.filter((item) => item.lat === null).length, [items]);

  const showList = query.trim().length > 0 || browseAll;

  return (
    <div
      className={cn(
        // Border/opacity/shadow bumped up from a plain bg-white/85: the
        // globe itself is a light filled country-map (cream land, mid-blue
        // ocean) and can fill most/all of the viewport when zoomed in, so
        // this panel needs to read against that light surface too, not just
        // the dark stage margins — matches globe-hover-card.tsx's treatment
        // for the same reason.
        "flex max-h-full w-80 flex-col overflow-hidden rounded-2xl border border-black/15 bg-white/95 shadow-2xl backdrop-blur-sm",
        className,
      )}
      data-testid="panel-guru-search"
    >
      <div className="flex items-center gap-2 px-4 pt-4">
        <Sparkles className="h-5 w-5 text-amber-500" />
        <h1 className="text-base font-bold text-black" data-testid="text-guru-globe-title">
          Destination Guru
        </h1>
      </div>

      <div className="relative px-4 pt-3">
        <Search className="pointer-events-none absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-black/40" />
        <Input
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Search destinations…"
          className="h-10 rounded-2xl border-black/10 bg-white/70 pl-10"
          data-testid="input-guru-globe-search"
        />
      </div>

      {!showList ? (
        <button
          type="button"
          onClick={() => setBrowseAll(true)}
          className="mx-4 my-3 flex items-center justify-center gap-1 rounded-xl border border-black/10 bg-white/60 px-3 py-2 text-xs font-medium text-black/60 hover:bg-white"
          data-testid="button-guru-browse-all"
        >
          Browse all ({items.length})
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      ) : (
        <>
          <div className="flex items-center justify-between px-4 pt-3">
            <span className="text-xs font-medium text-black/40">
              {filtered.length} destination{filtered.length === 1 ? "" : "s"}
            </span>
            {browseAll && !query.trim() && (
              <button
                type="button"
                onClick={() => setBrowseAll(false)}
                className="flex items-center gap-1 text-xs font-medium text-black/40 hover:text-black/60"
                data-testid="button-guru-collapse"
              >
                Collapse
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="mt-1 flex-1 overflow-y-auto px-2 pb-3" data-testid="list-guru-results">
            {filtered.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-black/40">No destinations match</p>
            ) : (
              <ul className="space-y-0.5">
                {filtered.map((item) => (
                  <li key={item.key}>
                    <button
                      type="button"
                      onClick={() => onSelect(item.key)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-sm transition-colors hover:bg-black/5",
                        "outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1",
                        selectedKey === item.key && "bg-amber-500/10",
                      )}
                      data-testid={`button-guru-result-${item.key}`}
                    >
                      <span className="text-lg leading-none">{item.data.heroEmoji}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium text-black/80">{item.destination}</span>
                        <span className="block truncate text-xs text-black/45">{item.country}</span>
                      </span>
                      {item.lat === null && (
                        <Badge
                          variant="outline"
                          className="shrink-0 gap-1 border-black/10 text-[10px] font-normal text-black/40"
                        >
                          <MapPinOff className="h-3 w-3" />
                          No pin yet
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {unplacedCount > 0 && (
        <div
          className="border-t border-black/5 px-4 py-2 text-[11px] text-black/40"
          data-testid="text-guru-unplaced-hint"
        >
          {unplacedCount} destination{unplacedCount === 1 ? "" : "s"} not yet placed on the globe
        </div>
      )}
    </div>
  );
}
