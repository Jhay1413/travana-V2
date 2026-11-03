import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SEGMENTED, SEGMENT_ITEM } from "@/components/ui/segmented";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useFreeQuoteStatusCounts, useFreeQuotesInfinite } from "@/features/quote/api/use-quote-queries";
import type { EnrichedQuote } from "@/features/quote/types";
import { addDays, monthOf, monthTitle, shiftMonth, weekRangeTitle, weekStart } from "../../lib/calendar-grid";
import { shouldAutoFetchNext } from "./auto-fetch";
import { CalendarGrid } from "./calendar-grid";
import { visibleRange, type CalendarMode } from "./calendar-range";
import { UnscheduledTray } from "./unscheduled-tray";
import { todayYmd, useCalendarDrop } from "./use-calendar-drop";

export interface SocialCalendarProps {
  search?: string;
  onOpenPost: (quote: EnrichedQuote) => void;
  onScheduleDraft: (quote: EnrichedQuote, dateYmd: string) => void;
  onChangeTime: (quote: EnrichedQuote) => void;
}

function dedupe(quotes: readonly EnrichedQuote[]): EnrichedQuote[] {
  return [...new Map(quotes.map((q) => [q.id, q])).values()];
}

export function SocialCalendar({ search = "", onOpenPost, onScheduleDraft, onChangeTime }: SocialCalendarProps) {
  const [mode, setMode] = useState<CalendarMode>("month");
  const [month, setMonth] = useState(() => monthOf(todayYmd()));
  const [weekStartIso, setWeekStartIso] = useState(() => weekStart(todayYmd()));

  const range = useMemo(() => visibleRange(mode, month, weekStartIso), [mode, month, weekStartIso]);

  const scheduledQuery = useFreeQuotesInfinite(200, true, "none", search, range.startUtc, range.endUtc);
  const draftsQuery = useFreeQuotesInfinite(
    100, false, "none", search, "", "", false, false, "all", [], undefined, "draft",
  );

  const { data: counts } = useFreeQuoteStatusCounts("", []);

  const { hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage } = scheduledQuery;
  const scheduledPages = scheduledQuery.data?.pages.length ?? 0;
  useEffect(() => {
    if (shouldAutoFetchNext({ hasNextPage, isFetchingNextPage, isFetchNextPageError, pagesLoaded: scheduledPages })) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetchNextPageError, scheduledPages, fetchNextPage]);

  const draftsNext = draftsQuery.fetchNextPage;
  const draftsPages = draftsQuery.data?.pages.length ?? 0;
  useEffect(() => {
    if (
      shouldAutoFetchNext({
        hasNextPage: draftsQuery.hasNextPage,
        isFetchingNextPage: draftsQuery.isFetchingNextPage,
        isFetchNextPageError: draftsQuery.isFetchNextPageError,
        pagesLoaded: draftsPages,
      })
    ) {
      void draftsNext();
    }
  }, [draftsQuery.hasNextPage, draftsQuery.isFetchingNextPage, draftsQuery.isFetchNextPageError, draftsPages, draftsNext]);

  const retryScheduled = () => {
    if (scheduledQuery.isFetchNextPageError) void scheduledQuery.fetchNextPage();
    else void scheduledQuery.refetch();
  };
  const retryDrafts = () => {
    if (draftsQuery.isFetchNextPageError) void draftsQuery.fetchNextPage();
    else void draftsQuery.refetch();
  };

  const scheduled = useMemo(
    () => dedupe(scheduledQuery.data?.pages.flatMap((p) => p.quotes) ?? []),
    [scheduledQuery.data],
  );
  const drafts = useMemo(() => dedupe(draftsQuery.data?.pages.flatMap((p) => p.quotes) ?? []), [draftsQuery.data]);
  const scheduledMap = useMemo(() => new Map(scheduled.map((q) => [q.id, q])), [scheduled]);
  const draftMap = useMemo(() => new Map(drafts.map((q) => [q.id, q])), [drafts]);

  const { drop, isDroppable } = useCalendarDrop({ scheduled: scheduledMap, drafts: draftMap, onScheduleDraft });

  const step = (dir: 1 | -1) => {
    if (mode === "month") setMonth((m) => shiftMonth(m, dir));
    else setWeekStartIso((w) => addDays(w, 7 * dir));
  };
  const goToday = () => {
    setMonth(monthOf(todayYmd()));
    setWeekStartIso(weekStart(todayYmd()));
  };
  const showWeek = (ymd: string) => {
    setWeekStartIso(weekStart(ymd));
    setMode("week");
  };

  const title = mode === "month" ? monthTitle(month) : weekRangeTitle(weekStartIso);
  const loading = !scheduledQuery.isError && (scheduledQuery.isLoading || hasNextPage);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-[10px] border-social-border bg-card" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-[10px] border-social-border bg-card" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <h2 aria-live="polite" className="mx-1 text-[20px] font-semibold text-social-navy">
          {title}
        </h2>
        <Button variant="outline" onClick={goToday} className="h-10 rounded-[10px] border-social-border bg-card px-[18px] text-[14px] font-semibold">
          Today
        </Button>
        <div className="mx-1 hidden h-5 w-px bg-social-border md:block" />
        <ul className="ml-auto hidden items-center gap-4 text-[12px] font-medium text-social-muted md:flex">
          <li className="flex items-center gap-1 text-status-scheduled-fg">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Scheduled
          </li>
          <li className="flex items-center gap-1 text-status-posted-fg">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> Posted
          </li>
          <li className="flex items-center gap-1 text-status-draft-fg">
            <span className="h-2 w-2 rounded-full bg-current" aria-hidden="true" /> Drafts
          </li>
        </ul>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={(v) => v && setMode(v as CalendarMode)}
          className={SEGMENTED}
        >
          <ToggleGroupItem value="month" className={SEGMENT_ITEM}>Month</ToggleGroupItem>
          <ToggleGroupItem value="week" className={SEGMENT_ITEM}>Week</ToggleGroupItem>
        </ToggleGroup>
      </div>

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-social-border bg-card">
          {scheduledQuery.isError ? (
            <div role="alert" className="flex flex-col items-center gap-3 py-12 text-center">
              <p className="text-sm font-medium text-red-600">Could not load scheduled posts.</p>
              <Button variant="outline" size="sm" onClick={retryScheduled}>
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : (
            <>
              <CalendarGrid
                mode={mode}
                month={month}
                weekStartIso={weekStartIso}
                quotes={scheduled}
                isDroppable={isDroppable}
                onDropOnDay={(ymd, id) => void drop(ymd, id)}
                onOpenPost={onOpenPost}
                onShowWeek={showWeek}
              />
              {scheduled.length === 0 && (
                <p className="py-6 text-center text-sm text-social-muted">
                  No posts {mode === "month" ? "this month" : "this week"}
                </p>
              )}
            </>
          )}
        </div>
        <UnscheduledTray
          drafts={drafts}
          isLoading={draftsQuery.isLoading}
          isError={draftsQuery.isError}
          onRetry={retryDrafts}
          totalCount={counts?.draft}
          onOpenPost={onOpenPost}
          onChangeTime={onChangeTime}
        />
      </div>
    </div>
  );
}
