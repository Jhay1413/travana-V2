import { useEffect, useMemo, useState } from "react";
import { BadgePoundSterling, Building2, CalendarDays, Eye, FileText, Moon, Plane, Tag, Users, View } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useQuote, useBooking } from "@/hooks/queries";
import { currency, transformQuoteData, type QuoteDisplay } from "@/features/quote/components/quote-types";
import { QuoteSummaryTimeline } from "@/features/quote/components/QuoteSummaryTimeline";
import { useBookingUpsells } from "@/features/booking";
import { sumUpsells, type UpsellRecord } from "@/features/booking/types";
import {
  useQuoteViews,
  type QuoteClientViewEntry,
  type QuotePublicViewEntry,
  type QuoteViewStats,
} from "@/features/quote/api/use-quote-share-queries";
import { timeAgo } from "@/features/agent-overview/components/dashboard-ui";
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
        <span className="truncate text-[13px] font-normal 3xl:text-sm">{value}</span>
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
        <h3 className="text-[13px] font-semibold 3xl:text-sm">Travel Summary</h3>
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

// ─── Costings tab ───────────────────────────────────────────────────────────
// Ports the "Costings" tab from QuoteCostingsCard / BookingCostingsCard (the
// standalone quote/booking pages) into a panel-sized layout, with dark-mode
// variants added since the original cards are light-only.

function CostingsHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <div className="mt-1 text-xs text-black/55 dark:text-white/55">Commission and charges.</div>
      </div>
      <FileText className="h-4 w-4 text-black/35 dark:text-white/35" aria-hidden />
    </div>
  );
}

function CostingsRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]",
        emphasis && "bg-black/[0.03] dark:bg-white/[0.06]",
      )}
    >
      <div className="text-xs font-semibold text-black/65 dark:text-white/65">{label}</div>
      <div className="text-xs font-semibold text-black dark:text-white">{value}</div>
    </div>
  );
}

// Shared row list for both quotes and bookings — bookings additionally fold
// active upsells (extras added after booking) into the price/commission
// totals, mirroring BookingCostingsCard.
function CostingsBody({
  title,
  costings,
  upsells,
}: {
  title: string;
  costings: QuoteDisplay;
  upsells?: UpsellRecord[];
}) {
  const hasUpsells = Array.isArray(upsells) && upsells.length > 0;
  const { price: upsellPrice, commission: upsellCommission } = sumUpsells(upsells);
  const totalPrice = costings.commissions.price + upsellPrice;
  const totalCommission = costings.commissions.totalCommission + upsellCommission;

  return (
    <div className="px-4 py-5 3xl:px-6">
      <CostingsHeader title={title} />
      <div className="mt-3 grid gap-2">
        <CostingsRow label="Deal price" value={currency.format(costings.commissions.salesPrice)} />
        {hasUpsells && (
          <CostingsRow
            label="Upsell price"
            value={upsellPrice > 0 ? `+${currency.format(upsellPrice)}` : currency.format(0)}
          />
        )}
        <CostingsRow label="Comm" value={currency.format(costings.commissions.commissionValue)} />
        {hasUpsells && (
          <CostingsRow
            label="Upsell comm"
            value={upsellCommission > 0 ? `+${currency.format(upsellCommission)}` : currency.format(0)}
          />
        )}
        <CostingsRow
          label="Discount"
          value={costings.commissions.discounts > 0 ? `-${currency.format(costings.commissions.discounts)}` : currency.format(0)}
        />
        <CostingsRow
          label="Service charge"
          value={costings.commissions.serviceCharge > 0 ? `+${currency.format(costings.commissions.serviceCharge)}` : currency.format(0)}
        />
        <div className="my-1 h-px w-full bg-black/10 dark:bg-white/10" />
        <CostingsRow label="Total price" value={currency.format(totalPrice)} emphasis />
        <CostingsRow label="Total commission" value={currency.format(totalCommission)} emphasis />
      </div>
    </div>
  );
}

function QuoteCostingsPanel({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuote(id);
  if (isLoading) return <PanelMessage text="Loading…" />;
  if (isError || !data) return <PanelMessage text="Unable to load quote costings." />;
  return <CostingsBody title="Quote Costings" costings={transformQuoteData(data)} />;
}

function BookingCostingsPanel({ id }: { id: string }) {
  const { data, isLoading, isError } = useBooking(id);
  const { data: upsells } = useBookingUpsells(id);
  if (isLoading) return <PanelMessage text="Loading…" />;
  if (isError || !data) return <PanelMessage text="Unable to load booking costings." />;
  return <CostingsBody title="Booking Costings" costings={transformQuoteData(data)} upsells={upsells} />;
}

// Entry point for the Costings tab — dispatches on selection type, same
// pattern as the Summary tab's per-type branching in the main component.
function HolidayCostingsPanel({ selection }: { selection: HolidaySelection | null }) {
  if (!selection) return <PanelMessage text="Select a holiday to see its costings." />;
  if (selection.type === "enquiry") {
    return <PanelMessage text="Costings are available once a quote is created." />;
  }
  if (selection.type === "quote") {
    return <QuoteCostingsPanel key={selection.id} id={selection.id} />;
  }
  return <BookingCostingsPanel key={selection.id} id={selection.id} />;
}

// ─── Views tab ──────────────────────────────────────────────────────────────
// "Quote Engagement" view-tracking summary — only available for quotes (see
// the ViewsPill comment on holiday-detail-view.tsx). Mirrors the visual
// language of the agent dashboard's EngagementSection.

type MergedView =
  | { kind: "client"; id: string; viewerName: string; viewedAt: string; deviceType: string | null; browser: string | null }
  | { kind: "public"; id: string; viewedAt: string; deviceType: string | null; browser: string | null };

function mergeViews(clientViews: QuoteClientViewEntry[], publicViews: QuotePublicViewEntry[]): MergedView[] {
  const merged: MergedView[] = [
    ...clientViews.map((v) => ({ kind: "client" as const, ...v })),
    ...publicViews.map((v) => ({ kind: "public" as const, ...v })),
  ];
  return merged.sort((a, b) => new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime()).slice(0, 10);
}

function ViewsHeader({ stats }: { stats: QuoteViewStats }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-[13px] font-semibold 3xl:text-sm">Quote Engagement</h3>
      <span className="inline-flex items-center gap-2 rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-semibold text-sky-800 dark:bg-sky-500/15 dark:text-sky-300">
        <span className="inline-flex items-center gap-1">
          <View className="h-3.5 w-3.5" />
          {stats.totalViews}
        </span>
        <span className="font-medium text-sky-700/80 dark:text-sky-300/80">{timeAgo(stats.lastViewed)}</span>
      </span>
    </div>
  );
}

function ViewsStatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[6px] border border-black/10 bg-black/[0.03] px-2 py-2 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="text-[11px] text-black/45 dark:text-white/45">{label}</div>
      <div className="text-sm font-semibold">{value}</div>
    </div>
  );
}

function ViewRow({ view }: { view: MergedView }) {
  const deviceLabel = `${timeAgo(view.viewedAt)} · ${view.deviceType ?? "Unknown"}${view.browser ? ` · ${view.browser}` : ""}`;
  return (
    <div className="flex items-center gap-2 rounded-lg px-2 py-2">
      {view.kind === "client" ? (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-violet-100 text-xs font-bold text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {view.viewerName.charAt(0).toUpperCase()}
        </span>
      ) : (
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
          <Eye className="h-3.5 w-3.5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[13px] font-medium",
            view.kind === "public" && "italic text-black/55 dark:text-white/55",
          )}
        >
          {view.kind === "client" ? view.viewerName : "Public link"}
        </div>
        <div className="text-xs text-black/50 dark:text-white/50">{deviceLabel}</div>
      </div>
    </div>
  );
}

function QuoteViewsPanel({ id }: { id: string }) {
  const { data, isLoading, isError } = useQuoteViews(id);
  if (isLoading) return <PanelMessage text="Loading…" />;
  if (isError || !data) return <PanelMessage text="Unable to load views." />;
  if (data.totalViews === 0) return <PanelMessage text="No views yet" />;

  const merged = mergeViews(data.clientViews, data.publicViews);

  return (
    <div className="space-y-4 px-4 py-5 3xl:px-6">
      <ViewsHeader stats={data} />
      <div className="grid grid-cols-3 gap-2">
        <ViewsStatTile label="Total" value={data.totalViews} />
        <ViewsStatTile label="Client" value={data.clientViews.length} />
        <ViewsStatTile label="Public" value={data.publicViewCount} />
      </div>
      <div>
        <h4 className="text-xs font-semibold text-black/55 dark:text-white/55">Recent views</h4>
        <div className="mt-2 space-y-1">
          {merged.map((v) => (
            <ViewRow key={v.id} view={v} />
          ))}
        </div>
      </div>
    </div>
  );
}

// Entry point for the Views tab — view tracking only exists for quotes.
function HolidayViewsPanel({ selection }: { selection: HolidaySelection | null }) {
  if (!selection) return <PanelMessage text="Select a quote to see its views." />;
  if (selection.type !== "quote") {
    return <PanelMessage text="View tracking is only available for quotes." />;
  }
  return <QuoteViewsPanel key={selection.id} id={selection.id} />;
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

  // Reset to Summary whenever the selection changes, so switching holidays
  // while parked on Costings/Views doesn't leave a stale tab showing data
  // for the previous selection — the new selection is visibly reflected.
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
        <h2 className="text-sm font-semibold 3xl:text-base">Details</h2>
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
        {tab === "costings" ? (
          <HolidayCostingsPanel selection={selection} />
        ) : tab === "views" ? (
          <HolidayViewsPanel selection={selection} />
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
