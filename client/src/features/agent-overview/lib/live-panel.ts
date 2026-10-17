import type { Transaction } from "@/features/quote/types";
import type { SortBy } from "@/features/opportunities";
import { resolveDealTarget, type DealTarget, type DealTargetType } from "@/features/transaction";
import type { PinnableDealType } from "@/hooks/use-deal-pin";
import type { LiveTab } from "./live-value";

export type { LiveTab } from "./live-value";

export const LIVE_TABS: Array<{ value: LiveTab; label: string }> = [
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
// "In Play" reuses the existing pipeline stage concept as a filter, applicable
// only within the Quotes tab.
// `Extract<SortBy, ...>` ties "newest"/"oldest" to the shared sortByOptions
// values at compile time (source of truth).
export type LiveView = Extract<SortBy, "newest" | "oldest"> | "oldest-activity" | "in_play";

export const VIEW_OPTIONS: Array<{ value: LiveView; label: string }> = [
  { value: "newest", label: "Latest" },
  { value: "oldest", label: "Oldest" },
  { value: "oldest-activity", label: "Activity" },
  { value: "in_play", label: "In Play" },
];

const VIEW_STORAGE_KEY = "pipeline-live.view";

export function loadView(): LiveView {
  try {
    const raw = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return raw === "oldest" || raw === "oldest-activity" || raw === "in_play" ? raw : "newest";
  } catch {
    return "newest";
  }
}

export function saveView(view: LiveView) {
  try {
    window.localStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    // Storage may be unavailable (private mode, quota) — the choice just won't persist.
  }
}

function formatTravelDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export interface TravelFields {
  departing_airport_code?: string | null;
  travel_date?: string | null;
  num_of_nights?: number | null;
}

// Quotes don't carry a return date — derive it from travel_date + num_of_nights.
// "NCL - 31/10/2026 → 03/11/2026"; parts degrade gracefully when missing.
export function travelLineFor(q: TravelFields | undefined): string | null {
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

// The single entity a card represents for the active tab. Both the card's link
// and its pin resolve through here (shared with the Pipeline board) so the pin
// always attaches to exactly what the card opens.
const TAB_FOCUS: Record<LiveTab, DealTargetType> = { enquiry: "enquiry", quotes: "quote", bookings: "booking" };

export function resolveTabTarget(t: Transaction, tab: LiveTab): DealTarget | null {
  return resolveDealTarget(t, TAB_FOCUS[tab]);
}

const STANDALONE_DEAL_PATH: Record<PinnableDealType, string> = {
  enquiry: "/enquiries",
  booking: "/bookings",
  quote: "/quotes",
};

// Client-linked deals open in the client dashboard's detail view (via the
// ?holiday= deep link); only client-less deals fall back to the standalone pages.
// Note: lib/deal-links.ts's `dealDeepLinkHref` implements the same mapping for
// entityType/entityId task rows — keep the two in sync if this logic changes.
export function dealHref(t: Transaction, tab: LiveTab): string {
  const target = resolveTabTarget(t, tab);
  if (!target) return "/pipeline";
  return t.client_id
    ? `/clients/${t.client_id}?holiday=${target.type}:${target.id}`
    : `${STANDALONE_DEAL_PATH[target.type]}/${target.id}`;
}
