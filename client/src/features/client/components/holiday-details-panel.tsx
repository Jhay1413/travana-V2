import { useEffect, useMemo, useState } from "react";
import { BadgePoundSterling, Building2, CalendarDays, Moon, Plane, Tag, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useQuote, useBooking } from "@/hooks/queries";
import { transformQuoteData } from "@/features/quote/components/quote-types";
import { QuoteSummaryTimeline } from "@/features/quote/components/QuoteSummaryTimeline";
import type { Booking, EnquiryTable, Quote } from "@/features/quote/types";
import type { HolidayBooking, HolidaySelection } from "@/features/client/types";

// Same joined-columns shape the All Holidays list casts quotes to — the transactions
// API returns these alongside the base quote row.
type QuoteRow = Quote & {
  destination_name?: string | null;
  main_tour_operator_name?: string | null;
  departing_airport_name?: string | null;
  departing_airport_code?: string | null;
};

const holidayCurrency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatLongDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// "Sat, 25 Jul 2026 — Wed, 29 Jul 2026" — travel_date through travel_date + nights.
// Falls back to a single date when there's no nights figure to derive a return date from.
function formatDateRange(travelDate: string | null | undefined, nights: number | null | undefined): string | null {
  const start = formatLongDate(travelDate);
  if (!start || !travelDate) return start;
  if (!nights) return start;
  const d = new Date(travelDate);
  if (isNaN(d.getTime())) return start;
  d.setDate(d.getDate() + nights);
  const end = formatLongDate(d.toISOString());
  return end ? `${start} — ${end}` : start;
}

// Customer-facing net total = sales_price − discounts + service_charge — same
// formula used for quote/booking rows elsewhere on this page (see
// use-client-quote-groups.ts's NET_PRICE).
function netPrice(sales: string | null | undefined, discounts: string | null | undefined, serviceCharge: string | null | undefined): number {
  return parseFloat(sales || "0") - parseFloat(discounts || "0") + parseFloat(serviceCharge || "0");
}

function formatPaxLabel(
  adults: number | null | undefined,
  children: number | null | undefined,
  infants: number | null | undefined,
): string | null {
  if (adults == null) return null;
  const parts = [`${adults}A`];
  if (children) parts.push(`${children}C`);
  if (infants) parts.push(`${infants}I`);
  return parts.join(" ");
}

function humanizeStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  return status
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface SummaryModel {
  dateRangeText: string | null;
  destinationName: string | null;
  airportLabel: string | null;
  operatorName: string | null;
  paxLabel: string | null;
  nights: number | null;
  price: number;
  statusLabel: string | null;
  createdLabel: string | null;
}

function buildSummaryModel(selection: HolidaySelection, item: EnquiryTable | QuoteRow | HolidayBooking): SummaryModel {
  if (selection.type === "quote") {
    const q = item as QuoteRow;
    return {
      dateRangeText: formatDateRange(q.travel_date, q.num_of_nights),
      destinationName: q.destination_name ?? null,
      airportLabel: q.departing_airport_code || q.departing_airport_name || null,
      operatorName: q.main_tour_operator_name ?? null,
      paxLabel: formatPaxLabel(q.adult, q.child, q.infant),
      nights: q.num_of_nights ?? null,
      price: netPrice(q.sales_price, q.discounts, q.service_charge),
      statusLabel: humanizeStatus(q.quote_status),
      createdLabel: formatLongDate(q.date_created),
    };
  }
  if (selection.type === "enquiry") {
    const e = item as EnquiryTable;
    return {
      dateRangeText: formatDateRange(e.travel_date, e.no_of_nights),
      destinationName: e.destinations?.[0]?.name ?? null,
      airportLabel: null,
      operatorName: null,
      paxLabel: formatPaxLabel(e.adults, e.children, e.infants),
      nights: e.no_of_nights ?? null,
      price: 0,
      statusLabel: humanizeStatus(e.status),
      createdLabel: formatLongDate(e.date_created),
    };
  }
  const b = item as Booking;
  return {
    dateRangeText: formatDateRange(b.travel_date, b.num_of_nights),
    // Bookings carry no destination/operator joins in the transactions payload.
    destinationName: null,
    airportLabel: null,
    operatorName: null,
    paxLabel: formatPaxLabel(b.adult, b.child, b.infant),
    nights: b.num_of_nights ?? null,
    price: netPrice(b.sales_price, b.discounts, b.service_charge),
    statusLabel: humanizeStatus(b.booking_status),
    createdLabel: formatLongDate(b.date_created),
  };
}

// One labelled value: grey label, red icon, bold value — same visual pattern as
// ClientField in the conversations inbox ContactPanel, replicated locally.
function SummaryField({ label, icon: Icon, value }: { label: string; icon: typeof Plane; value: string }) {
  return (
    <div>
      <div className="text-xs text-black/45 dark:text-white/45">{label}</div>
      <div className="mt-1 flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-[#ff0000]" strokeWidth={1.25} />
        <span className="truncate text-[13px] font-bold 3xl:text-sm">{value}</span>
      </div>
    </div>
  );
}

function HolidaySummary({
  selection,
  item,
}: {
  selection: HolidaySelection;
  item: EnquiryTable | QuoteRow | HolidayBooking;
}) {
  const model = buildSummaryModel(selection, item);
  return (
    <div className="space-y-5 px-4 py-5 3xl:px-6">
      <div>
        <h3 className="text-[13px] font-bold 3xl:text-sm">Travel Summary</h3>
        {model.dateRangeText && <p className="mt-1 text-[13px] text-black/70 dark:text-white/70">{model.dateRangeText}</p>}
        {model.destinationName && (
          <p className="mt-0.5 text-[13px] text-black/50 dark:text-white/50">{model.destinationName}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-5">
        {model.airportLabel && <SummaryField label="Departure Airport" icon={Plane} value={model.airportLabel} />}
        {model.operatorName && <SummaryField label="Tour Operator" icon={Building2} value={model.operatorName} />}
        {model.paxLabel && <SummaryField label="Passengers" icon={Users} value={model.paxLabel} />}
        {model.nights != null && <SummaryField label="Nights" icon={Moon} value={String(model.nights)} />}
        {model.price > 0 && (
          <SummaryField label="Price" icon={BadgePoundSterling} value={holidayCurrency.format(model.price)} />
        )}
        {model.statusLabel && <SummaryField label="Status" icon={Tag} value={model.statusLabel} />}
        {model.createdLabel && <SummaryField label="Created" icon={CalendarDays} value={model.createdLabel} />}
      </div>
    </div>
  );
}

// Muted, centered placeholder — same visual pattern as the panel's existing
// "Coming soon" / "Select a holiday…" empty states.
function PanelMessage({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <p className="text-center text-sm text-black/45 dark:text-white/45">{text}</p>
    </div>
  );
}

// Real quote summary timeline (Outbound Flight / Transfer / Hotel Check-In /
// Inbound Flight / Flight Extras) — same component the quote details page
// renders, fed by the same detail hook + transform used there.
function QuoteTimelinePanel({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuote(id);
  if (isLoading) return <PanelMessage text="Loading…" />;
  if (isError || !data) return <PanelMessage text="Unable to load quote details." />;
  return (
    <div className="px-4 py-5 3xl:px-6">
      <QuoteSummaryTimeline quote={transformQuoteData(data)} variant="panel" />
    </div>
  );
}

// Bookings share the exact same timeline component + rendering pattern as
// quotes — see BookingCostingsCard on the booking details page.
function BookingTimelinePanel({ id }: { id: string }) {
  const { data, isLoading, isError } = useBooking(id);
  if (isLoading) return <PanelMessage text="Loading…" />;
  if (isError || !data) return <PanelMessage text="Unable to load booking details." />;
  return (
    <div className="px-4 py-5 3xl:px-6">
      <QuoteSummaryTimeline quote={transformQuoteData(data)} variant="panel" />
    </div>
  );
}

type DetailsTab = "summary" | "costings" | "views";

const DETAILS_TABS: Array<{ value: DetailsTab; label: string }> = [
  { value: "summary", label: "Summary" },
  { value: "costings", label: "Costings" },
  { value: "views", label: "Views" },
];

interface HolidayDetailsPanelProps {
  selection: HolidaySelection | null;
  enquiries: EnquiryTable[];
  quotes: Quote[];
  bookings: HolidayBooking[];
  className?: string;
}

export function HolidayDetailsPanel({ selection, enquiries, quotes, bookings, className }: HolidayDetailsPanelProps) {
  const [tab, setTab] = useState<DetailsTab>("summary");

  // Selecting a different holiday while parked on Costings/Views would
  // otherwise look dead (those tabs are still "Coming soon" placeholders) —
  // jump back to Summary so the new selection is visibly reflected.
  useEffect(() => {
    setTab("summary");
  }, [selection?.type, selection?.id]);

  const selected = useMemo(() => {
    if (!selection) return null;
    if (selection.type === "quote") return quotes.find((q) => q.id === selection.id) ?? null;
    if (selection.type === "enquiry") return enquiries.find((e) => e.id === selection.id) ?? null;
    return bookings.find((b) => b.id === selection.id) ?? null;
  }, [selection, enquiries, quotes, bookings]);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden rounded-none border-0 border-l border-black/10 bg-white p-0 shadow-none dark:border-white/10 dark:bg-white/[0.04]",
        className,
      )}
      data-testid="holiday-details-panel"
    >
      <div className="flex h-[76px] shrink-0 items-center border-b border-black/10 px-4 3xl:px-6 dark:border-white/10">
        <h2 className="text-[15px] font-semibold 3xl:text-[17px]">Details</h2>
      </div>

      <div className="px-4 pt-4 3xl:px-6">
        <div className="flex w-full items-center gap-1 rounded-[6px] border border-black/10 bg-black/[0.03] p-1 dark:border-white/10 dark:bg-white/[0.04]">
          {DETAILS_TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "flex-1 rounded-[4px] px-2 py-1 text-center text-[13px] font-semibold transition 3xl:text-sm",
                tab === t.value
                  ? "border border-black/10 bg-white font-bold text-black shadow-sm dark:border-white/15 dark:bg-white/15 dark:text-white"
                  : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white",
              )}
              data-testid={`holiday-details-tab-${t.value}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="scrollbar-none min-h-0 flex-1 overflow-y-auto">
        {tab !== "summary" ? (
          <PanelMessage text="Coming soon" />
        ) : !selection || !selected ? (
          <PanelMessage text="Select a holiday to see its details." />
        ) : selection.type === "quote" ? (
          <QuoteTimelinePanel key={selection.id} id={selection.id} />
        ) : selection.type === "booking" ? (
          <BookingTimelinePanel key={selection.id} id={selection.id} />
        ) : (
          <HolidaySummary selection={selection} item={selected} />
        )}
      </div>
    </Card>
  );
}
