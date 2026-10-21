import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { StatusPill } from "@/components/shared/status-pill";
import { useDealPin } from "@/hooks/use-deal-pin";
import { cn } from "@/lib/utils";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import { useClientQuoteViews } from "@/features/quote/api/use-quote-share-queries";
import { useLiveNow } from "@/features/quote/components/hooks";
import type { HolidayBooking, HolidaySelection } from "@/features/client/types";
import {
  buildBookingRows,
  buildEnquiryRows,
  buildQuoteRows,
  filterDealRows,
  groupDealRows,
  sortDealRows,
  type HolidayRowData,
} from "@/features/client/lib/live-deal-rows";
import { defaultRailTab, quoteRailMeta, railCounts, railPills, type RailTab } from "@/features/client/lib/holiday-rail";
import { HolidayLink } from "@/features/client/components/holiday/holiday-link";
import { RailCreateMenu, type RailCreateKind } from "@/features/client/components/holiday/rail-create-menu";
import { HOLIDAY_CARD } from "@/features/client/components/holiday/holiday-styles";

/**
 * Left rail "All holidays": Enquiry | Quotes | Bookings tabs with counts, a search box,
 * HolidayLink rows, and collapsible Expired / Lost groups on the Quotes tab.
 *
 * Props:
 * - enquiries / quotes / bookings: the client's transactions, exactly as pages/client passes them to AllHolidaysPanel.
 * - selection: the open deal; the matching tab is shown and its row highlighted.
 * - onSelect: called with the picked { type, id }. The page pushes ?holiday=<type>:<id> to the URL.
 * - onCreate: when given, shows the round blue "+" menu (omit for read-only roles).
 * - isLoading: shows "Loading..." while transactions load.
 * - clientId: used to load the client's quote view counts.
 * - className: extra classes for the outer card (sticky positioning is left to the page).
 */
export interface HolidaysRailProps {
  enquiries: EnquiryTable[];
  quotes: Quote[];
  bookings: HolidayBooking[];
  selection: HolidaySelection | null;
  onSelect: (selection: HolidaySelection) => void;
  onCreate?: (kind: RailCreateKind) => void;
  isLoading?: boolean;
  clientId: string;
  className?: string;
}

function isSelected(row: HolidayRowData, selection: HolidaySelection | null): boolean {
  return selection?.type === row.type && selection.id === row.id;
}

/** True when the selected holiday is one of these rows or one of their copies. */
function containsSelection(rows: HolidayRowData[], selection: HolidaySelection | null): boolean {
  return rows.some((row) => isSelected(row, selection) || row.copies.some((copy) => isSelected(copy, selection)));
}

function GroupDetails({ label, rows, selection, children }: { label: string; rows: HolidayRowData[]; selection: HolidaySelection | null; children: ReactNode }) {
  if (rows.length === 0) return null;
  return (
    <details open={containsSelection(rows, selection)} className="group mt-2 border-t border-social-border">
      <summary className="flex cursor-pointer list-none items-center justify-between px-1 py-3.5 font-semibold [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          {label} <StatusPill tone="plain" className="px-2 py-0 text-[11px]">{rows.length}</StatusPill>
        </span>
        <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden />
      </summary>
      {children}
    </details>
  );
}

export function HolidaysRail({ enquiries, quotes, bookings, selection, onSelect, onCreate, isLoading, clientId, className }: HolidaysRailProps) {
  const [tab, setTab] = useState<RailTab>(() => defaultRailTab(selection));
  const [search, setSearch] = useState("");
  const userPickedTab = useRef(false);
  const { pinnedKeys } = useDealPin();
  const { data: views } = useClientQuoteViews(clientId);
  const now = useLiveNow();

  const enquiryRows = useMemo(() => buildEnquiryRows(enquiries), [enquiries]);
  const bookedTransactionIds = useMemo(() => new Set(bookings.map((b) => b.transaction_id)), [bookings]);
  const quoteRows = useMemo(() => buildQuoteRows(quotes, bookedTransactionIds), [quotes, bookedTransactionIds]);
  const bookingRows = useMemo(() => buildBookingRows(bookings), [bookings]);
  const hays = useMemo(() => new Map(bookings.map((b) => [b.id, b.hays_ref])), [bookings]);
  const viewCounts = useMemo(() => new Map((views ?? []).map((v) => [v.quoteId, v.viewCount])), [views]);
  const expiry = useMemo(() => quoteRailMeta(quotes, now), [quotes, now]);

  const counts = useMemo(() => railCounts(enquiryRows, groupDealRows(quoteRows), bookingRows), [enquiryRows, quoteRows, bookingRows]);

  // Reveal the selected deal's own tab (deep link, pipeline click, rail pick).
  useEffect(() => {
    if (selection) setTab(defaultRailTab(selection));
  }, [selection]);

  // With nothing selected, land on the first tab that has rows (until the user picks one).
  useEffect(() => {
    if (isLoading || selection || userPickedTab.current) return;
    if (counts.quotes > 0) setTab("quotes");
    else if (counts.bookings > 0) setTab("bookings");
    else if (counts.enquiry > 0) setTab("enquiry");
  }, [isLoading, selection, counts]);

  const rows = tab === "enquiry" ? enquiryRows : tab === "quotes" ? quoteRows : bookingRows;
  const groups = useMemo(() => groupDealRows(sortDealRows(filterDealRows(rows, search, "any"), "newest", pinnedKeys)), [rows, search, pinnedKeys]);

  function renderRow(row: HolidayRowData, nested = false) {
    const current = isSelected(row, selection);
    const pinned = pinnedKeys.has(`${row.type}:${row.id}`);
    const pills = railPills(row, { pinned, viewCount: viewCounts.get(row.id), expiresInDays: expiry.get(row.id)?.expiresInDays ?? null });
    if (row.type === "enquiry") pills.push({ tone: "info", label: "Enquiry" });
    if (row.type === "booking") pills.push({ tone: "good", label: "Booked" });
    return (
      <li key={row.id}>
        <HolidayLink
          row={row}
          nested={nested}
          pills={pills}
          refText={row.type === "booking" ? hays.get(row.id) : null}
          current={current}
          onSelect={() => {
            if (!current) onSelect({ type: row.type, id: row.id });
          }}
        />
        {row.copies.length > 0 && <ul className="mt-2 flex flex-col gap-2">{row.copies.map((copy) => renderRow(copy, true))}</ul>}
      </li>
    );
  }

  const list = (items: HolidayRowData[]) => (
    <ul className="flex flex-col gap-2 max-[1180px]:flex-row max-[1180px]:overflow-x-auto max-[1180px]:pb-1.5">{items.map((row) => renderRow(row))}</ul>
  );
  const empty = groups.active.length + groups.expired.length + groups.lost.length === 0;

  return (
    <aside className={cn(HOLIDAY_CARD, "flex flex-col gap-3.5", className)} aria-label="All holidays" data-testid="holidays-rail">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold">All holidays</h2>
        {onCreate && <RailCreateMenu onCreate={onCreate} />}
      </div>
      <Segmented
        value={tab}
        onChange={(next) => {
          userPickedTab.current = true;
          setTab(next);
        }}
        label="Holiday type"
        className="w-full gap-0.5 overflow-x-auto"
        itemClassName="min-w-fit flex-1 gap-1 px-2.5 text-[12px] max-[1480px]:px-2 max-[1480px]:text-[11.5px]"
        countVariant="plain"
        items={[
          { value: "enquiry", label: "Enquiry", count: counts.enquiry, testId: "holidays-rail-tab-enquiry" },
          { value: "quotes", label: "Quotes", count: counts.quotes, testId: "holidays-rail-tab-quotes" },
          { value: "bookings", label: "Bookings", count: counts.bookings, testId: "holidays-rail-tab-bookings" },
        ]}
      />
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-qp-muted" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search holidays…"
          aria-label="Search holidays"
          className="h-9 rounded-[10px] pl-9 text-[13px]"
          data-testid="holidays-rail-search"
        />
      </div>
      {isLoading ? (
        <p className="py-6 text-center text-[13px] text-qp-muted">Loading…</p>
      ) : empty ? (
        <p className="py-6 text-center text-[13px] text-qp-muted">Nothing to show yet</p>
      ) : (
        <>
          {groups.active.length > 0 && list(groups.active)}
          <GroupDetails label="Expired" rows={groups.expired} selection={selection}>
            {list(groups.expired)}
          </GroupDetails>
          <GroupDetails label="Lost" rows={groups.lost} selection={selection}>
            {list(groups.lost)}
          </GroupDetails>
        </>
      )}
    </aside>
  );
}
