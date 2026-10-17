import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { usePipelineColumn } from "@/hooks/queries";
import type { Transaction } from "@/features/quote/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDealPin } from "@/hooks/use-deal-pin";
import {
  LIVE_TABS,
  VIEW_OPTIONS,
  loadView,
  resolveTabTarget,
  saveView,
  type LiveTab,
  type LiveView,
} from "../lib/live-panel";
import { EmptyLine, UnderlineTabs } from "./home/home-ui";
import { LiveRow } from "./live/live-row";

const SHOWN = 8;

export function PipelineLivePanel({
  userId = "",
  className,
  title = "Pipeline Live!",
  scope = "mine",
  branchId,
}: {
  /** Whose deals to show when scope is "mine"; ignored for scope "all". */
  userId?: string;
  className?: string;
  title?: string;
  /** "mine" limits the feed to userId's deals; "all" shows the whole organisation's pipeline. */
  scope?: "mine" | "all";
  /** Narrow the feed to one branch's deals. Omit for no branch filter. */
  branchId?: string;
}) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<LiveTab>("quotes");
  const [view, setView] = useState<LiveView>(loadView);
  const enabled = scope === "all" || !!userId;
  const agentId = scope === "all" ? undefined : userId;

  // "In Play" is a filter (only meaningful within the Quotes tab, whose data
  // already blends the "quote" and "in_play" pipeline stages); "oldest"/
  // "oldest-activity" are a real sort, threaded through to the server so the
  // top-8 slice is drawn from the correctly-ordered rows rather than re-sorting
  // an already newest-first page (see transaction.repository.ts findPipelineByStatus
  // / findPipelineCandidates and transaction.service.ts listPipelineByOldestActivity).
  // The default view passes `sort: undefined` (not "newest") so its query key
  // matches the no-sort-param call other pipeline consumers (e.g.
  // pipeline-section.tsx) already make, instead of caching a duplicate copy.
  const sort: "oldest" | "oldest-activity" | undefined =
    view === "oldest" ? "oldest" : view === "oldest-activity" ? "oldest-activity" : undefined;
  const showInPlayOnly = view === "in_play";
  const byOldestActivity = view === "oldest-activity";

  // enquiryQ has always fired regardless of the active tab (a prefetch so
  // switching to Enquiry feels instant) — kept for the cheap newest/oldest
  // sorts, but the "oldest activity" candidate fetch is expensive (a capped
  // full-column enrichment, see listPipelineByOldestActivity), so it's only
  // enabled for the tab that's actually showing it. "In Play" never shows
  // enquiry/booking-tab data (see `items` below), so those queries — and the
  // Quotes tab's plain `quote` query, unused while showing In Play only —
  // don't fire at all in that view.
  const enquiryEnabled = enabled && !showInPlayOnly && (tab === "enquiry" || !byOldestActivity);
  const quoteEnabled = enabled && tab === "quotes" && !showInPlayOnly;
  const inPlayEnabled = enabled && tab === "quotes";
  const bookingEnabled = enabled && tab === "bookings" && !showInPlayOnly;

  const enquiryQ = usePipelineColumn("enquiry", 10, agentId, undefined, { enabled: enquiryEnabled }, sort, branchId);
  const quoteQ = usePipelineColumn("quote", 10, agentId, undefined, { enabled: quoteEnabled }, sort, branchId);
  const inPlayQ = usePipelineColumn("in_play", 10, agentId, undefined, { enabled: inPlayEnabled }, sort, branchId);
  const bookingQ = usePipelineColumn("booking", 10, agentId, undefined, { enabled: bookingEnabled }, sort, branchId);

  const handleViewChange = (next: LiveView) => {
    setView(next);
    saveView(next);
  };

  const items = useMemo(() => {
    const flat = (q: typeof enquiryQ) => q.data?.pages.flatMap((p) => p.items) ?? [];
    // In-play deals only ever surface inside the Quotes tab's data — the
    // Enquiry/Bookings tabs have nothing to show for this filter, so they
    // fall through to the panel's existing empty state.
    const list =
      tab === "enquiry"
        ? showInPlayOnly ? [] : flat(enquiryQ)
        : tab === "quotes"
          ? showInPlayOnly ? flat(inPlayQ) : [...flat(quoteQ), ...flat(inPlayQ)]
          : showInPlayOnly ? [] : flat(bookingQ);
    // "Oldest Activity" merges two already last_activity_at-sorted pages (Quotes
    // tab's quote + in_play queries) the same way "newest"/"oldest" merge two
    // already created_at-sorted pages — no/stale activity first, nulls first.
    if (byOldestActivity) {
      return [...list]
        .sort((a, b) => {
          const at = a.last_activity_at ? new Date(a.last_activity_at).getTime() : null;
          const bt = b.last_activity_at ? new Date(b.last_activity_at).getTime() : null;
          if (at === null && bt === null) return 0;
          if (at === null) return -1;
          if (bt === null) return 1;
          return at - bt;
        })
        .slice(0, SHOWN);
    }
    return [...list]
      .sort((a, b) => {
        const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return view === "oldest" ? -diff : diff;
      })
      .slice(0, SHOWN);
  }, [tab, view, byOldestActivity, showInPlayOnly, enquiryQ.data, quoteQ.data, inPlayQ.data, bookingQ.data]);

  // Pinned cards lead; the existing order holds within the pinned and unpinned blocks.
  // Applied after the top-8 slice, so it only reorders what is already shown.
  const { pinnedKeys, togglePin } = useDealPin();
  const isPinnedDeal = (t: Transaction) => {
    const target = resolveTabTarget(t, tab);
    return target !== null && pinnedKeys.has(`${target.type}:${target.id}`);
  };
  const orderedItems = [...items.filter(isPinnedDeal), ...items.filter((t) => !isPinnedDeal(t))];

  const isLoading =
    tab === "enquiry"
      ? showInPlayOnly ? false : enquiryQ.isLoading
      : tab === "quotes"
        ? showInPlayOnly ? inPlayQ.isLoading : quoteQ.isLoading || inPlayQ.isLoading
        : showInPlayOnly ? false : bookingQ.isLoading;

  return (
    <div className={className} data-testid="panel-pipeline-live">
      <div className="flex items-center justify-between gap-2 px-5">
        <h2 className="text-[15px] font-semibold xl:text-base">{title}</h2>
        <Select value={view} onValueChange={(v) => handleViewChange(v as LiveView)}>
          <SelectTrigger
            className="h-7 w-[84px] rounded-lg border-social-border bg-card px-2 text-[12px] text-social-muted shadow-none"
            data-testid="select-pipeline-live-view"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {VIEW_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs" data-testid={`option-pipeline-live-view-${o.value}`}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3.5 px-5">
        <UnderlineTabs
          tabs={LIVE_TABS}
          value={tab}
          onChange={setTab}
          label="Pipeline Live stages"
          testIdPrefix="pipeline-live-tab"
        />
        {isLoading ? (
          <EmptyLine>Loading…</EmptyLine>
        ) : showInPlayOnly && tab !== "quotes" ? (
          <EmptyLine>In Play applies to quotes only</EmptyLine>
        ) : items.length === 0 ? (
          <EmptyLine>No {tab === "enquiry" ? "enquiries" : tab} yet</EmptyLine>
        ) : (
          orderedItems.map((t) => (
            <LiveRow
              key={t.id}
              deal={t}
              tab={tab}
              pinned={isPinnedDeal(t)}
              onOpen={navigate}
              onTogglePin={(type, id, label, subtitle) => togglePin(type, id, { label, subtitle })}
            />
          ))
        )}
      </div>
    </div>
  );
}
