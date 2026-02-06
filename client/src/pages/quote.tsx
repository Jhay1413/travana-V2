import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";
import { ChevronLeft, Copy, FileText, MoreHorizontal, Pencil, Plane, RefreshCw, Star, Tag, X } from "lucide-react";
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

function transformQuoteData(apiData: QuoteFull): Quote {
  const outboundFlight = apiData.flights.find(f => f.direction === "outbound");
  const inboundFlight = apiData.flights.find(f => f.direction === "inbound");
  
  return {
    id: apiData.id,
    status: apiData.status as "In Play" | "Won" | "Lost",
    packageType: apiData.packageType,
    quoteTitle: apiData.quoteTitle,
    travelDate: apiData.travelDate,
    returnDate: apiData.returnDate,
    destination: apiData.destination,
    createdAt: apiData.createdAt,
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
      },
      inbound: {
        from: inboundFlight?.fromAirport || "",
        to: inboundFlight?.toAirport || "",
        carrier: inboundFlight?.carrier || "",
        flightNo: inboundFlight?.flightNo || "",
        depart: inboundFlight?.depart || "",
        arrive: inboundFlight?.arrive || "",
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

        <div className="mt-4 grid gap-3" data-testid="layout-quote-body">

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
    const updates: Record<string, any> = {};
    if (form.quoteTitle !== quote.quoteTitle) updates.quoteTitle = form.quoteTitle;
    if (form.status !== quote.status) updates.status = form.status;
    if (form.packageType !== quote.packageType) updates.packageType = form.packageType;
    if (form.destination !== quote.destination) updates.destination = form.destination;
    if (form.travelDate !== quote.travelDate) updates.travelDate = form.travelDate;
    if (form.returnDate !== quote.returnDate) updates.returnDate = form.returnDate;
    if (form.passengersAdults !== quote.passengers.adults) updates.passengersAdults = form.passengersAdults;
    if (form.passengersChildren !== quote.passengers.children) updates.passengersChildren = form.passengersChildren;
    if (form.accommodationProperty !== quote.accommodation.property) updates.accommodationProperty = form.accommodationProperty;
    if (form.accommodationBoard !== quote.accommodation.board) updates.accommodationBoard = form.accommodationBoard;
    if (form.accommodationRoomType !== quote.accommodation.roomType) updates.accommodationRoomType = form.accommodationRoomType;
    if (form.outboundFrom !== quote.flights.outbound.from) updates.outboundFromAirport = form.outboundFrom;
    if (form.outboundTo !== quote.flights.outbound.to) updates.outboundToAirport = form.outboundTo;
    if (form.outboundCarrier !== quote.flights.outbound.carrier) updates.outboundCarrier = form.outboundCarrier;
    if (form.outboundFlightNo !== quote.flights.outbound.flightNo) updates.outboundFlightNo = form.outboundFlightNo;
    if (form.outboundDepart !== quote.flights.outbound.depart) updates.outboundDepart = form.outboundDepart;
    if (form.outboundArrive !== quote.flights.outbound.arrive) updates.outboundArrive = form.outboundArrive;
    if (form.inboundFrom !== quote.flights.inbound.from) updates.inboundFromAirport = form.inboundFrom;
    if (form.inboundTo !== quote.flights.inbound.to) updates.inboundToAirport = form.inboundTo;
    if (form.inboundCarrier !== quote.flights.inbound.carrier) updates.inboundCarrier = form.inboundCarrier;
    if (form.inboundFlightNo !== quote.flights.inbound.flightNo) updates.inboundFlightNo = form.inboundFlightNo;
    if (form.inboundDepart !== quote.flights.inbound.depart) updates.inboundDepart = form.inboundDepart;
    if (form.inboundArrive !== quote.flights.inbound.arrive) updates.inboundArrive = form.inboundArrive;
    if (form.tourOperator !== quote.commissions.tourOperator) updates.tourOperator = form.tourOperator;
    if (form.price !== String(quote.commissions.price)) updates.price = form.price;
    if (form.commissionPercent !== String(quote.commissions.commissionPercent)) updates.commission = form.commissionPercent;
    if (form.agentSplitPercent !== String(quote.commissions.agentSplitPercent)) updates.sales = form.agentSplitPercent;
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
                <Label className="text-xs font-medium text-black/60">Quote Title</Label>
                <Input
                  value={form.quoteTitle}
                  onChange={(e) => set("quoteTitle", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-quote-title"
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
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Package Type</Label>
                <Select value={form.packageType} onValueChange={(v) => set("packageType", v)}>
                  <SelectTrigger className="h-9 rounded-xl border-black/10 bg-white/70" data-testid="edit-select-package-type">
                    <SelectValue />
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
                <Label className="text-xs font-medium text-black/60">Destination</Label>
                <Input
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-destination"
                />
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
                <Label className="text-xs font-medium text-black/60">Return Date</Label>
                <Input
                  type="date"
                  value={form.returnDate}
                  onChange={(e) => set("returnDate", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-return-date"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-black/60">Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.passengersAdults}
                    onChange={(e) => set("passengersAdults", parseInt(e.target.value) || 0)}
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
                    onChange={(e) => set("passengersChildren", parseInt(e.target.value) || 0)}
                    className="h-9 rounded-xl border-black/10 bg-white/70"
                    data-testid="edit-input-children"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Accommodation</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Hotel / Property</Label>
                <Input
                  value={form.accommodationProperty}
                  onChange={(e) => set("accommodationProperty", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-hotel"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Room Type</Label>
                <Input
                  value={form.accommodationRoomType}
                  onChange={(e) => set("accommodationRoomType", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-room-type"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Board Basis</Label>
                <Input
                  value={form.accommodationBoard}
                  onChange={(e) => set("accommodationBoard", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-board"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Plane className="h-4 w-4" />
              Flights
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/45">Outbound</div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">From</Label>
                      <Input value={form.outboundFrom} onChange={(e) => set("outboundFrom", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-from" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">To</Label>
                      <Input value={form.outboundTo} onChange={(e) => set("outboundTo", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-to" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Carrier</Label>
                      <Input value={form.outboundCarrier} onChange={(e) => set("outboundCarrier", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-carrier" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Flight No</Label>
                      <Input value={form.outboundFlightNo} onChange={(e) => set("outboundFlightNo", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-flightno" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Depart</Label>
                      <Input value={form.outboundDepart} onChange={(e) => set("outboundDepart", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-depart" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Arrive</Label>
                      <Input value={form.outboundArrive} onChange={(e) => set("outboundArrive", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-outbound-arrive" />
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-black/45">Inbound</div>
                <div className="grid gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">From</Label>
                      <Input value={form.inboundFrom} onChange={(e) => set("inboundFrom", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-from" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">To</Label>
                      <Input value={form.inboundTo} onChange={(e) => set("inboundTo", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-to" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Carrier</Label>
                      <Input value={form.inboundCarrier} onChange={(e) => set("inboundCarrier", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-carrier" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Flight No</Label>
                      <Input value={form.inboundFlightNo} onChange={(e) => set("inboundFlightNo", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-flightno" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Depart</Label>
                      <Input value={form.inboundDepart} onChange={(e) => set("inboundDepart", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-depart" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-black/60">Arrive</Label>
                      <Input value={form.inboundArrive} onChange={(e) => set("inboundArrive", e.target.value)} className="h-8 rounded-lg border-black/10 bg-white/70 text-xs" data-testid="edit-input-inbound-arrive" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-black/10 bg-white/70 p-4">
            <div className="mb-3 text-sm font-semibold">Pricing &amp; Commission</div>
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Tour Operator</Label>
                <Input
                  value={form.tourOperator}
                  onChange={(e) => set("tourOperator", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-tour-operator"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Total Price (GBP)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-price"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Commission %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.commissionPercent}
                  onChange={(e) => set("commissionPercent", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-commission-percent"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-black/60">Agent Split %</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.agentSplitPercent}
                  onChange={(e) => set("agentSplitPercent", e.target.value)}
                  className="h-9 rounded-xl border-black/10 bg-white/70"
                  data-testid="edit-input-agent-split"
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
    quoteTitle: quote.quoteTitle,
    status: quote.status,
    packageType: quote.packageType,
    destination: quote.destination,
    travelDate: quote.travelDate,
    returnDate: quote.returnDate,
    passengersAdults: quote.passengers.adults,
    passengersChildren: quote.passengers.children,
    accommodationProperty: quote.accommodation.property,
    accommodationBoard: quote.accommodation.board,
    accommodationRoomType: quote.accommodation.roomType,
    outboundFrom: quote.flights.outbound.from,
    outboundTo: quote.flights.outbound.to,
    outboundCarrier: quote.flights.outbound.carrier,
    outboundFlightNo: quote.flights.outbound.flightNo,
    outboundDepart: quote.flights.outbound.depart,
    outboundArrive: quote.flights.outbound.arrive,
    inboundFrom: quote.flights.inbound.from,
    inboundTo: quote.flights.inbound.to,
    inboundCarrier: quote.flights.inbound.carrier,
    inboundFlightNo: quote.flights.inbound.flightNo,
    inboundDepart: quote.flights.inbound.depart,
    inboundArrive: quote.flights.inbound.arrive,
    tourOperator: quote.commissions.tourOperator,
    price: String(quote.commissions.price),
    commissionPercent: String(quote.commissions.commissionPercent),
    agentSplitPercent: String(quote.commissions.agentSplitPercent),
  };
}
