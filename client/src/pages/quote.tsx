import { useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, Plane, UsersRound } from "lucide-react";
import { CommandCenterShell, type Role } from "@/components/command-center-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

function formatUKDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return input;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

type Quote = {
  id: string;
  status: "In Play" | "Won" | "Lost";
  packageType: string;
  quoteTitle: string;
  travelDate: string;
  returnDate: string;
  destination: string;
  createdAt: string;
  passengers: {
    adults: number;
    children: number;
    childAges: number[];
  };
  accommodation: {
    property: string;
    board: string;
    roomType: string;
    notes: string;
  };
  flights: {
    outbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string };
    inbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string };
  };
  commissions: {
    tourOperator: string;
    price: number;
    commissionPercent: number;
    commissionValue: number;
    agentSplitPercent: number;
    agentSplitValue: number;
    netToAgency: number;
  };
  notes: string[];
};

const seedQuotesById: Record<string, Quote> = {
  "Q-00042": {
    id: "Q-00042",
    status: "In Play",
    packageType: "Luxury Beach",
    quoteTitle: "Maldives — Coco Beach Resort, 7 nights",
    travelDate: "2026-02-14",
    returnDate: "2026-02-21",
    destination: "Maldives",
    createdAt: "2026-02-01",
    passengers: { adults: 2, children: 2, childAges: [6, 10] },
    accommodation: {
      property: "Luxury Coco Beach Resort",
      board: "Half Board",
      roomType: "Overwater Villa (Private Pool)",
      notes: "Early check-in requested · Anniversary amenities",
    },
    flights: {
      outbound: {
        from: "LHR",
        to: "MLE",
        carrier: "BA",
        flightNo: "BA061",
        depart: "2026-02-14T10:15:00",
        arrive: "2026-02-14T22:40:00",
      },
      inbound: {
        from: "MLE",
        to: "LHR",
        carrier: "BA",
        flightNo: "BA060",
        depart: "2026-02-21T00:30:00",
        arrive: "2026-02-21T06:55:00",
      },
    },
    commissions: {
      tourOperator: "Elegant Escapes",
      price: 18950,
      commissionPercent: 12,
      commissionValue: 2274,
      agentSplitPercent: 35,
      agentSplitValue: 795,
      netToAgency: 1479,
    },
    notes: [
      "Client prefers sunset side villa; avoid near pier.",
      "Offer two options: 7 nights + upgrade vs 10 nights standard.",
    ],
  },
  "Q-00037": {
    id: "Q-00037",
    status: "In Play",
    packageType: "Tailor-Made",
    quoteTitle: "Japan — Kyoto + Tokyo, 12 nights",
    travelDate: "2026-03-18",
    returnDate: "2026-03-30",
    destination: "Japan",
    createdAt: "2026-01-29",
    passengers: { adults: 2, children: 0, childAges: [] },
    accommodation: {
      property: "Mixed (Kyoto + Tokyo)",
      board: "B&B",
      roomType: "King room",
      notes: "Include private guide 2 days in Kyoto",
    },
    flights: {
      outbound: {
        from: "LHR",
        to: "HND",
        carrier: "BA",
        flightNo: "BA007",
        depart: "2026-03-18T12:30:00",
        arrive: "2026-03-19T10:15:00",
      },
      inbound: {
        from: "HND",
        to: "LHR",
        carrier: "BA",
        flightNo: "BA006",
        depart: "2026-03-30T13:05:00",
        arrive: "2026-03-30T19:45:00",
      },
    },
    commissions: {
      tourOperator: "Trailfinders",
      price: 12990,
      commissionPercent: 10,
      commissionValue: 1299,
      agentSplitPercent: 35,
      agentSplitValue: 455,
      netToAgency: 844,
    },
    notes: ["Propose two hotel tiers in Tokyo.", "Add rail pass vs flights internal as option."],
  },
  "Q-00036": {
    id: "Q-00036",
    status: "Won",
    packageType: "Luxury Villa",
    quoteTitle: "Bali — Private Pool Villa, 10 nights",
    travelDate: "2026-05-06",
    returnDate: "2026-05-16",
    destination: "Bali",
    createdAt: "2026-01-22",
    passengers: { adults: 2, children: 0, childAges: [] },
    accommodation: {
      property: "Ubud Private Estate",
      board: "Breakfast",
      roomType: "One Bedroom Villa",
      notes: "Private driver included · Late checkout",
    },
    flights: {
      outbound: {
        from: "LGW",
        to: "DPS",
        carrier: "EK",
        flightNo: "EK016",
        depart: "2026-05-06T20:10:00",
        arrive: "2026-05-07T19:20:00",
      },
      inbound: {
        from: "DPS",
        to: "LGW",
        carrier: "EK",
        flightNo: "EK017",
        depart: "2026-05-16T21:55:00",
        arrive: "2026-05-17T06:35:00",
      },
    },
    commissions: {
      tourOperator: "Kuoni",
      price: 10450,
      commissionPercent: 12,
      commissionValue: 1254,
      agentSplitPercent: 35,
      agentSplitValue: 439,
      netToAgency: 815,
    },
    notes: ["Client confirmed deposit paid.", "Upsell: spa package + beach club day."],
  },
};

function getQuoteFor(id: string) {
  return seedQuotesById[id] ?? seedQuotesById["Q-00042"]; // fallback for mockup
}

function StatusPill({ status }: { status: Quote["status"] }) {
  const styles =
    status === "Won"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-900"
      : status === "Lost"
        ? "border-rose-500/20 bg-rose-500/10 text-rose-900"
        : "border-indigo-500/20 bg-indigo-500/10 text-indigo-900";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${styles}`} data-testid={`pill-quote-status-${status}`}>
      {status}
    </span>
  );
}

function KeyValue({ label, value, testid }: { label: string; value: string; testid: string }) {
  return (
    <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid={testid}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45" data-testid={`${testid}-label`}>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-black/85" data-testid={`${testid}-value`}>
        {value}
      </div>
    </div>
  );
}

export default function QuotePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/clients/:clientId/quotes/:quoteId");

  const role = (new URLSearchParams(window.location.search).get("role") as Role) ?? "Agent";
  const clientId = params?.clientId ?? "C-00001";
  const quoteId = params?.quoteId ?? "Q-00042";

  const quote = useMemo(() => getQuoteFor(quoteId), [quoteId]);

  return (
    <CommandCenterShell role={role} title="Quote" subtitle={`Client ${clientId} · Quote ${quote.id}`} theme="light" onRoleChange={() => {}}>
      <div className="px-5 pb-8 pt-5" data-testid="page-quote">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between" data-testid="row-quote-header">
          <div className="flex items-start gap-3">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-back-client"
              onClick={() => setLocation(`/clients/${clientId}`)}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Client
            </Button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold" data-testid="text-quote-title">
                  {quote.quoteTitle}
                </div>
                <StatusPill status={quote.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-quote-meta">
                <span data-testid="text-quote-meta-id">{quote.id}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-destination">{quote.destination}</span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-dates">
                  {formatUKDate(quote.travelDate)} → {formatUKDate(quote.returnDate)}
                </span>
                <span className="text-black/25">•</span>
                <span data-testid="text-quote-meta-created">Created {formatUKDate(quote.createdAt)}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-testid="row-quote-actions">
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-2xl border-black/10 bg-white/70"
              data-testid="button-copy-quote"
              onClick={() => navigator.clipboard.writeText(`${quote.quoteTitle} (${quote.id})`)}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button size="sm" className="h-9 rounded-2xl bg-black px-3 text-white hover:bg-black/90" data-testid="button-export-quote" onClick={() => {}}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3" data-testid="layout-quote-body">

          <div className="grid gap-3 lg:grid-cols-3" data-testid="grid-quote-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4 lg:col-span-2" data-testid="card-quote-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]" data-testid="img-itinerary-hero">
                  <img
                    src="/attached_assets/Luxury-Coco-Beach-Resort.jpg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    data-testid="img-itinerary-hero-photo"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" aria-hidden />
                </div>

                <div className="min-w-0" data-testid="section-itinerary-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-itinerary-top">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2" data-testid="row-itinerary-title">
                        <div className="truncate text-base font-semibold" data-testid="text-itinerary-quote-title">
                          {quote.quoteTitle}
                        </div>
                        <span className="text-sm font-semibold text-black/85" data-testid="text-itinerary-total">
                          {currency.format(quote.commissions.price)}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-black/55" data-testid="text-itinerary-location">
                        {quote.destination}
                      </div>
                    </div>

                    <Badge className="w-fit rounded-full border-black/10 bg-white/70 text-black/70" data-testid="badge-package-type">
                      {quote.packageType}
                    </Badge>
                  </div>

                  <div className="mt-3 grid gap-2 md:grid-cols-2" data-testid="grid-itinerary-specs">
                    <div className="grid gap-2" data-testid="col-itinerary-left">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-operator">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-operator-label">Tour Operator</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-travel-date">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-departure-airport">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-departure-airport-label">Departure Airport</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-departure-airport-value">{quote.flights.outbound.from}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-passengers">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-passengers-label">Passengers</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-passengers-value">
                          {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children` : ""}
                        </div>
                      </div>


                    </div>

                    <div className="grid gap-2" data-testid="col-itinerary-right">
                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-hotel">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-hotel-label">Hotel</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-hotel-value">{quote.accommodation.property}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-room">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-room-label">Room Type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-room-value">{quote.accommodation.roomType}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-board">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-board-label">Board Basis</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-board-value">{quote.accommodation.board}</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-transfer">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-transfer-label">Transfer type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-transfer-value">Private Transfer</div>
                      </div>

                      <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-itinerary-source">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-source-label">Lead Source</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-source-value">Shop</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-quote-notes">
                    <div className="text-sm font-semibold" data-testid="text-notes-title">
                      Notes
                    </div>
                    <div className="mt-2 grid gap-2" data-testid="list-notes">
                      {quote.notes.map((n, idx) => (
                        <div key={idx} className="rounded-2xl border border-black/10 bg-white/60 p-3 text-xs text-black/70" data-testid={`note-quote-${idx}`}>
                          {n}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="grid gap-3" data-testid="col-quote-right">
              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-summary-right">
                <div className="flex items-center justify-between" data-testid="row-quote-summary-header">
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-quote-summary-title">
                      Quote Summary
                    </div>
                    <div className="mt-1 text-xs text-black/55" data-testid="text-quote-summary-subtitle">
                      Commission and charges.
                    </div>
                  </div>
                  <FileText className="h-4 w-4 text-black/35" aria-hidden />
                </div>

                <div className="mt-3 grid gap-2" data-testid="list-quote-summary-lines">
                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-commission">
                    <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-commission-label">Commission</div>
                    <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-commission-value">
                      {currency.format(140.7)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-discount">
                    <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-discount-label">Discount</div>
                    <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-discount-value">
                      {currency.format(0)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-service-charge">
                    <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-service-charge-label">Service Charge</div>
                    <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-service-charge-value">
                      {currency.format(0)}
                    </div>
                  </div>

                  <div className="my-1 h-px w-full bg-black/10" data-testid="separator-quote-summary" />

                  <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-quote-summary-total-commission">
                    <div className="text-xs font-semibold text-black/70" data-testid="text-quote-summary-total-commission-label">Total Commission</div>
                    <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-commission-value">
                      {currency.format(140.7)}
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-passengers">
                <div className="flex items-center justify-between" data-testid="row-passengers-header">
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-passengers-title">
                      Passengers
                    </div>
                    <div className="mt-1 text-xs text-black/55" data-testid="text-passengers-subtitle">
                      Party details.
                    </div>
                  </div>
                  <UsersRound className="h-4 w-4 text-black/35" aria-hidden />
                </div>

                <div className="mt-3 grid gap-2" data-testid="list-passengers">
                  <KeyValue label="Adults" value={String(quote.passengers.adults)} testid="kv-adults" />
                  <KeyValue label="Children" value={String(quote.passengers.children)} testid="kv-children" />
                  <KeyValue label="Child ages" value={quote.passengers.childAges.length ? quote.passengers.childAges.join(", ") : "—"} testid="kv-child-ages" />
                </div>
              </Card>

              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-flights">
                <div className="flex items-center justify-between" data-testid="row-flights-header">
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-flights-title">
                      Flights
                    </div>
                    <div className="mt-1 text-xs text-black/55" data-testid="text-flights-subtitle">
                      Outbound and inbound.
                    </div>
                  </div>
                  <Plane className="h-4 w-4 text-black/35" aria-hidden />
                </div>

                <div className="mt-3 grid gap-2" data-testid="list-flights">
                  <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-flight-outbound">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45" data-testid="text-flight-outbound-label">
                      Outbound
                    </div>
                    <div className="mt-1 text-sm font-semibold" data-testid="text-flight-outbound-route">
                      {quote.flights.outbound.from} → {quote.flights.outbound.to}
                    </div>
                    <div className="mt-1 text-xs text-black/60" data-testid="text-flight-outbound-meta">
                      {quote.flights.outbound.carrier} {quote.flights.outbound.flightNo} · {formatUKDate(quote.flights.outbound.depart)}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-black/10 bg-white/70 p-4" data-testid="card-flight-inbound">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-black/45" data-testid="text-flight-inbound-label">
                      Inbound
                    </div>
                    <div className="mt-1 text-sm font-semibold" data-testid="text-flight-inbound-route">
                      {quote.flights.inbound.from} → {quote.flights.inbound.to}
                    </div>
                    <div className="mt-1 text-xs text-black/60" data-testid="text-flight-inbound-meta">
                      {quote.flights.inbound.carrier} {quote.flights.inbound.flightNo} · {formatUKDate(quote.flights.inbound.depart)}
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </CommandCenterShell>
  );
}
