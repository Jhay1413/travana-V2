import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Check, ChevronDown, Ellipsis, FileText, Filter, ListTodo, MessageSquare, Search, SquarePen, Ticket } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { EnquiryTable, Quote } from "@/features/quote/types";
import type { HolidayBooking, HolidaySelection } from "@/features/client/types";

// Quote joins (destination, departing airport, operator name) aren't declared on the
// base `Quote` type, but the transactions API returns them alongside it — same shape
// ContactPanel's LiveQuoteRecord casts around in the conversations inbox.
type QuoteRow = Quote & {
  destination_name?: string | null;
  main_tour_operator_name?: string | null;
  main_tour_operator_logo_url?: string | null;
  departing_airport_name?: string | null;
  departing_airport_code?: string | null;
};

// Bookings get the same operator joins from the transactions API.
type BookingRow = HolidayBooking & {
  main_tour_operator_name?: string | null;
  main_tour_operator_logo_url?: string | null;
};

// ─── Formatting helpers ─────────────────────────────────────────────────────

const holidayCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

// Customer-facing net total = sales_price − discounts + service_charge — same
// formula used for quote/booking rows elsewhere on this page (see
// use-client-quote-groups.ts's NET_PRICE).
function netPrice(sales: string | null | undefined, discounts: string | null | undefined, serviceCharge: string | null | undefined): number {
  return parseFloat(sales || "0") - parseFloat(discounts || "0") + parseFloat(serviceCharge || "0");
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatShortDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Quotes/bookings/enquiries don't carry a return date — derive it from travel_date + nights.
function computeReturnDate(travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  if (!travelDate || !nights) return null;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + nights);
  return formatShortDate(d.toISOString());
}

// "CODE - dd/mm/yyyy → dd/mm/yyyy" — matches the Live Quotes row in the conversations
// inbox ContactPanel exactly; any missing piece is dropped rather than invented.
function buildDateLine(code: string | null, travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  const departureDate = formatShortDate(travelDate);
  const returnDate = computeReturnDate(travelDate, nights);
  const dateRange = [departureDate, returnDate].filter(Boolean).join(" → ");
  const line = [code, dateRange || null].filter(Boolean).join(" - ");
  return line || null;
}

// ─── Active / expired classification ───────────────────────────────────────

const QUOTE_INACTIVE_STATUSES = new Set(["lost", "archived"]);

function isQuoteExpired(q: QuoteRow): boolean {
  const statusInactive = !!q.quote_status && QUOTE_INACTIVE_STATUSES.has(q.quote_status.toLowerCase());
  const dateExpired = !!q.date_expiry && new Date(q.date_expiry).getTime() < startOfToday().getTime();
  return statusInactive || dateExpired;
}

const ENQUIRY_INACTIVE_STATUSES = new Set(["lost", "expired", "inactive", "converted", "closed"]);

function isEnquiryExpired(e: EnquiryTable): boolean {
  const statusInactive = !!e.status && ENQUIRY_INACTIVE_STATUSES.has(e.status.toLowerCase());
  const dateExpired = !!e.date_expiry && new Date(e.date_expiry).getTime() < startOfToday().getTime();
  return statusInactive || dateExpired;
}

function isBookingExpired(b: HolidayBooking): boolean {
  if (!b.travel_date) return false;
  const d = new Date(b.travel_date);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < startOfToday().getTime();
}

// ─── Row model ──────────────────────────────────────────────────────────────

interface HolidayRowData {
  id: string;
  type: HolidaySelection["type"];
  title: string;
  price: number;
  operatorName: string | null;
  operatorLogoUrl: string | null;
  destinationName: string | null;
  dateLine: string | null;
  createdAt: string | null;
  expired: boolean;
}

function buildQuoteRows(quotes: Quote[]): HolidayRowData[] {
  return quotes
    // Copies are internal duplicates of the primary quote, not separate holidays.
    .filter((q) => !q.isQuoteCopy)
    .map((q) => {
      const qr = q as QuoteRow;
      const code = qr.departing_airport_code || qr.departing_airport_name || null;
      return {
        id: qr.id,
        type: "quote" as const,
        title: qr.title || "Untitled quote",
        price: netPrice(qr.sales_price, qr.discounts, qr.service_charge),
        operatorName: qr.main_tour_operator_name ?? null,
        operatorLogoUrl: qr.main_tour_operator_logo_url ?? null,
        destinationName: qr.destination_name ?? null,
        dateLine: buildDateLine(code, qr.travel_date, qr.num_of_nights),
        createdAt: qr.date_created,
        expired: isQuoteExpired(qr),
      };
    });
}

function buildEnquiryRows(enquiries: EnquiryTable[]): HolidayRowData[] {
  return enquiries.map((e) => ({
    id: e.id,
    type: "enquiry" as const,
    title: e.title || "Untitled enquiry",
    price: 0,
    operatorName: null,
    operatorLogoUrl: null,
    destinationName: e.destinations?.[0]?.name ?? null,
    dateLine: buildDateLine(null, e.travel_date, e.no_of_nights),
    createdAt: e.date_created,
    expired: isEnquiryExpired(e),
  }));
}

function buildBookingRows(bookings: HolidayBooking[]): HolidayRowData[] {
  return bookings.map((b) => {
    const br = b as BookingRow;
    return {
      id: b.id,
      type: "booking" as const,
      title: b.title || "Untitled booking",
      price: netPrice(b.sales_price, b.discounts, b.service_charge),
      operatorName: br.main_tour_operator_name ?? null,
      operatorLogoUrl: br.main_tour_operator_logo_url ?? null,
      // Bookings carry no destination join in the transactions payload.
      destinationName: null,
      dateLine: buildDateLine(null, b.travel_date, b.num_of_nights),
      createdAt: b.date_created,
      expired: isBookingExpired(b),
    };
  });
}

function sortRows(rows: HolidayRowData[], order: "newest" | "oldest"): HolidayRowData[] {
  return [...rows].sort((a, b) => {
    const diff = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    return order === "newest" ? diff : -diff;
  });
}

// ─── Chips ──────────────────────────────────────────────────────────────────

const HOLIDAY_CHIP_PALETTE = ["bg-red-500", "bg-sky-500", "bg-orange-500", "bg-emerald-600", "bg-indigo-500"];

// Colored initial chip for the quote's tour operator — same pattern as
// ContactPanel's LiveQuoteOperatorChip in the conversations inbox, replicated
// locally since cross-feature imports aren't allowed.
function OperatorChip({ name }: { name: string }) {
  const label = name[0]?.toUpperCase() || "•";
  const hash = [...name].reduce((s, c) => s + c.charCodeAt(0), 0);
  return (
    <span
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-[6px] text-[13px] font-bold text-white 3xl:h-10 3xl:w-10 3xl:text-sm",
        HOLIDAY_CHIP_PALETTE[hash % HOLIDAY_CHIP_PALETTE.length],
      )}
      title={name}
      aria-hidden
    >
      {label}
    </span>
  );
}

// The tour operator's uploaded logo, rendered as a rounded square. Falls back
// to the initial chip when the image fails to load (dead URL, blocked, …).
function OperatorLogo({ name, logoUrl }: { name: string | null; logoUrl: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return name ? <OperatorChip name={name} /> : <NeutralChip label={name || "•"} />;
  }
  return (
    <img
      src={logoUrl}
      alt={name || "Tour operator"}
      title={name || undefined}
      onError={() => setFailed(true)}
      className="h-9 w-9 shrink-0 rounded-[6px] border border-black/5 bg-white object-contain 3xl:h-10 3xl:w-10"
    />
  );
}

// Neutral chip used when there's no operator to hash against (enquiries, bookings).
function NeutralChip({ label }: { label: string }) {
  const initial = label[0]?.toUpperCase() || "•";
  return (
    <span
      className="grid h-9 w-9 shrink-0 place-items-center rounded-[6px] bg-black/10 text-[13px] font-bold text-black/60 3xl:h-10 3xl:w-10 3xl:text-sm dark:bg-white/10 dark:text-white/60"
      aria-hidden
    >
      {initial}
    </span>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

function HolidayListRow({
  row,
  selected,
  onSelect,
}: {
  row: HolidayRowData;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "relative cursor-pointer rounded-2xl border p-3 transition",
        selected
          ? "border-sky-100 bg-sky-50 dark:border-sky-500/20 dark:bg-sky-500/10"
          : "border-transparent hover:bg-black/[0.02] dark:hover:bg-white/[0.03]",
      )}
      data-testid={`all-holidays-row-${row.id}`}
    >
      <div className="flex items-start gap-3">
        {row.operatorLogoUrl ? (
          <OperatorLogo name={row.operatorName} logoUrl={row.operatorLogoUrl} />
        ) : row.operatorName ? (
          <OperatorChip name={row.operatorName} />
        ) : (
          <NeutralChip label={row.title} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-[13px] font-semibold 3xl:text-sm", row.expired && "text-red-500")}>{row.title}</span>
            {row.price > 0 && (
              <span className="shrink-0 text-[13px] font-semibold text-black/60 3xl:text-sm dark:text-white/60">
                {holidayCurrency.format(row.price)}
              </span>
            )}
          </div>
          {row.destinationName && (
            <div className="mt-0.5 truncate text-xs text-[#a195a5] 3xl:text-[13px] dark:text-white/50">{row.destinationName}</div>
          )}
        </div>
      </div>
      {/* Date line sits on its own row with the "···" dots column under the chip —
          same visual language as the inbox conversation rows. */}
      {row.dateLine && (
        <div className="mt-1.5 flex items-center gap-3">
          <span className="w-9 shrink-0 text-center text-[10px] tracking-[0.2em] text-[#a195a5]/70 3xl:w-10 dark:text-white/30" aria-hidden>
            ···
          </span>
          <span className="truncate text-xs text-[#a195a5] dark:text-white/50">{row.dateLine}</span>
        </div>
      )}
      {!selected && (
        <span className="pointer-events-none absolute bottom-0 left-3 right-3 h-px bg-black/[0.06] dark:bg-white/[0.06]" aria-hidden />
      )}
    </div>
  );
}

// ─── Panel ──────────────────────────────────────────────────────────────────

type HolidayTab = "enquiry" | "quotes" | "bookings";

const HOLIDAY_TABS: Array<{ value: HolidayTab; label: string }> = [
  { value: "enquiry", label: "Enquiry" },
  { value: "quotes", label: "Quotes" },
  { value: "bookings", label: "Bookings" },
];

interface AllHolidaysPanelProps {
  enquiries: EnquiryTable[];
  quotes: Quote[];
  bookings: HolidayBooking[];
  selection: HolidaySelection | null;
  onSelect: (selection: HolidaySelection) => void;
  // The blue "new" button in the header — opens the page's create dialog for
  // the chosen kind (same set the page's ?create= query param supports).
  onCreate?: (kind: "enquiry" | "quote" | "booking" | "task" | "ticket") => void;
  isLoadingTransactions?: boolean;
  className?: string;
}

export function AllHolidaysPanel({
  enquiries,
  quotes,
  bookings,
  selection,
  onSelect,
  onCreate,
  isLoadingTransactions,
  className,
}: AllHolidaysPanelProps) {
  const [tab, setTab] = useState<HolidayTab>("quotes");
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [expiredOpen, setExpiredOpen] = useState(true);
  const [hasUserSelectedTab, setHasUserSelectedTab] = useState(false);
  const autoSelectedRef = useRef(false);

  const enquiryRows = useMemo(() => buildEnquiryRows(enquiries), [enquiries]);
  const quoteRows = useMemo(() => buildQuoteRows(quotes), [quotes]);
  const bookingRows = useMemo(() => buildBookingRows(bookings), [bookings]);

  // Once data has arrived, default to the first of quotes → bookings → enquiry
  // that actually has rows — the enquiry tab is empty for most converted
  // clients (the API only returns an enquiry for status "on_enquiry"). Never
  // override a tab the user picked themselves.
  useEffect(() => {
    if (isLoadingTransactions) return;
    if (hasUserSelectedTab || autoSelectedRef.current) return;
    autoSelectedRef.current = true;
    if (quoteRows.length > 0) setTab("quotes");
    else if (bookingRows.length > 0) setTab("bookings");
    else if (enquiryRows.length > 0) setTab("enquiry");
  }, [isLoadingTransactions, quoteRows.length, bookingRows.length, enquiryRows.length, hasUserSelectedTab]);

  function selectTab(value: HolidayTab) {
    setHasUserSelectedTab(true);
    setTab(value);
  }

  const rows = tab === "enquiry" ? enquiryRows : tab === "quotes" ? quoteRows : bookingRows;

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) => r.title.toLowerCase().includes(q) || (r.destinationName ?? "").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const activeRows = useMemo(
    () => sortRows(filteredRows.filter((r) => !r.expired), sortOrder),
    [filteredRows, sortOrder],
  );
  const expiredRows = useMemo(
    () => sortRows(filteredRows.filter((r) => r.expired), sortOrder),
    [filteredRows, sortOrder],
  );

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden rounded-none border-0 border-r border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]",
        className,
      )}
      data-testid="all-holidays-panel"
    >
      <div className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-black/10 px-4 3xl:px-6 dark:border-white/10">
        <h2 className="text-[15px] font-semibold 3xl:text-[17px]">All Holidays</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setSearchOpen((v) => {
                const next = !v;
                if (!next) setSearch("");
                return next;
              })
            }
            className={cn(
              "grid h-9 w-9 place-items-center rounded-full border transition",
              searchOpen
                ? "border-black/20 bg-black/5 text-black dark:border-white/20 dark:bg-white/10 dark:text-white"
                : "border-black/10 bg-white text-black/70 hover:bg-black/[0.03] dark:border-white/15 dark:bg-transparent dark:text-white/70",
            )}
            title="Search holidays"
            data-testid="all-holidays-search-toggle"
          >
            <Search className="h-4 w-4" />
          </button>
          {onCreate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-full bg-sky-500 text-white transition hover:bg-sky-600"
                  title="Create…"
                  data-testid="all-holidays-new"
                >
                  <SquarePen className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => onCreate("enquiry")} className="gap-2 rounded-lg text-sm" data-testid="all-holidays-new-enquiry">
                  <MessageSquare className="h-4 w-4" /> Create Enquiry
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreate("quote")} className="gap-2 rounded-lg text-sm" data-testid="all-holidays-new-quote">
                  <FileText className="h-4 w-4" /> Create Quote
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreate("booking")} className="gap-2 rounded-lg text-sm" data-testid="all-holidays-new-booking">
                  <CalendarCheck className="h-4 w-4" /> Create Booking
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onCreate("task")} className="gap-2 rounded-lg text-sm" data-testid="all-holidays-new-task">
                  <ListTodo className="h-4 w-4" /> Create Task
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onCreate("ticket")} className="gap-2 rounded-lg text-sm" data-testid="all-holidays-new-ticket">
                  <Ticket className="h-4 w-4" /> Create Ticket
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {searchOpen && (
        <div className="px-4 pb-3 pt-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-black/40 dark:text-white/40" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search holidays…"
              className="h-8 rounded-xl border-black/10 bg-black/[0.03] pl-9 text-xs dark:border-white/10 dark:bg-white/[0.04]"
              data-testid="all-holidays-search"
            />
          </div>
        </div>
      )}

      <div className="px-4 pt-4">
        <div className="flex w-full items-center gap-1 rounded-[6px] border border-black/10 bg-black/[0.02] p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {HOLIDAY_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => selectTab(t.value)}
              className={cn(
                "flex-1 rounded-[4px] px-2 py-1 text-center text-[13px] font-semibold transition 3xl:text-sm",
                tab === t.value
                  ? "border border-black/10 bg-white font-bold text-black shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white"
                  : "text-[#7c98b0] hover:text-black dark:text-white/50 dark:hover:text-white",
              )}
              data-testid={`all-holidays-tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] px-4 py-3 dark:border-white/[0.06]">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1 text-[13px] font-semibold text-[#7c98b0] hover:text-[#5f7d97] 3xl:text-sm dark:text-white/60 dark:hover:text-white"
              data-testid="all-holidays-sort"
            >
              {sortOrder === "newest" ? "Newest" : "Oldest"}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="rounded-xl">
            <DropdownMenuItem
              onClick={() => setSortOrder("newest")}
              className="flex items-center justify-between gap-3 rounded-lg text-sm"
            >
              Newest {sortOrder === "newest" && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setSortOrder("oldest")}
              className="flex items-center justify-between gap-3 rounded-lg text-sm"
            >
              Oldest {sortOrder === "oldest" && <Check className="h-3.5 w-3.5" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {/* Filter and overflow are visual placeholders from the design — no
            behaviour is specced for them yet. */}
        <div className="flex items-center gap-1 text-black/40 dark:text-white/40">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
            title="Filter"
            data-testid="all-holidays-filter"
          >
            <Filter className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
            title="More"
            data-testid="all-holidays-more"
          >
            <Ellipsis className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {isLoadingTransactions ? (
          <p className="py-6 text-center text-xs text-black/45 dark:text-white/45">Loading…</p>
        ) : activeRows.length === 0 && expiredRows.length === 0 ? (
          <p className="py-6 text-center text-xs text-black/45 dark:text-white/45">Nothing to show yet</p>
        ) : (
          <>
            <div className="space-y-1">
              {activeRows.map((row) => (
                <HolidayListRow
                  key={row.id}
                  row={row}
                  selected={selection?.type === row.type && selection.id === row.id}
                  onSelect={() => onSelect({ type: row.type, id: row.id })}
                />
              ))}
            </div>

            {expiredRows.length > 0 && (
              <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setExpiredOpen((v) => !v)}
                  className="flex w-full items-center justify-between px-1 py-3 text-left"
                  data-testid="all-holidays-expired-toggle"
                >
                  <span className="text-[13px] font-bold 3xl:text-sm">Expired</span>
                  <ChevronDown
                    className={cn("h-4 w-4 text-black/50 transition dark:text-white/50", !expiredOpen && "-rotate-90")}
                  />
                </button>
                {expiredOpen && (
                  <div className="mt-1 space-y-1">
                    {expiredRows.map((row) => (
                      <HolidayListRow
                        key={row.id}
                        row={row}
                        selected={selection?.type === row.type && selection.id === row.id}
                        onSelect={() => onSelect({ type: row.type, id: row.id })}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
