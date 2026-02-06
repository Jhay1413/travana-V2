import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, MoreHorizontal, Pencil, Plane, RefreshCw, Star, Tag, X, Hotel, Bus, Clock, MapPin, Calendar } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommandCenterShell } from "@/components/command-center-shell";
import { useRole } from "@/hooks/use-role";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuoteFull } from "@/hooks/queries";
import { useUpdateQuote } from "@/hooks/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { quoteImageApi } from "@/api";
import { useToast } from "@/hooks/use-toast";
import type { QuoteFull } from "@/types/quote";

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
  quoteLink: string;
  travelDate: string;
  returnDate: string;
  destination: string;
  country: string;
  resort: string;
  createdAt: string;
  passengersInfants: number;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
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
    outbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
    inbound: { from: string; to: string; carrier: string; flightNo: string; depart: string; arrive: string; departDate: string; departTime: string; arriveDate: string; arriveTime: string };
  };
  owner: {
    name: string;
    role: "Agent" | "Manager" | "Homeworker";
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

function splitIsoDateTime(iso: string): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    const parts = iso.split("T");
    return { date: parts[0] || "", time: (parts[1] || "").slice(0, 5) };
  }
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${min}` };
}

function formatTimelineDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function formatTime24(timeStr: string) {
  if (!timeStr) return "";
  return timeStr.slice(0, 5);
}

function QuoteSummaryTimeline({ quote }: { quote: Quote }) {
  const timelineItems: { type: string; sortKey: string; content: React.ReactNode }[] = [];

  if (quote.flights.outbound.from) {
    const sortKey = quote.flights.outbound.departDate + "T" + (quote.flights.outbound.departTime || "00:00");
    timelineItems.push({
      type: "outbound",
      sortKey,
      content: (
        <div className="flex gap-4" data-testid="timeline-outbound">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
              <Plane className="h-5 w-5" />
            </div>
            <div className="mt-2 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">Outbound Flight</div>
            <div className="mt-1 text-sm font-semibold">{quote.flights.outbound.from} → {quote.flights.outbound.to}</div>
            <div className="mt-2 grid gap-1.5">
              <div className="flex items-center gap-2 text-xs text-black/60">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{formatTimelineDate(quote.flights.outbound.departDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-black/60">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Depart {formatTime24(quote.flights.outbound.departTime)}{quote.flights.outbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.outbound.arriveTime)}` : ""}</span>
              </div>
              {(quote.flights.outbound.carrier || quote.flights.outbound.flightNo) && (
                <div className="flex items-center gap-2 text-xs text-black/60">
                  <Plane className="h-3.5 w-3.5 shrink-0" />
                  <span>{[quote.flights.outbound.carrier, quote.flights.outbound.flightNo].filter(Boolean).join(" ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    });
  }

  if (quote.accommodation.property) {
    const checkIn = quote.checkInDate || quote.travelDate;
    const checkInTime = quote.checkInTime || "14:00";
    const sortKey = checkIn + "T" + checkInTime;
    timelineItems.push({
      type: "hotel",
      sortKey,
      content: (
        <div className="flex gap-4" data-testid="timeline-hotel">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
              <Hotel className="h-5 w-5" />
            </div>
            <div className="mt-2 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">Hotel Check-in</div>
            <div className="mt-1 text-sm font-semibold">{quote.accommodation.property}</div>
            <div className="mt-2 grid gap-1.5">
              <div className="flex items-center gap-2 text-xs text-black/60">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{formatTimelineDate(checkIn)}</span>
                {checkInTime && <span>at {formatTime24(checkInTime)}</span>}
              </div>
              <div className="flex items-center gap-2 text-xs text-black/60">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{[quote.resort, quote.country].filter(Boolean).join(", ") || quote.destination}</span>
              </div>
              {quote.nights > 0 && (
                <div className="flex items-center gap-2 text-xs text-black/60">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>{quote.nights} nights</span>
                </div>
              )}
              <div className="mt-1 flex flex-wrap gap-2">
                {quote.accommodation.roomType && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-black/70">{quote.accommodation.roomType}</span>
                )}
                {quote.accommodation.board && (
                  <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-black/70">{quote.accommodation.board}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  if (quote.transferType) {
    const transferDate = quote.checkInDate || quote.travelDate;
    const sortKey = transferDate + "T" + (quote.flights.outbound.arriveTime || "12:00");
    timelineItems.push({
      type: "transfer",
      sortKey,
      content: (
        <div className="flex gap-4" data-testid="timeline-transfer">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
              <Bus className="h-5 w-5" />
            </div>
            <div className="mt-2 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-6">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">Transfer</div>
            <div className="mt-1 text-sm font-semibold">{quote.transferType}</div>
            <div className="mt-2 grid gap-1.5">
              <div className="flex items-center gap-2 text-xs text-black/60">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span>{quote.flights.outbound.to || "Airport"} → {quote.accommodation.property || quote.destination}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  }

  if (quote.flights.inbound.from) {
    const sortKey = quote.flights.inbound.departDate + "T" + (quote.flights.inbound.departTime || "23:59");
    timelineItems.push({
      type: "inbound",
      sortKey,
      content: (
        <div className="flex gap-4" data-testid="timeline-inbound">
          <div className="flex flex-col items-center">
            <div className="grid h-10 w-10 place-items-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
              <Plane className="h-5 w-5 rotate-180" />
            </div>
          </div>
          <div className="flex-1 pb-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-purple-600">Inbound Flight</div>
            <div className="mt-1 text-sm font-semibold">{quote.flights.inbound.from} → {quote.flights.inbound.to}</div>
            <div className="mt-2 grid gap-1.5">
              <div className="flex items-center gap-2 text-xs text-black/60">
                <Calendar className="h-3.5 w-3.5 shrink-0" />
                <span>{formatTimelineDate(quote.flights.inbound.departDate)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-black/60">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>Depart {formatTime24(quote.flights.inbound.departTime)}{quote.flights.inbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.inbound.arriveTime)}` : ""}</span>
              </div>
              {(quote.flights.inbound.carrier || quote.flights.inbound.flightNo) && (
                <div className="flex items-center gap-2 text-xs text-black/60">
                  <Plane className="h-3.5 w-3.5 shrink-0" />
                  <span>{[quote.flights.inbound.carrier, quote.flights.inbound.flightNo].filter(Boolean).join(" ")}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    });
  }

  timelineItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  return (
    <div data-testid="card-quote-summary-timeline">
      <div className="mb-4">
        <div className="text-sm font-semibold" data-testid="text-timeline-title">Travel Summary</div>
        <div className="mt-1 text-xs text-black/55" data-testid="text-timeline-subtitle">
          {formatTimelineDate(quote.travelDate)} — {formatTimelineDate(quote.returnDate)} · {quote.destination}
        </div>
      </div>

      {timelineItems.length > 0 ? (
        <div data-testid="list-timeline-items">
          {timelineItems.map((item, idx) => (
            <div key={idx}>{item.content}</div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/10 bg-white/60 p-4 text-center text-sm text-black/55" data-testid="empty-timeline">
          No travel details added yet. Edit the quote to add flight and accommodation details.
        </div>
      )}
    </div>
  );
}

function transformQuoteData(apiData: QuoteFull): Quote {
  const outboundFlight = apiData.flights.find(f => f.direction === "outbound");
  const inboundFlight = apiData.flights.find(f => f.direction === "inbound");

  const obDepart = splitIsoDateTime(outboundFlight?.depart || "");
  const obArrive = splitIsoDateTime(outboundFlight?.arrive || "");
  const ibDepart = splitIsoDateTime(inboundFlight?.depart || "");
  const ibArrive = splitIsoDateTime(inboundFlight?.arrive || "");

  return {
    id: apiData.id,
    status: apiData.status as "In Play" | "Won" | "Lost",
    packageType: apiData.packageType,
    quoteTitle: apiData.quoteTitle,
    quoteLink: apiData.quoteLink || "",
    travelDate: apiData.travelDate,
    returnDate: apiData.returnDate,
    destination: apiData.destination,
    country: apiData.country || "",
    resort: apiData.resort || "",
    createdAt: apiData.createdAt,
    passengersInfants: apiData.passengersInfants,
    checkInDate: apiData.checkInDate || "",
    checkInTime: apiData.checkInTime || "",
    nights: apiData.nights || 0,
    transferType: apiData.transferType || "",
    preBookedSeats: apiData.preBookedSeats || "",
    flightMeals: apiData.flightMeals || "",
    passengers: {
      adults: apiData.passengersAdults,
      children: apiData.passengersChildren,
      childAges: apiData.childAges,
    },
    accommodation: {
      property: apiData.accommodation?.property || "",
      board: apiData.accommodation?.board || "",
      roomType: apiData.accommodation?.roomType || "",
      notes: apiData.accommodation?.notes || "",
    },
    flights: {
      outbound: {
        from: outboundFlight?.fromAirport || "",
        to: outboundFlight?.toAirport || "",
        carrier: outboundFlight?.carrier || "",
        flightNo: outboundFlight?.flightNo || "",
        depart: outboundFlight?.depart || "",
        arrive: outboundFlight?.arrive || "",
        departDate: obDepart.date,
        departTime: obDepart.time,
        arriveDate: obArrive.date,
        arriveTime: obArrive.time,
      },
      inbound: {
        from: inboundFlight?.fromAirport || "",
        to: inboundFlight?.toAirport || "",
        carrier: inboundFlight?.carrier || "",
        flightNo: inboundFlight?.flightNo || "",
        depart: inboundFlight?.depart || "",
        arrive: inboundFlight?.arrive || "",
        departDate: ibDepart.date,
        departTime: ibDepart.time,
        arriveDate: ibArrive.date,
        arriveTime: ibArrive.time,
      },
    },
    owner: {
      name: apiData.owner?.name || "Unknown",
      role: (apiData.owner?.role as "Agent" | "Manager" | "Homeworker") || "Agent",
    },
    commissions: {
      tourOperator: apiData.commission?.tourOperator || "",
      price: parseFloat(apiData.commission?.price || "0"),
      commissionPercent: parseFloat(apiData.commission?.commissionPercent || "0"),
      commissionValue: parseFloat(apiData.commission?.commissionValue || "0"),
      agentSplitPercent: parseFloat(apiData.commission?.agentSplitPercent || "0"),
      agentSplitValue: parseFloat(apiData.commission?.agentSplitValue || "0"),
      netToAgency: parseFloat(apiData.commission?.netToAgency || "0"),
    },
    notes: apiData.notes.map(n => n.content),
  };
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

function formatTagLabel(raw: string) {
  return raw.trim().replace(/\s+/g, " ");
}

export default function QuotePage() {
  const [, setLocation] = useLocation();
  const [, params] = useRoute("/clients/:clientId/quotes/:quoteId");

  const { role } = useRole();
  const clientId = params?.clientId ?? "";
  const quoteId = params?.quoteId ?? "";

  const { data: quoteData, isLoading, error } = useQuoteFull(quoteId);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showEllipsisMenu, setShowEllipsisMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const ellipsisRef = useRef<HTMLDivElement>(null);
  const updateQuoteMutation = useUpdateQuote();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ellipsisRef.current && !ellipsisRef.current.contains(e.target as Node)) {
        setShowEllipsisMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const images = useMemo(() => quoteData?.images || [], [quoteData]);
  const primaryImage = useMemo(() => images.find((img) => img.isPrimary) || images[0], [images]);
  const galleryImages = useMemo(() => images.filter((img) => img.id !== primaryImage?.id), [images, primaryImage]);

  const handleSetPrimary = async (imageId: string) => {
    try {
      await quoteImageApi.setPrimary(imageId, quoteId);
      queryClient.invalidateQueries({ queryKey: ["quotes"] });
      toast({ title: "Main image updated" });
    } catch {
      toast({ title: "Failed to update main image", variant: "destructive" });
    }
  };

  const quote = useMemo(() => {
    if (!quoteData) return null;
    return transformQuoteData(quoteData);
  }, [quoteData]);

  if (isLoading) {
    return (
      <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="loading-quote">
          <Spinner className="h-8 w-8" />
        </div>
      </CommandCenterShell>
    );
  }

  if (error || !quote) {
    return (
      <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
        <div className="flex h-[calc(100vh-56px)] items-center justify-center" data-testid="error-quote">
          <div className="text-center">
            <p className="text-sm text-black/70">Failed to load quote</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-4"
              onClick={() => setLocation("/clients")}
            >
              Back to Clients
            </Button>
          </div>
        </div>
      </CommandCenterShell>
    );
  }

  return (
    <CommandCenterShell role={role} title="Quote" theme="light" onRoleChange={() => {}}>
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
                  {quote.quoteTitle} <span className="text-sm font-medium text-black/50">{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                </div>
                <StatusPill status={quote.status} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-black/55" data-testid="text-quote-meta">
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
            <Button size="sm" className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90" data-testid="button-export-quote" onClick={() => {}}>
              <FileText className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="mt-4" data-testid="layout-quote-body">
          <div className="grid gap-3 lg:grid-cols-[1fr_340px]" data-testid="grid-quote-sections">
            <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-itinerary">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]" data-testid="layout-itinerary-hero">
                <div className="grid gap-3" data-testid="col-itinerary-media">
                  <div className="relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03]" data-testid="img-itinerary-hero">
                    {primaryImage ? (
                      <>
                        <img
                          src={primaryImage.url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          data-testid="img-itinerary-hero-photo"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-black/0 to-black/0" aria-hidden />
                        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white" data-testid="badge-main-image">
                          <Star className="h-3 w-3 fill-current" /> Main
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full items-center justify-center text-xs text-black/40" data-testid="placeholder-no-hero">
                        No images
                      </div>
                    )}
                  </div>

                  {galleryImages.length > 0 && (
                    <div className="grid grid-cols-2 gap-2" data-testid="grid-itinerary-gallery">
                      {galleryImages.map((img, idx) => (
                        <button
                          key={img.id}
                          type="button"
                          className="group relative aspect-square overflow-hidden rounded-2xl border border-black/10 bg-black/[0.03] transition hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.35)] active:scale-[0.99]"
                          data-testid={`button-gallery-image-${idx}`}
                          onClick={() => handleSetPrimary(img.id)}
                          title="Click to set as main image"
                        >
                          <img src={img.url} alt="" className="absolute inset-0 h-full w-full object-cover" data-testid={`img-gallery-${idx}`} />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/0 to-black/0 opacity-0 transition group-hover:opacity-100" aria-hidden />
                          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1 text-[10px] font-semibold text-white opacity-0 transition group-hover:opacity-100" data-testid={`label-set-main-${idx}`}>
                            <Star className="h-3 w-3" /> Set as main
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="min-w-0" data-testid="section-itinerary-summary">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between" data-testid="row-itinerary-top">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3" data-testid="row-itinerary-title">
                        <div className="min-w-0" data-testid="col-itinerary-title-left">
                          <div className="truncate text-base font-semibold" data-testid="text-itinerary-quote-title">
                            {quote.quoteTitle}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-xs text-black/60" data-testid="text-itinerary-quote-summary">
                            <span>{(() => {
                              const start = new Date(quote.travelDate);
                              const end = new Date(quote.returnDate);
                              const nights = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
                              return `${nights} nights`;
                            })()}</span>
                            <span className="text-black/25">•</span>
                            <span>{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-flex flex-row-reverse items-center justify-end gap-2 rounded-full border border-black/10 bg-white/70 px-1.5 py-1 text-[11px] font-semibold text-black/70"
                            data-testid="pill-itinerary-owner"
                          >
                            <span
                              className="relative grid h-6 w-6 shrink-0 overflow-hidden rounded-full border border-black/10 bg-white/70 shadow-[0_10px_22px_-18px_rgba(0,0,0,0.35)]"
                              data-testid="avatar-itinerary-owner"
                              aria-hidden
                            >
                              <img
                                src="/attached_assets/Avatar3_1769960371403.png"
                                alt=""
                                className="h-full w-full object-cover"
                                data-testid="img-itinerary-owner-avatar"
                              />
                              <span className="pointer-events-none absolute inset-0 ring-1 ring-white/40" aria-hidden />
                            </span>

                            <span className="flex flex-col items-end leading-tight" data-testid="col-itinerary-owner">
                              <span className="whitespace-nowrap" data-testid="text-itinerary-owner-name">{quote.owner.name}</span>
                              <span className="whitespace-nowrap text-[10px] font-semibold text-black/50" data-testid="text-itinerary-owner-role">{quote.owner.role}</span>
                            </span>
                          </span>

                          <div className="relative" ref={ellipsisRef}>
                            <button
                              type="button"
                              onClick={() => setShowEllipsisMenu((v) => !v)}
                              className="grid h-8 w-8 place-items-center rounded-full border border-black/10 bg-white/70 text-black/60 transition hover:bg-black/[0.05]"
                              data-testid="button-quote-ellipsis"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </button>
                            {showEllipsisMenu && (
                              <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-2xl border border-black/10 bg-white/95 p-1 shadow-lg backdrop-blur-xl" data-testid="menu-quote-ellipsis">
                                {[
                                  { label: "Edit Quote", icon: Pencil, id: "edit" },
                                  { label: "Convert Quote", icon: RefreshCw, id: "convert" },
                                  { label: "Duplicate Quote", icon: Copy, id: "duplicate" },
                                ].map((item) => (
                                  <button
                                    key={item.id}
                                    type="button"
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium text-black/75 transition hover:bg-black/[0.05]"
                                    data-testid={`button-quote-${item.id}`}
                                    onClick={() => {
                                      setShowEllipsisMenu(false);
                                      if (item.id === "edit") {
                                        setShowEditModal(true);
                                      } else {
                                        toast({ title: `${item.label} — coming soon` });
                                      }
                                    }}
                                  >
                                    <item.icon className="h-3.5 w-3.5" />
                                    {item.label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2" data-testid="row-itinerary-destination-tags">
                        <span className="text-sm text-black/55" data-testid="text-itinerary-location">{quote.destination}</span>
                        <div className="flex flex-wrap items-center gap-2" data-testid="list-itinerary-tags-inline">
                          {"VIP, Family".split(", ").map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-2 py-0.5 text-[11px] font-semibold text-black/70"
                              data-testid={`pill-itinerary-tag-${t}`}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid gap-1.5 md:grid-cols-2" data-testid="grid-itinerary-specs">
                    <div className="grid gap-1.5" data-testid="col-itinerary-left">
                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-operator">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-operator-label">Tour Operator</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-operator-value">{quote.commissions.tourOperator}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-travel-date">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-travel-date-label">Travel Date</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-travel-date-value">{formatUKDate(quote.travelDate)}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-departure-airport">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-departure-airport-label">Departure Airport</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-departure-airport-value">{quote.flights.outbound.from}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-passengers">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-passengers-label">Passengers</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-passengers-value">
                          {quote.passengers.adults} Adults{quote.passengers.children ? `, ${quote.passengers.children} Children (${[12, 7].join(", ")})` : ""}
                        </div>
                      </div>


                    </div>

                    <div className="grid gap-1.5" data-testid="col-itinerary-right">
                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-hotel">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-hotel-label">Hotel</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-hotel-value">{quote.accommodation.property}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-price-pp">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-price-pp-label">Price per person</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-price-pp-value">{currency.format(quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1))}pp</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-room">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-room-label">Room Type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-room-value">{quote.accommodation.roomType}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-board">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-board-label">Board Basis</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-board-value">{quote.accommodation.board}</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-transfer">
                        <div className="text-xs font-semibold text-black/60" data-testid="text-itinerary-transfer-label">Transfer type</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-itinerary-transfer-value">Private Transfer</div>
                      </div>

                      <div className="flex min-h-8 items-center justify-between gap-3 rounded-2xl border border-black/10 bg-white/70 px-3 py-1" data-testid="row-itinerary-source">
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
                <Tabs defaultValue="summary" className="w-full">
                  <TabsList className="mb-3 w-full rounded-2xl border border-black/10 bg-white/70 p-1">
                    <TabsTrigger value="summary" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-summary">Quote Summary</TabsTrigger>
                    <TabsTrigger value="costings" className="flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold data-[state=active]:bg-black data-[state=active]:text-white" data-testid="tab-quote-costings">Quote Costings</TabsTrigger>
                  </TabsList>

                  <TabsContent value="summary" className="mt-0">
                    <QuoteSummaryTimeline quote={quote} />
                  </TabsContent>

                  <TabsContent value="costings" className="mt-0">
                    <div className="flex items-center justify-between" data-testid="row-quote-summary-header">
                      <div>
                        <div className="text-sm font-semibold" data-testid="text-quote-summary-title">
                          Financial Summary
                        </div>
                        <div className="mt-1 text-xs text-black/55" data-testid="text-quote-summary-subtitle">
                          Commission and charges.
                        </div>
                      </div>
                      <FileText className="h-4 w-4 text-black/35" aria-hidden />
                    </div>

                    <div className="mt-3 grid gap-2" data-testid="list-quote-summary-lines">
                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-total-price">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-total-price-label">Total Price</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-total-price-value">
                          {currency.format(quote.commissions.price)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-commission">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-commission-label">Commission ({quote.commissions.commissionPercent}%)</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-commission-value">
                          {currency.format(quote.commissions.commissionValue)}
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-white/70 px-3 py-2" data-testid="row-quote-summary-agent-split">
                        <div className="text-xs font-semibold text-black/65" data-testid="text-quote-summary-agent-split-label">Agent Split ({quote.commissions.agentSplitPercent}%)</div>
                        <div className="text-xs font-semibold text-black/85" data-testid="text-quote-summary-agent-split-value">
                          {currency.format(quote.commissions.agentSplitValue)}
                        </div>
                      </div>

                      <div className="my-1 h-px w-full bg-black/10" data-testid="separator-quote-summary" />

                      <div className="flex items-center justify-between rounded-2xl border border-black/10 bg-black/[0.03] px-3 py-2" data-testid="row-quote-summary-total-commission">
                        <div className="text-xs font-semibold text-black/70" data-testid="text-quote-summary-total-commission-label">Net to Agency</div>
                        <div className="text-xs font-semibold text-black" data-testid="text-quote-summary-total-commission-value">
                          {currency.format(quote.commissions.netToAgency)}
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </Card>

              <Card className="glass ringed grain rounded-3xl border-black/10 bg-white/70 p-4" data-testid="card-quote-tags">
                <div className="flex items-center justify-between" data-testid="row-tags-header">
                  <div>
                    <div className="text-sm font-semibold" data-testid="text-tags-title">
                      Tags
                    </div>
                    <div className="mt-1 text-xs text-black/55" data-testid="text-tags-subtitle">
                      Add quick labels to this quote.
                    </div>
                  </div>
                  <Tag className="h-4 w-4 text-black/35" aria-hidden />
                </div>

                <div className="mt-3 flex flex-wrap gap-2" data-testid="list-tags">
                  {["VIP", "Family", "Flexible dates"].map((t) => (
                    <span
                      key={t}
                      className="group inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold text-black/70"
                      data-testid={`pill-tag-${t}`}
                    >
                      {t}
                      <button
                        type="button"
                        className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-black/35 transition hover:bg-black/[0.06] hover:text-black/60"
                        data-testid={`button-remove-tag-${t}`}
                        onClick={() => {}}
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex items-center gap-2" data-testid="row-add-tag">
                  <Input
                    placeholder="Add tag…"
                    className="h-9 rounded-2xl border-black/10 bg-white/70"
                    data-testid="input-add-tag"
                    value={""}
                    onChange={() => {}}
                  />
                  <Button
                    size="sm"
                    className="h-9 rounded-2xl bg-[#3b82f6] px-3 text-white hover:bg-[#3b82f6]/90"
                    data-testid="button-add-tag"
                    onClick={() => {}}
                  >
                    Add
                  </Button>
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
      {quote && (
        <EditQuoteDialog
          open={showEditModal}
          onOpenChange={setShowEditModal}
          quote={quote}
          quoteData={quoteData!}
          onSave={(updates) => {
            updateQuoteMutation.mutate(
              { id: quoteId, data: updates },
              {
                onSuccess: () => {
                  setShowEditModal(false);
                  queryClient.invalidateQueries({ queryKey: ["quotes"] });
                  toast({ title: "Quote updated successfully" });
                },
                onError: () => {
                  toast({ title: "Failed to update quote", variant: "destructive" });
                },
              }
            );
          }}
          isSaving={updateQuoteMutation.isPending}
        />
      )}
    </CommandCenterShell>
  );
}

function EditQuoteDialog({
  open,
  onOpenChange,
  quote,
  quoteData,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  quote: Quote;
  quoteData: QuoteFull;
  onSave: (data: Record<string, any>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(() => buildEditForm(quote, quoteData));

  useEffect(() => {
    if (open) setForm(buildEditForm(quote, quoteData));
  }, [open, quote, quoteData]);

  const set = (key: string, val: any) => setForm((prev: any) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    const travelDateObj = new Date(form.travelDate);
    const returnDateObj = new Date(travelDateObj);
    returnDateObj.setDate(returnDateObj.getDate() + (form.nights || 7));
    const returnDate = returnDateObj.toISOString().split("T")[0];

    const updates: Record<string, any> = {
      packageType: form.packageType,
      quoteTitle: form.quoteTitle,
      quoteLink: form.quoteLink,
      status: form.status,
      destination: form.destination,
      country: form.country,
      resort: form.resort,
      travelDate: form.travelDate,
      returnDate: returnDate,
      passengersAdults: form.passengersAdults,
      passengersChildren: form.passengersChildren,
      passengersInfants: form.passengersInfants,
      childAges: form.childAges,
      checkInDate: form.checkInDate,
      checkInTime: form.checkInTime,
      nights: form.nights,
      transferType: form.transferType,
      preBookedSeats: form.preBookedSeats,
      flightMeals: form.flightMeals,
      accommodation: form.accommodation,
      boardBasis: form.boardBasis,
      roomType: form.roomType,
      outboundDepartAirport: form.outboundDepartAirport,
      outboundDepartDate: form.outboundDepartDate,
      outboundDepartTime: form.outboundDepartTime,
      outboundArriveAirport: form.outboundArriveAirport,
      outboundArriveDate: form.outboundArriveDate,
      outboundArriveTime: form.outboundArriveTime,
      inboundDepartAirport: form.inboundDepartAirport,
      inboundDepartDate: form.inboundDepartDate,
      inboundDepartTime: form.inboundDepartTime,
      inboundArriveAirport: form.inboundArriveAirport,
      inboundArriveDate: form.inboundArriveDate,
      inboundArriveTime: form.inboundArriveTime,
      tourOperator: form.tourOperator,
      sales: form.sales,
      price: form.price,
      commission: form.commission,
      discount: form.discount,
      serviceCharge: form.serviceCharge,
      pricePerPerson: form.pricePerPerson,
    };
    onSave(updates);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto rounded-3xl border-black/10 bg-white/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Edit Quote</DialogTitle>
          <DialogDescription className="text-sm text-black/55">
            Update quote details, accommodation, flights, and pricing.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 grid gap-6">
          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Details</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Package Type</Label>
                <Select value={form.packageType} onValueChange={(v) => set("packageType", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-package-type">
                    <SelectValue placeholder="Select type..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Package (Flight + Hotel)">Package (Flight + Hotel)</SelectItem>
                    <SelectItem value="Flight Only">Flight Only</SelectItem>
                    <SelectItem value="Hotel Only">Hotel Only</SelectItem>
                    <SelectItem value="Cruise">Cruise</SelectItem>
                    <SelectItem value="Tour">Tour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                <Input
                  placeholder="e.g. Maldives — Overwater Villa, 9 nights"
                  value={form.quoteTitle}
                  onChange={(e) => set("quoteTitle", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-quote-title"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Quote Link</Label>
                <Input
                  placeholder="https://..."
                  value={form.quoteLink}
                  onChange={(e) => set("quoteLink", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-quote-link"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">JSON Upload</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const content = ev.target?.result as string || "";
                        const toIsoDate = (d: string | undefined): string => {
                          if (!d) return "";
                          const match = d.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
                          if (match) {
                            const [, day, month, year] = match;
                            return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
                          }
                          return d;
                        };
                        try {
                          const data = JSON.parse(content);
                          setForm((prev: any) => ({
                            ...prev,
                            packageType: data.packageType || data.package_type || prev.packageType,
                            quoteTitle: data.quoteTitle || data.quote_title || data.title || prev.quoteTitle,
                            quoteLink: data.quoteLink || data.quote_link || data.link || prev.quoteLink,
                            travelDate: toIsoDate(data.travelDate || data.travel_date || data.departureDate) || prev.travelDate,
                            passengersAdults: data.passengers?.adults || data.adults || data.passengersAdults || prev.passengersAdults,
                            passengersChildren: data.passengers?.children || data.children || data.passengersChildren || prev.passengersChildren,
                            passengersInfants: data.passengers?.infants || data.infants || data.passengersInfants || prev.passengersInfants,
                            childAges: data.childAges || data.child_ages || data.passengers?.childAges || prev.childAges,
                            country: data.country || prev.country,
                            destination: data.destination || prev.destination,
                            resort: data.resort || prev.resort,
                            accommodation: data.accommodation || data.hotel || data.property || prev.accommodation,
                            checkInDate: toIsoDate(data.checkInDate || data.check_in_date || data.checkin) || prev.checkInDate,
                            checkInTime: data.checkInTime || data.check_in_time || prev.checkInTime,
                            nights: data.nights || data.duration || prev.nights,
                            boardBasis: data.boardBasis || data.board_basis || data.board || prev.boardBasis,
                            roomType: data.roomType || data.room_type || data.room || prev.roomType,
                            transferType: data.transferType || data.transfer_type || data.transfers || prev.transferType,
                            preBookedSeats: data.preBookedSeats || data.pre_booked_seats || data.seats || prev.preBookedSeats,
                            flightMeals: data.flightMeals || data.flight_meals || data.meals || prev.flightMeals,
                            outboundDepartAirport: data.flights?.outbound?.departAirport || data.outbound?.from || data.departureAirport || prev.outboundDepartAirport,
                            outboundDepartDate: toIsoDate(data.flights?.outbound?.departDate || data.outbound?.date) || prev.outboundDepartDate,
                            outboundDepartTime: data.flights?.outbound?.departTime || data.outbound?.time || prev.outboundDepartTime,
                            outboundArriveAirport: data.flights?.outbound?.arriveAirport || data.outbound?.to || data.arrivalAirport || prev.outboundArriveAirport,
                            outboundArriveDate: toIsoDate(data.flights?.outbound?.arriveDate) || prev.outboundArriveDate,
                            outboundArriveTime: data.flights?.outbound?.arriveTime || prev.outboundArriveTime,
                            inboundDepartAirport: data.flights?.inbound?.departAirport || data.inbound?.from || prev.inboundDepartAirport,
                            inboundDepartDate: toIsoDate(data.flights?.inbound?.departDate || data.inbound?.date) || prev.inboundDepartDate,
                            inboundDepartTime: data.flights?.inbound?.departTime || data.inbound?.time || prev.inboundDepartTime,
                            inboundArriveAirport: data.flights?.inbound?.arriveAirport || data.inbound?.to || prev.inboundArriveAirport,
                            inboundArriveDate: toIsoDate(data.flights?.inbound?.arriveDate) || prev.inboundArriveDate,
                            inboundArriveTime: data.flights?.inbound?.arriveTime || prev.inboundArriveTime,
                            tourOperator: data.commissions?.tourOperator || data.tourOperator || data.tour_operator || data.operator || prev.tourOperator,
                            sales: data.commissions?.sales || data.sales || prev.sales,
                            price: data.commissions?.price || data.price || data.total || prev.price,
                            commission: data.commissions?.commission || data.commission || prev.commission,
                            discount: data.commissions?.discount || data.discount || prev.discount,
                            serviceCharge: data.commissions?.serviceCharge || data.serviceCharge || data.service_charge || prev.serviceCharge,
                            pricePerPerson: data.commissions?.pricePerPerson || data.pricePerPerson || data.price_per_person || data.ppp || prev.pricePerPerson,
                          }));
                        } catch {
                        }
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-json-upload"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Play">In Play</SelectItem>
                    <SelectItem value="Won">Won</SelectItem>
                    <SelectItem value="Lost">Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Travel Details</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Travel Date</Label>
                <Input
                  type="date"
                  value={form.travelDate}
                  onChange={(e) => set("travelDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-travel-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Adults</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.passengersAdults}
                  onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 1)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-adults"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Children</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.passengersChildren}
                  onChange={(e) => {
                    const count = parseInt(e.target.value) || 0;
                    set("passengersChildren", count);
                    set("childAges", Array(count).fill(0));
                  }}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-children"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Infants</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.passengersInfants}
                  onChange={(e) => set("passengersInfants", parseInt(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-infants"
                />
              </div>
              {form.passengersChildren > 0 && (
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs font-medium text-black/60">Children's Ages</Label>
                  <div className="flex flex-wrap gap-2">
                    {form.childAges.map((age: number, idx: number) => (
                      <Input
                        key={idx}
                        type="number"
                        min={0}
                        max={17}
                        value={age}
                        onChange={(e) => {
                          const ages = [...form.childAges];
                          ages[idx] = parseInt(e.target.value) || 0;
                          set("childAges", ages);
                        }}
                        className="h-9 w-16 rounded-xl border-black/10 bg-white/70"
                        data-testid={`edit-input-child-age-${idx}`}
                        placeholder={`Child ${idx + 1}`}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Destination & Accommodation</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Country</Label>
                <Input
                  placeholder="e.g. United Kingdom"
                  value={form.country}
                  onChange={(e) => set("country", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-country"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Destination</Label>
                <Input
                  placeholder="e.g. Maldives"
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-destination"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Resort</Label>
                <Input
                  placeholder="e.g. North Malé Atoll"
                  value={form.resort}
                  onChange={(e) => set("resort", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-resort"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Accommodation</Label>
                <Input
                  placeholder="e.g. Azure Overwater Resort"
                  value={form.accommodation}
                  onChange={(e) => set("accommodation", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-accommodation"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Check-in Date</Label>
                <Input
                  type="date"
                  value={form.checkInDate}
                  onChange={(e) => set("checkInDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-checkin-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Check-in Time</Label>
                <Input
                  type="time"
                  value={form.checkInTime}
                  onChange={(e) => set("checkInTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-checkin-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Number of Nights</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.nights}
                  onChange={(e) => set("nights", parseInt(e.target.value) || 1)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-nights"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                <Select value={form.boardBasis} onValueChange={(v) => set("boardBasis", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-board-basis">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Room Only">Room Only</SelectItem>
                    <SelectItem value="Bed & Breakfast">Bed & Breakfast</SelectItem>
                    <SelectItem value="Half Board">Half Board</SelectItem>
                    <SelectItem value="Full Board">Full Board</SelectItem>
                    <SelectItem value="All Inclusive">All Inclusive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Room Type</Label>
                <Input
                  placeholder="e.g. Overwater Villa"
                  value={form.roomType}
                  onChange={(e) => set("roomType", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-room-type"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Transfer Type</Label>
                <Select value={form.transferType} onValueChange={(v) => set("transferType", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-transfer-type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Private Transfer">Private Transfer</SelectItem>
                    <SelectItem value="Shared Transfer">Shared Transfer</SelectItem>
                    <SelectItem value="Seaplane">Seaplane</SelectItem>
                    <SelectItem value="Speedboat">Speedboat</SelectItem>
                    <SelectItem value="Self-drive">Self-drive</SelectItem>
                    <SelectItem value="None">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Pre-booked Seats</Label>
                <Input
                  placeholder="e.g. Extra legroom (row 12)"
                  value={form.preBookedSeats}
                  onChange={(e) => set("preBookedSeats", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-prebooked-seats"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Flight Meals</Label>
                <Input
                  placeholder="e.g. Standard + child meal"
                  value={form.flightMeals}
                  onChange={(e) => set("flightMeals", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-flight-meals"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4" />
              Flights — Outbound
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                <Input
                  placeholder="e.g. LHR"
                  value={form.outboundDepartAirport}
                  onChange={(e) => set("outboundDepartAirport", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-depart-airport"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                <Input
                  type="date"
                  value={form.outboundDepartDate}
                  onChange={(e) => set("outboundDepartDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-depart-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                <Input
                  type="time"
                  value={form.outboundDepartTime}
                  onChange={(e) => set("outboundDepartTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-depart-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                <Input
                  placeholder="e.g. MLE"
                  value={form.outboundArriveAirport}
                  onChange={(e) => set("outboundArriveAirport", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-arrive-airport"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                <Input
                  type="date"
                  value={form.outboundArriveDate}
                  onChange={(e) => set("outboundArriveDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-arrive-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                <Input
                  type="time"
                  value={form.outboundArriveTime}
                  onChange={(e) => set("outboundArriveTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-outbound-arrive-time"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4 rotate-180" />
              Flights — Inbound
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departing Airport</Label>
                <Input
                  placeholder="e.g. MLE"
                  value={form.inboundDepartAirport}
                  onChange={(e) => set("inboundDepartAirport", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-depart-airport"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Date</Label>
                <Input
                  type="date"
                  value={form.inboundDepartDate}
                  onChange={(e) => set("inboundDepartDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-depart-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Departure Time</Label>
                <Input
                  type="time"
                  value={form.inboundDepartTime}
                  onChange={(e) => set("inboundDepartTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-depart-time"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Airport</Label>
                <Input
                  placeholder="e.g. LHR"
                  value={form.inboundArriveAirport}
                  onChange={(e) => set("inboundArriveAirport", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-arrive-airport"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Date</Label>
                <Input
                  type="date"
                  value={form.inboundArriveDate}
                  onChange={(e) => set("inboundArriveDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-arrive-date"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Arrival Time</Label>
                <Input
                  type="time"
                  value={form.inboundArriveTime}
                  onChange={(e) => set("inboundArriveTime", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-inbound-arrive-time"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Package Commissions</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                <Input
                  placeholder="e.g. Luxury Escapes UK"
                  value={form.tourOperator}
                  onChange={(e) => set("tourOperator", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-tour-operator"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Sales (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.sales}
                  onChange={(e) => set("sales", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-sales"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => set("price", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Commission (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.commission}
                  onChange={(e) => set("commission", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-commission"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Discount (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discount}
                  onChange={(e) => set("discount", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-discount"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Service Charge (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.serviceCharge}
                  onChange={(e) => set("serviceCharge", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-service-charge"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Price per Person (£)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.pricePerPerson}
                  onChange={(e) => set("pricePerPerson", parseFloat(e.target.value) || 0)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-price-per-person"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              className="h-9 rounded-2xl border-black/10 px-4"
              onClick={() => onOpenChange(false)}
              data-testid="edit-button-cancel"
            >
              Cancel
            </Button>
            <Button
              className="h-9 rounded-2xl bg-black px-4 text-white hover:bg-black/90"
              onClick={handleSave}
              disabled={isSaving}
              data-testid="edit-button-save"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function buildEditForm(quote: Quote, quoteData: QuoteFull) {
  return {
    packageType: quote.packageType,
    quoteTitle: quote.quoteTitle,
    quoteLink: quote.quoteLink,
    status: quote.status,
    travelDate: quote.travelDate,
    passengersAdults: quote.passengers.adults,
    passengersChildren: quote.passengers.children,
    passengersInfants: quote.passengersInfants,
    childAges: [...quote.passengers.childAges],
    country: quote.country,
    destination: quote.destination,
    resort: quote.resort,
    accommodation: quote.accommodation.property,
    checkInDate: quote.checkInDate,
    checkInTime: quote.checkInTime,
    nights: quote.nights,
    boardBasis: quote.accommodation.board,
    roomType: quote.accommodation.roomType,
    transferType: quote.transferType,
    preBookedSeats: quote.preBookedSeats,
    flightMeals: quote.flightMeals,
    outboundDepartAirport: quote.flights.outbound.from,
    outboundDepartDate: quote.flights.outbound.departDate,
    outboundDepartTime: quote.flights.outbound.departTime,
    outboundArriveAirport: quote.flights.outbound.to,
    outboundArriveDate: quote.flights.outbound.arriveDate,
    outboundArriveTime: quote.flights.outbound.arriveTime,
    inboundDepartAirport: quote.flights.inbound.from,
    inboundDepartDate: quote.flights.inbound.departDate,
    inboundDepartTime: quote.flights.inbound.departTime,
    inboundArriveAirport: quote.flights.inbound.to,
    inboundArriveDate: quote.flights.inbound.arriveDate,
    inboundArriveTime: quote.flights.inbound.arriveTime,
    tourOperator: quote.commissions.tourOperator,
    sales: quote.commissions.agentSplitPercent || 50,
    price: quote.commissions.price,
    commission: quote.commissions.commissionPercent || 0,
    discount: 0,
    serviceCharge: 0,
    pricePerPerson: quote.commissions.price / (quote.passengers.adults + quote.passengers.children || 1),
  };
}
