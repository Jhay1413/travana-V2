import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { CalendarClock } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useFreeQuoteStatusCounts, useFreeQuotesInfinite } from "@/features/quote/api/use-quote-queries";
import type { EnrichedQuote } from "@/features/quote/types";
import { usePostActions } from "@/features/social/api/use-post-actions";
import { derivePostStatus } from "@/features/social/lib/post-status";
import { SocialPostEditorDialog } from "../editor";
import { CreatePostMenu } from "../create/create-post-menu";
import { SchedulePostDialog } from "../schedule/schedule-post-dialog";
import { useScheduleDialogState } from "../schedule/use-schedule-dialog-state";
import { buildCountsLine, buildGridQueryArgs, DEFAULT_GRID_FILTERS, hasActiveFilters, parseGridFilters, serialiseGridFilters, type GridFilters } from "./grid-filters";
import { GridToolbar } from "./grid-toolbar";
import { SocialPostCard } from "./social-post-card";
import { usePostEditorState } from "./use-post-editor-state";

const MAX_AUTO_FETCHES = 10;

export interface SocialPostsGridProps {
  /**
   * Create flow is controlled by the page: the header's Create button sets `createOpen`
   * to true, and the grid renders the CreatePostMenu (and the editor it leads to).
   */
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  /** Receives "24 posts · 12 scheduled · 4 drafts · 3 posted" for the page header. */
  onCountsChange?: (line: string) => void;
}

export function SocialPostsGrid({ createOpen, onCreateOpenChange, onCountsChange }: SocialPostsGridProps) {
  const [, setLocation] = useLocation();
  // Read once on mount: the URL is the persisted copy, the state below the live one.
  const [initial] = useState<GridFilters>(() => parseGridFilters(window.location.search));
  const [filters, setFilters] = useState<GridFilters>(initial);
  const [searchInput, setSearchInput] = useState(initial.q);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const schedule = useScheduleDialogState();
  const editor = usePostEditorState();
  const actions = usePostActions();
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Debounce the search box into the filters (400ms).
  useEffect(() => {
    const timer = setTimeout(() => setFilters((f) => (f.q === searchInput.trim() ? f : { ...f, q: searchInput.trim() })), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Mirror the filters into the URL (replace, so Back doesn't step through every tweak).
  useEffect(() => {
    const next = serialiseGridFilters(filters);
    if (next === window.location.search.replace(/^[?]/, "")) return;
    setLocation(`${window.location.pathname}${next ? `?${next}` : ""}`, { replace: true });
  }, [filters, setLocation]);

  const update = useCallback((patch: Partial<GridFilters>) => {
    setFilters((f) => ({ ...f, ...patch }));
  }, []);

  // Day bounds are taken when the filters change, so the query key stays stable between renders.
  const queryArgs = useMemo(() => buildGridQueryArgs(filters, tagNames), [filters, tagNames]);
  const { data, isLoading, isError, fetchNextPage, hasNextPage, isFetchingNextPage } = useFreeQuotesInfinite(...queryArgs);
  const { data: counts } = useFreeQuoteStatusCounts(filters.q, tagNames);

  const countsLine = buildCountsLine(counts);
  useEffect(() => onCountsChange?.(countsLine), [countsLine, onCountsChange]);

  // "Featured" is filtered client-side, so it only covers the posts loaded so far.
  const quotes = useMemo<EnrichedQuote[]>(() => {
    const all = data?.pages.flatMap((page) => page.quotes) ?? [];
    return filters.tag === "featured" ? all.filter((q) => !!q.is_featured) : all;
  }, [data, filters.tag]);

  // Featured is filtered client-side, so a page can come back with no matches: keep pulling pages
  // (bounded) until something shows up or the list ends, otherwise the sentinel would never appear.
  const autoFetches = useRef(0);
  useEffect(() => {
    autoFetches.current = 0;
  }, [filters, tagNames]);
  useEffect(() => {
    if (quotes.length > 0 || !hasNextPage || isFetchingNextPage || isLoading) return;
    if (autoFetches.current >= MAX_AUTO_FETCHES) return;
    autoFetches.current += 1;
    void fetchNextPage();
  }, [quotes.length, hasNextPage, isFetchingNextPage, isLoading, fetchNextPage]);

  useEffect(() => {
    const node = loadMoreRef.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0].isIntersecting) fetchNextPage(); }, { threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, quotes.length]);

  const openSchedule = (quote: EnrichedQuote) =>
    schedule.openSchedule(quote, derivePostStatus(quote) === "scheduled" ? "change-time" : "schedule");

  const clearFilters = () => {
    setFilters(DEFAULT_GRID_FILTERS);
    setSearchInput("");
    setTagNames([]);
  };

  return (
    <div className="flex flex-col gap-3.5">
      <GridToolbar
        search={searchInput}
        onSearchChange={setSearchInput}
        status={filters.status}
        onStatusChange={(status) => update({ status })}
        counts={counts}
        when={filters.when}
        onWhenChange={(when) => update({ when })}
        tag={filters.tag}
        onTagChange={(tag) => update({ tag })}
        tagNames={tagNames}
        onTagNamesChange={setTagNames}
      />
      {filters.tag === "featured" && (
        <p className="text-[12px] text-social-muted">Featured deals are filtered from the posts loaded so far. Scroll to load more.</p>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : isError ? (
        <p className="py-16 text-center text-sm font-medium text-red-600">Failed to load posts. Please try refreshing the page.</p>
      ) : quotes.length === 0 && hasNextPage ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : quotes.length === 0 ? (
        <div className="rounded-2xl border border-social-border bg-card p-12 text-center" data-testid="empty-social-posts">
          <CalendarClock className="mx-auto mb-3 h-10 w-10 text-social-muted" />
          {hasActiveFilters(filters, tagNames) ? (
            <>
              <p className="text-sm font-semibold">No posts match these filters</p>
              <button type="button" onClick={clearFilters} className="mt-2 text-sm font-medium text-social-orange-text hover:underline">
                Clear filters
              </button>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold">No social posts yet</p>
              <p className="mt-1 text-xs text-social-muted">Create one from a quote and Luna writes the first draft.</p>
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(290px,1fr))]">
          {quotes.map((quote) => (
            <SocialPostCard
              key={quote.id}
              quote={quote}
              isGenerating={editor.generatingQuoteId === quote.id}
              busy={actions.busyQuoteId === quote.id}
              onEdit={editor.openEditor}
              onGenerate={editor.generate}
              onSchedule={openSchedule}
              onTogglePortal={actions.togglePortal}
              onToggleFeatured={actions.toggleFeatured}
              onMoveToDrafts={actions.moveToDrafts}
              onDelete={actions.deletePost}
            />
          ))}
        </div>
      )}

      {!isError && !isLoading && (hasNextPage || quotes.length > 0) && (
        <div ref={loadMoreRef} className="flex items-center justify-center py-8 text-sm text-social-muted">
          {isFetchingNextPage ? <Spinner className="h-5 w-5" /> : !hasNextPage ? "No more posts to load" : null}
        </div>
      )}

      <SocialPostEditorDialog {...editor.editorProps} />
      {schedule.target && (
        <SchedulePostDialog
          quote={schedule.target.quote}
          deal={schedule.target.deal}
          mode={schedule.target.mode}
          open={schedule.open}
          onOpenChange={schedule.onOpenChange}
        />
      )}
      <CreatePostMenu open={createOpen} onOpenChange={onCreateOpenChange} onGenerate={editor.generate} />
    </div>
  );
}
