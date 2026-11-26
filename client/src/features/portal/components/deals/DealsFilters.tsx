import { cn } from "@/lib/utils";

const CHIP =
  "inline-flex min-h-11 max-w-full items-center border px-4 text-[12px] font-medium uppercase tracking-[0.14em] transition-colors [overflow-wrap:anywhere]";

export function filterChipClass(pressed: boolean): string {
  return cn(CHIP, pressed ? "border-primary bg-primary text-primary-foreground" : "border-input bg-transparent text-primary hover:bg-secondary");
}

interface FiltersProps {
  popularTags: string[];
  countries: string[];
  selectedTag: string | undefined;
  selectedCountry: string | undefined;
  /** Show the "Matching your interests" toggle (the customer has interests and no tag is chosen). */
  showInterestsToggle: boolean;
  matchInterests: boolean;
  canClear: boolean;
  onToggleInterests: () => void;
  onTag: (tag: string) => void;
  onCountry: (country: string | undefined) => void;
  onClear: () => void;
}

/** Latest deals: the interests toggle, tag chips and a country select. For you has no filters (it is already their own tags). */
export function DealsFilters(props: FiltersProps) {
  const { popularTags, countries, selectedTag, selectedCountry, showInterestsToggle, matchInterests, canClear } = props;
  if (!showInterestsToggle && popularTags.length === 0 && countries.length === 0) return null;
  return (
    <div className="flex flex-col gap-6 border-b border-border pb-6" data-testid="deals-filters">
      {showInterestsToggle && (
        <button
          type="button"
          aria-pressed={matchInterests}
          onClick={props.onToggleInterests}
          className={cn(filterChipClass(matchInterests), "self-start")}
          data-testid="chip-matching-interests"
        >
          {matchInterests ? "Matching your interests" : "Match my interests"}
        </button>
      )}

      {popularTags.length > 0 && (
        <div data-testid="section-popular-tags">
          <p className="portal-caps-label mb-2.5">Most popular</p>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <button
                key={tag}
                type="button"
                aria-pressed={selectedTag === tag}
                onClick={() => props.onTag(tag)}
                className={filterChipClass(selectedTag === tag)}
                data-testid={`button-tag-filter-${tag}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {countries.length > 0 && (
        <div className="flex flex-col gap-1.5" data-testid="section-country-filter">
          <label htmlFor="deals-country" className="portal-caps-label">
            Country
          </label>
          <select
            id="deals-country"
            value={selectedCountry ?? ""}
            onChange={(e) => props.onCountry(e.target.value || undefined)}
            className="portal-serif min-h-12 w-full rounded-none border-0 border-b border-input bg-transparent px-0 text-[22px] text-foreground focus-visible:border-accent focus-visible:outline-none"
            data-testid="select-country-filter"
          >
            <option value="">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      )}

      {canClear && (
        <button
          type="button"
          onClick={props.onClear}
          className="min-h-11 self-start text-[11px] font-medium uppercase tracking-[0.2em] text-primary underline underline-offset-4 hover:portal-text-amber-ink"
          data-testid="button-clear-filters"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
