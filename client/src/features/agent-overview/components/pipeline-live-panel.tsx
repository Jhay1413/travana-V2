import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { User } from "lucide-react";
import { usePipelineColumn } from "@/hooks/queries";
import type { Transaction } from "@/features/quote/types";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SortBy } from "@/features/opportunities";
import { currency } from "./helpers";
import { SegmentedTabs } from "./dashboard-ui";

type LiveTab = "enquiry" | "quotes" | "bookings";

const TABS: Array<{ value: LiveTab; label: string }> = [
  { value: "enquiry", label: "Enquiry" },
  { value: "quotes", label: "Quotes" },
  { value: "bookings", label: "Bookings" },
];

// How the panel's list is ordered/filtered. "newest"/"oldest" reuse the same
// sort VALUES (and semantics) as the Opportunities list's sortByOptions, with
// shorter labels to fit this panel's compact header — "price-high"/"price-low"
// are excluded because this panel only ever shows a small top-N slice per
// stage, so a true price sort isn't available without fetching (and pricing)
// the entire pipeline. "oldest-activity" sorts by last_activity_at (deals
// with no/stale activity first) — computed server-side from notes/tasks/
// quote/enquiry/booking timestamps, not the same as "oldest" (by created_at).
// "In Play" reuses the existing pipeline stage concept (see
// PipelineColumnStatus / PipelineStage "In Play") as a filter, applicable
// only within the Quotes tab.
// `Extract<SortBy, ...>` ties "newest"/"oldest" to the shared sortByOptions
// values at compile time (source of truth); the panel uses its own, shorter
// display labels below rather than sortByOptions' full "Newest First"/"Oldest First".
type LiveView = Extract<SortBy, "newest" | "oldest"> | "oldest-activity" | "in_play";

const VIEW_OPTIONS: Array<{ value: LiveView; label: string }> = [
  { value: "newest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "oldest-activity", label: "Activity" },
  { value: "in_play", label: "In Play" },
];

const VIEW_STORAGE_KEY = "pipeline-live.view";

function loadView(): LiveView {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === "oldest" || raw === "oldest-activity" || raw === "in_play" ? raw : "newest";
  } catch {
    return "newest";
  }
}

function saveView(view: LiveView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage may be unavailable (private mode, quota) — the choice just won't persist.
  }
}

const CHIP_PALETTE = [
  "bg-red-500",
  "bg-sky-500",
  "bg-orange-500",
  "bg-emerald-600",
  "bg-indigo-500",
];

function OperatorChip({ name }: { name: string | null }) {
  const label = (name || "•")[0]?.toUpperCase() || "•";
  const hash = [...(name || "x")].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-sm font-bold text-white",
        CHIP_PALETTE[hash % CHIP_PALETTE.length],
      )}
      title={name || undefined}
      aria-hidden
    >
      {label}
    </span>
  );
}

// The tour operator's uploaded logo as a rounded square, falling back to the
// initial chip when there's no logo or the image fails to load.
function OperatorMark({ name, logoUrl }: { name: string | null; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!logoUrl || failed) return <OperatorChip name={name} />;
  return (
    <img
      src={logoUrl}
      alt={name || "Tour operator"}
      title={name || undefined}
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-[6px] border border-black/5 bg-white object-contain"
    />
  );
}

function formatTravelDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quotes don't carry a return date — derive it from travel_date + num_of_nights.
// "NCL - 31/10/2026 → 03/11/2026"; parts degrade gracefully when missing.
function travelLineFor(q: { departing_airport_code?: string | null; travel_date?: string | null; num_of_nights?: number | null } | undefined): string | null {
  if (!q) return null;
  const depart = formatTravelDate(q.travel_date);
  let ret: string | null = null;
  if (q.travel_date && q.num_of_nights) {
    const d = new Date(q.travel_date);
    if (!isNaN(d.getTime())) {
      d.setDate(d.getDate() + q.num_of_nights);
      ret = formatTravelDate(d.toISOString());
    }
  }
  const range = [depart, ret].filter(Boolean).join(" → ");
  const line = [q.departing_airport_code || null, range || null].filter(Boolean).join(" - ");
  return line || null;
}

function dealValue(t: Transaction): number {
  if (t.quotes?.length) {
    return t.quotes.reduce(
      (s, q) =>
        s +
        (parseFloat(q.sales_price || "0") || 0) -
        (parseFloat(q.discounts || "0") || 0) +
        (parseFloat(q.service_charge || "0") || 0),
      0,
    );
  }
  if (t.booking) {
    return (
      (parseFloat(t.booking.sales_price || "0") || 0) -
      (parseFloat(t.booking.discounts || "0") || 0) +
      (parseFloat(t.booking.service_charge || "0") || 0)
    );
  }
  return parseFloat((t.enquiry as any)?.budget || "0") || 0;
}


// Client-linked deals open in the client dashboard's new detail view (via the
// ?holiday= deep link); only client-less deals fall back to the standalone pages.
function dealHref(t: Transaction, tab: LiveTab): string {
  if (tab === "enquiry" && t.enquiry) {
    return t.client_id ? `/clients/${t.client_id}?holiday=enquiry:${t.enquiry.id}` : `/enquiries/${t.enquiry.id}`;
  }
  if (tab === "bookings" && t.booking) {
    return t.client_id ? `/clients/${t.client_id}?holiday=booking:${t.booking.id}` : `/bookings/${t.booking.id}`;
  }
  const q = t.quotes?.find((x) => !x.isQuoteCopy) || t.quotes?.[0];
  if (q) return t.client_id ? `/clients/${t.client_id}?holiday=quote:${q.id}` : `/quotes/${q.id}`;
  return "/pipeline";
}

export function PipelineLivePanel({ userId, className }: { userId: string; className?: string }) {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<LiveTab>("quotes");
  const [view, setView] = useState<LiveView>(loadView);
  const enabled = !!userId;

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

  const enquiryQ = usePipelineColumn("enquiry", 10, userId, undefined, { enabled: enquiryEnabled }, sort);
  const quoteQ = usePipelineColumn("quote", 10, userId, undefined, { enabled: quoteEnabled }, sort);
  const inPlayQ = usePipelineColumn("in_play", 10, userId, undefined, { enabled: inPlayEnabled }, sort);
  const bookingQ = usePipelineColumn("booking", 10, userId, undefined, { enabled: bookingEnabled }, sort);

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
        .slice(0, 8);
    }
    return [...list]
      .sort((a, b) => {
        const diff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return view === "oldest" ? -diff : diff;
      })
      .slice(0, 8);
  }, [tab, view, byOldestActivity, showInPlayOnly, enquiryQ.data, quoteQ.data, inPlayQ.data, bookingQ.data]);

  const isLoading =
    tab === "enquiry"
      ? showInPlayOnly ? false : enquiryQ.isLoading
      : tab === "quotes"
        ? showInPlayOnly ? inPlayQ.isLoading : quoteQ.isLoading || inPlayQ.isLoading
        : showInPlayOnly ? false : bookingQ.isLoading;

  return (
    <div className={className} data-testid="panel-pipeline-live">
      {/* Horizontal padding lives on the sections, not the panel, so the
          separator under the title spans the full panel width. */}
      <div className="flex items-center justify-between gap-2 px-5">
        <div className="text-sm font-semibold">Pipeline Live!</div>
        <Select value={view} onValueChange={(v) => handleViewChange(v as LiveView)}>
          <SelectTrigger
            className="h-7 w-[84px] rounded-[6px] border-black/10 bg-white px-2 text-xs text-[#7c98b0] shadow-none dark:border-white/10 dark:bg-white/5 dark:text-white/55"
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

      <div className="mt-4 border-t border-black/10 px-5 pt-4 dark:border-white/10">
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} testIdPrefix="pipeline-live-tab" fullWidth transparent />
      </div>

      <div className="mt-4 space-y-2 px-4">
        {isLoading ? (
          <div className="py-6 text-center text-xs text-muted-foreground">Loading…</div>
        ) : showInPlayOnly && tab !== "quotes" ? (
          <div className="py-6 text-center text-xs text-muted-foreground">In Play applies to quotes only</div>
        ) : items.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No {tab === "enquiry" ? "enquiries" : tab} yet
          </div>
        ) : (
          items.map((t) => {
            const title =
              t.quotes?.[0]?.title || t.booking?.title || t.enquiry?.title || `#${t.id.slice(0, 8)}`;
            const q0: any = t.quotes?.[0];
            const location =
              q0?.destination_name ||
              (t.booking as any)?.destination_name ||
              (t.enquiry as any)?.destination_name ||
              null;
            const operator =
              q0?.main_tour_operator_name || (t.booking as any)?.main_tour_operator_name || null;
            const operatorLogo =
              q0?.main_tour_operator_logo_url || (t.booking as any)?.main_tour_operator_logo_url || null;
            const value = dealValue(t);
            const travelLine = travelLineFor(q0);
            const clientName = (t as any).client_name || t.client?.name || null;
            const clientPhone = (t as any).client_phone || null;
            const clientLine = [clientName, clientPhone].filter(Boolean).join(" - ");
            return (
              <div
                key={t.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(dealHref(t, tab))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(dealHref(t, tab));
                  }
                }}
                className="cursor-pointer rounded-lg p-3 transition hover:bg-[#e9f8ff] dark:hover:bg-white/[0.05]"
                data-testid={`card-pipeline-live-${t.id}`}
              >
                <div className="flex items-start gap-3">
                  <OperatorMark name={operator} logoUrl={operatorLogo} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-medium">{title}</span>
                      {value > 0 && (
                        <span className="shrink-0 text-sm font-semibold text-black/60 dark:text-white/60">
                          {currency.format(value)}
                        </span>
                      )}
                    </div>
                    {location && (
                      <div className="mt-0.5 truncate text-[13px] text-[#a195a5] dark:text-white/50">
                        {location}
                      </div>
                    )}
                    {travelLine && (
                      <div className="mt-0.5 truncate text-xs text-[#a195a5] dark:text-white/50">
                        {travelLine}
                      </div>
                    )}
                    {clientLine && (
                      <div className="mt-1.5 flex items-center gap-1 truncate text-xs text-black/60 dark:text-white/60">
                        <User className="h-3 w-3 shrink-0 text-amber-500" />
                        <span className="truncate">{clientLine}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
