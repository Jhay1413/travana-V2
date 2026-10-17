import { useEffect, useMemo } from "react";
import { useLocation } from "wouter";
import { Check, ChevronDown, ChevronRight, Ellipsis, ListFilter, MessageSquare, Search, SquarePen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { PinToggleButton } from "@/components/shared/pin-toggle-button";
import { OperatorTile } from "@/features/pipeline";
import { useDealPin } from "@/hooks/use-deal-pin";
import { cn } from "@/lib/utils";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import type { ClientDealKind, HolidayBooking, HolidaySelection } from "@/features/client/types";
import {
  DEAL_SORT_LABELS,
  PRICE_BAND_LABELS,
  buildBookingRows,
  buildEnquiryRows,
  buildQuoteRows,
  filterDealRows,
  groupDealRows,
  sortDealRows,
  type DealSort,
  type HolidayRowData,
  type PriceBand,
} from "@/features/client/lib/live-deal-rows";
import { NewDealMenu } from "./new-deal-menu";
import { RoundButton } from "./round-button";
import type { LiveDealsState, LiveDealsTab } from "./use-live-deals-state";

const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 });

const TYPE_LETTER: Record<HolidayRowData["type"], string> = { enquiry: "E", quote: "Q", booking: "B" };

// ─── Rows ───────────────────────────────────────────────────────────────────

function DealRow({
  row,
  pinned,
  isCopy = false,
  onSelect,
  onTogglePin,
}: {
  row: HolidayRowData;
  pinned: boolean;
  isCopy?: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}) {
  return (
    <div className={cn("relative border-t border-social-border", isCopy && "pl-3")}>
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full gap-3 py-3.5 pr-8 text-left outline-none transition hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-social-orange"
        data-testid={`all-holidays-row-${row.id}`}
      >
        {row.operatorName || row.operatorLogoUrl ? (
          <OperatorTile name={row.operatorName} logoUrl={row.operatorLogoUrl} size={36} />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-muted text-[15px] font-semibold text-social-muted" aria-hidden>
            {TYPE_LETTER[row.type]}
          </span>
        )}
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("flex min-w-0 items-baseline gap-1.5 text-sm font-semibold", row.expired && !row.lost && "text-destructive")}>
              <span className="truncate">{row.title}</span>
              {isCopy && (
                <span className="shrink-0 rounded-full bg-status-posted-bg px-1.5 py-0.5 text-[10px] font-semibold text-status-posted-fg">Copy</span>
              )}
            </span>
            {row.price > 0 && <span className="shrink-0 text-sm font-semibold">{money.format(row.price)}</span>}
          </span>
          {row.destinationName && <span className="block truncate text-xs text-social-muted">{row.destinationName}</span>}
          {row.dateLine && <span className="mt-px block truncate text-xs text-social-muted">{row.dateLine}</span>}
        </span>
      </button>
      <div className="absolute bottom-2.5 right-0">
        <PinToggleButton pinned={pinned} onToggle={onTogglePin} data-testid={`all-holidays-row-pin-${row.id}`} />
      </div>
    </div>
  );
}

function RowGroup({
  rows,
  pinnedKeys,
  onSelect,
  onTogglePin,
}: {
  rows: HolidayRowData[];
  pinnedKeys: ReadonlySet<string>;
  onSelect: (selection: HolidaySelection) => void;
  onTogglePin: (row: HolidayRowData) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.id}>
          <DealRow
            row={row}
            pinned={pinnedKeys.has(`${row.type}:${row.id}`)}
            onSelect={() => onSelect({ type: row.type, id: row.id })}
            onTogglePin={() => onTogglePin(row)}
          />
          {row.copies.map((copy) => (
            <DealRow
              key={copy.id}
              row={copy}
              isCopy
              pinned={pinnedKeys.has(`${copy.type}:${copy.id}`)}
              onSelect={() => onSelect({ type: copy.type, id: copy.id })}
              onTogglePin={() => onTogglePin(copy)}
            />
          ))}
        </div>
      ))}
    </>
  );
}

function Collapsible({ label, count, open, onToggle, testId, children }: { label: string; count: number; open: boolean; onToggle: () => void; testId: string; children: React.ReactNode }) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between border-t border-social-border py-3.5 text-sm font-semibold"
        data-testid={testId}
      >
        <span>
          {label}
          <span className="ml-2 text-xs font-medium text-social-muted">{count}</span>
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-social-muted" /> : <ChevronRight className="h-4 w-4 text-social-muted" />}
      </button>
      {open && children}
    </div>
  );
}

// ─── Rail ───────────────────────────────────────────────────────────────────

interface LiveDealsRailProps {
  enquiries: EnquiryTable[];
  quotes: Quote[];
  bookings: HolidayBooking[];
  /** View state owned by the page so it survives opening a deal. */
  state: LiveDealsState;
  isLoading: boolean;
  readOnly: boolean;
  onSelect: (selection: HolidaySelection) => void;
  onNewDeal: (kind: ClientDealKind) => void;
  className?: string;
}

/** Live deals: 340px beside the page from xl, stacked below it. */
export function LiveDealsRail({ enquiries, quotes, bookings, state, isLoading, readOnly, onSelect, onNewDeal, className }: LiveDealsRailProps) {
  const [, navigate] = useLocation();
  const { tab, setTab, sort, setSort, band, setBand, search, setSearch, searching, setSearching, expiredOpen, setExpiredOpen, lostOpen, setLostOpen, tabSettled } = state;

  const bookedTransactionIds = useMemo(() => new Set(bookings.map((b) => b.transaction_id)), [bookings]);
  const enquiryRows = useMemo(() => buildEnquiryRows(enquiries), [enquiries]);
  const quoteRows = useMemo(() => buildQuoteRows(quotes, bookedTransactionIds), [quotes, bookedTransactionIds]);
  const bookingRows = useMemo(() => buildBookingRows(bookings, { markLostBookings: true }), [bookings]);

  const { pinnedKeys, togglePin } = useDealPin();

  // Once data has arrived, land on the first stage that has deals - unless the
  // user already chose one (kept across detail views by the page-owned state).
  useEffect(() => {
    if (isLoading || tabSettled.current) return;
    if (quoteRows.length > 0) setTab("quotes");
    else if (bookingRows.length > 0) setTab("bookings");
    else if (enquiryRows.length > 0) setTab("enquiry");
    else return;
    // setTab marks the choice as settled.
  }, [isLoading, quoteRows.length, bookingRows.length, enquiryRows.length, tabSettled, setTab]);

  const rows = tab === "enquiry" ? enquiryRows : tab === "quotes" ? quoteRows : bookingRows;
  const groups = useMemo(() => {
    const g = groupDealRows(filterDealRows(rows, search, band));
    return {
      active: sortDealRows(g.active, sort, pinnedKeys),
      expired: sortDealRows(g.expired, sort, pinnedKeys),
      lost: sortDealRows(g.lost, sort, pinnedKeys),
    };
  }, [rows, search, band, sort, pinnedKeys]);

  const handleTogglePin = (row: HolidayRowData) => togglePin(row.type, row.id, { label: row.title, subtitle: row.destinationName ?? "" });
  const emptyLabel = rows.length > 0 ? "No deals match." : `No ${tab === "enquiry" ? "enquiries" : tab} yet.`;

  return (
    <aside
      className={cn("relative flex min-w-0 flex-col border-t border-social-border bg-card xl:w-[340px] xl:shrink-0 xl:overflow-y-auto xl:border-l xl:border-t-0", className)}
      aria-label="Live deals"
      data-testid="all-holidays-panel"
    >
      <div className="flex-1 px-[22px] py-5">
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="text-base font-semibold">Live deals</h2>
          <div className="flex gap-2">
            <RoundButton
              label="Search deals"
              tone="plain"
              size={36}
              active={searching}
              onClick={() => {
                if (searching) setSearch("");
                setSearching(!searching);
              }}
              data-testid="all-holidays-search-toggle"
            >
              <Search className="h-4 w-4" strokeWidth={1.8} />
            </RoundButton>
            {!readOnly && (
              <NewDealMenu
                testIdPrefix="all-holidays-new"
                onCreate={onNewDeal}
                trigger={
                  <RoundButton label="New deal" size={36} data-testid="all-holidays-new">
                    <SquarePen className="h-4 w-4" strokeWidth={1.8} />
                  </RoundButton>
                }
              />
            )}
          </div>
        </div>

        {searching && (
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this client's deals"
            aria-label="Search deals"
            className="mb-3 h-9"
            data-testid="all-holidays-search"
          />
        )}

        <Segmented
          value={tab}
          onChange={setTab}
          label="Deal stage"
          className="w-full"
          itemClassName="flex-1 px-2"
          items={[
            { value: "enquiry", label: "Enquiry", testId: "all-holidays-tab-enquiry" },
            { value: "quotes", label: "Quotes", testId: "all-holidays-tab-quotes" },
            { value: "bookings", label: "Bookings", testId: "all-holidays-tab-bookings" },
          ]}
        />

        <div className="mb-0.5 mt-3 flex items-center justify-between text-[13px] font-semibold text-social-muted">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="flex items-center gap-1 hover:text-foreground" data-testid="all-holidays-sort">
                {DEAL_SORT_LABELS[sort]} <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              {(Object.keys(DEAL_SORT_LABELS) as DealSort[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setSort(s)} className="justify-between">
                  {DEAL_SORT_LABELS[s]} {s === sort && <Check className="h-3.5 w-3.5" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex items-center gap-2.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Filter deals" title="Filter by price" className="inline-flex" data-testid="all-holidays-filter">
                  <ListFilter className={cn("h-4 w-4", band !== "any" && "text-social-orange-text")} strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {(Object.keys(PRICE_BAND_LABELS) as PriceBand[]).map((b) => (
                  <DropdownMenuItem key={b} onClick={() => setBand(b)} className="justify-between">
                    {PRICE_BAND_LABELS[b]} {b === band && <Check className="h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="More deal actions" className="inline-flex" data-testid="all-holidays-more">
                  <Ellipsis className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => navigate("/pipeline")}>Open Pipeline</DropdownMenuItem>
                {!readOnly && <DropdownMenuItem onClick={() => onNewDeal("enquiry")}>New deal</DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {isLoading ? (
          <p className="border-t border-social-border py-5 text-[13px] text-social-muted">Loading…</p>
        ) : groups.active.length === 0 ? (
          <p className="mt-2 border-t border-social-border py-5 text-[13px] text-social-muted">{emptyLabel}</p>
        ) : (
          <div className="mt-2">
            <RowGroup rows={groups.active} pinnedKeys={pinnedKeys} onSelect={onSelect} onTogglePin={handleTogglePin} />
          </div>
        )}

        {!isLoading && (
          <>
            <Collapsible label="Expired" count={groups.expired.length} open={expiredOpen} onToggle={() => setExpiredOpen(!expiredOpen)} testId="all-holidays-expired-toggle">
              {groups.expired.length ? (
                <RowGroup rows={groups.expired} pinnedKeys={pinnedKeys} onSelect={onSelect} onTogglePin={handleTogglePin} />
              ) : (
                <p className="pb-3 text-[13px] text-social-muted">Nothing here.</p>
              )}
            </Collapsible>
            <Collapsible label="Lost" count={groups.lost.length} open={lostOpen} onToggle={() => setLostOpen(!lostOpen)} testId="all-holidays-lost-toggle">
              {groups.lost.length ? (
                <RowGroup rows={groups.lost} pinnedKeys={pinnedKeys} onSelect={onSelect} onTogglePin={handleTogglePin} />
              ) : (
                <p className="pb-3 text-[13px] text-social-muted">Nothing here.</p>
              )}
            </Collapsible>
          </>
        )}
      </div>

      {/* The inbox has no per-client filter, so this opens the inbox itself. */}
      <div className="pointer-events-none sticky bottom-5 mb-5 flex justify-end px-[22px]">
        <RoundButton label="Open chat" size={40} className="pointer-events-auto h-12 w-12 shadow-lg" onClick={() => navigate("/conversations")} data-testid="client-rail-chat">
          <MessageSquare className="h-5 w-5" strokeWidth={1.8} />
        </RoundButton>
      </div>
    </aside>
  );
}
