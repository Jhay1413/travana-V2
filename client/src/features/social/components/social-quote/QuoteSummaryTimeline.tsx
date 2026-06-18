import { Plane, Hotel, Bus, MapPin, Calendar, Clock, Anchor, PawPrint, ArrowLeftRight, Car, Ticket, Coffee, ParkingSquare } from "lucide-react";
import type { QuoteDisplay } from "./utils/types";
import { formatTimelineDate, formatTime24, formatIsoDateTime } from "./utils/formatters";

interface QuoteSummaryTimelineProps {
  quote: QuoteDisplay;
}

export function QuoteSummaryTimeline({ quote }: QuoteSummaryTimelineProps) {
  const timelineItems: { type: string; sortKey: string; content: React.ReactNode }[] = [];
  const isHotTub = quote.packageType?.toLowerCase().includes("hot tub");
  const isCruise = quote.packageType?.toLowerCase().includes("cruise");

  if (isHotTub) {
    const checkIn = quote.checkInDate || quote.travelDate;
    const sortKey = checkIn + "T14:00";
    timelineItems.push({
      type: "lodge-checkin",
      sortKey,
      content: (
        <div className="flex gap-2.5" data-testid="timeline-lodge-checkin">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
              <PawPrint className="h-3.5 w-3.5" />
            </div>
            <div className="mt-1 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-4">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Lodge Check-in</div>
            <div className="mt-0.5 text-xs font-semibold">{quote.lodge?.type || "Lodge"}</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatTimelineDate(checkIn)}</span>
              </div>
              {quote.nights > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>{quote.nights} nights</span>
                </div>
              )}
              {quote.pets > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <PawPrint className="h-3 w-3 shrink-0" />
                  <span>{quote.pets} pet{quote.pets !== 1 ? "s" : ""}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ),
    });

    if (quote.accommodation.property) {
      const arrivalSortKey = checkIn + "T15:00";
      timelineItems.push({
        type: "lodge-arrival",
        sortKey: arrivalSortKey,
        content: (
          <div className="flex gap-2.5" data-testid="timeline-lodge-arrival">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <Hotel className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Lodge Arrival</div>
              <div className="mt-0.5 text-xs font-semibold">{quote.accommodation.property}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{[quote.resortName, quote.countryName].filter(Boolean).join(", ") || quote.destinationName}</span>
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    const checkoutDate = quote.returnDate || quote.travelDate;
    timelineItems.push({
      type: "lodge-checkout",
      sortKey: checkoutDate + "T10:00",
      content: (
        <div className="flex gap-2.5" data-testid="timeline-lodge-checkout">
          <div className="flex flex-col items-center">
            <div className="grid h-7 w-7 place-items-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
              <PawPrint className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="flex-1 pb-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">Lodge Checkout</div>
            <div className="mt-1 grid gap-1">
              <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                <Calendar className="h-3 w-3 shrink-0" />
                <span>{formatTimelineDate(checkoutDate)}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    });
  } else {
    const buildSortKey = (date: string, section: string, time?: string) =>
      `${date || "9999-12-31"}#${section}#${time || "00:00"}`;

    if (quote.flights.outbound.from) {
      timelineItems.push({
        type: "outbound",
        sortKey: buildSortKey(quote.flights.outbound.departDate, "0", quote.flights.outbound.departTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-outbound">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-blue-200 bg-blue-50 text-blue-600">
                <Plane className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Outbound Flight</div>
              <div className="mt-0.5 text-xs font-semibold">{quote.flights.outbound.from} → {quote.flights.outbound.to}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatTimelineDate(quote.flights.outbound.departDate)}</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Clock className="h-3 w-3 shrink-0" />
                  <span>Depart {formatTime24(quote.flights.outbound.departTime)}{quote.flights.outbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.outbound.arriveTime)}` : ""}</span>
                </div>
                {(quote.flights.outbound.carrier || quote.flights.outbound.flightNo) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Plane className="h-3 w-3 shrink-0" />
                    <span>{[quote.flights.outbound.carrier, quote.flights.outbound.flightNo].filter(Boolean).join(" ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ),
      });
    }

    if (quote.transferType && !isCruise) {
      const transferDate = quote.checkInDate || quote.travelDate || quote.flights.outbound.departDate;
      const transferTime = quote.checkInTime || "14:00";
      timelineItems.push({
        type: "transfer",
        sortKey: buildSortKey(transferDate, "2", transferTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-transfer">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
                <Bus className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Transfer</div>
              <div className="mt-0.5 text-xs font-semibold">{quote.transferType}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{quote.flights.outbound.to || "Airport"} → {quote.accommodation.property || quote.destinationName}</span>
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    if (isCruise && quote.cruise) {
      const cruiseDate = quote.cruise.cruiseDate || quote.travelDate;
      timelineItems.push({
        type: "cruise-embarkation",
        sortKey: buildSortKey(cruiseDate, "3", "00:00"),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-cruise-embarkation">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-600">
                <Anchor className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-cyan-600">Cruise Embarkation</div>
              <div className="mt-0.5 text-xs font-semibold">{quote.cruise.ship || quote.cruise.cruiseLine}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatTimelineDate(cruiseDate)}</span>
                </div>
                {quote.cruise.cruiseName && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Anchor className="h-3 w-3 shrink-0" />
                    <span>{quote.cruise.cruiseName}</span>
                  </div>
                )}
                {quote.cruise.cabinType && (
                  <span className="mt-0.5 inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{quote.cruise.cabinType}</span>
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
      timelineItems.push({
        type: "hotel",
        sortKey: buildSortKey(checkIn, "3", checkInTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-hotel">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <Hotel className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Hotel Check-in</div>
              <div className="mt-0.5 text-xs font-semibold">{quote.accommodation.property}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatTimelineDate(checkIn)}</span>
                  {checkInTime && <span>at {formatTime24(checkInTime)}</span>}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span>{[quote.resortName, quote.countryName].filter(Boolean).join(", ") || quote.destinationName}</span>
                </div>
                {quote.nights > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{quote.nights} nights</span>
                  </div>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {quote.accommodation.roomType && (
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{quote.accommodation.roomType}</span>
                  )}
                  {quote.accommodation.board && (
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{quote.accommodation.board}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ),
      });
    }

    // Additional accommodations are part of the trip itinerary — render them
    // inline in the timeline (sorted by their own check-in date), not in Extras.
    quote.extraAccommodations.forEach((a, idx) => {
      if (!a.property && !a.checkInDate) return;
      const accomCheckIn = a.checkInDate || quote.checkInDate || quote.travelDate;
      timelineItems.push({
        type: "hotel-extra",
        sortKey: buildSortKey(accomCheckIn, "3", "14:00"),
        content: (
          <div className="flex gap-2.5" data-testid={`timeline-hotel-extra-${idx}`}>
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                <Hotel className="h-3.5 w-3.5" />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Hotel Check-in</div>
              {a.property && <div className="mt-0.5 text-xs font-semibold">{a.property}</div>}
              <div className="mt-1 grid gap-1">
                {a.checkInDate && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Calendar className="h-3 w-3 shrink-0" />
                    <span>{formatTimelineDate(a.checkInDate)}</span>
                  </div>
                )}
                {a.noOfNights != null && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{a.noOfNights} night{a.noOfNights !== 1 ? "s" : ""}</span>
                  </div>
                )}
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {a.roomType && (
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{a.roomType}</span>
                  )}
                  {a.board && (
                    <span className="inline-flex items-center rounded-full border border-black/10 bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold text-black/70">{a.board}</span>
                  )}
                </div>
                {a.tourOperatorName && <div className="text-[11px] text-black/50">{a.tourOperatorName}</div>}
              </div>
            </div>
          </div>
        ),
      });
    });

    const hasInbound = quote.flights.inbound.from || quote.flights.inbound.to || quote.flights.inbound.departDate || quote.returnDate;
    if (hasInbound) {
      const ibDate = quote.flights.inbound.departDate || quote.returnDate;
      const ibFrom = quote.flights.inbound.from || quote.flights.outbound.to || "";
      const ibTo = quote.flights.inbound.to || quote.flights.outbound.from || "";
      timelineItems.push({
        type: "inbound",
        sortKey: buildSortKey(ibDate, "4", quote.flights.inbound.departTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-inbound">
            <div className="flex flex-col items-center">
              <div className="grid h-7 w-7 place-items-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
                <Plane className="h-3.5 w-3.5 rotate-180" />
              </div>
            </div>
            <div className="flex-1 pb-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">Inbound Flight</div>
              <div className="mt-0.5 text-xs font-semibold">{ibFrom} → {ibTo}</div>
              <div className="mt-1 grid gap-1">
                <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                  <Calendar className="h-3 w-3 shrink-0" />
                  <span>{formatTimelineDate(ibDate)}</span>
                </div>
                {quote.flights.inbound.departTime && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>Depart {formatTime24(quote.flights.inbound.departTime)}{quote.flights.inbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.inbound.arriveTime)}` : ""}</span>
                  </div>
                )}
                {(quote.flights.inbound.carrier || quote.flights.inbound.flightNo) && (
                  <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                    <Plane className="h-3 w-3 shrink-0" />
                    <span>{[quote.flights.inbound.carrier, quote.flights.inbound.flightNo].filter(Boolean).join(" ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ),
      });
    }
  }

  timelineItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  const sortByKey = <T,>(items: T[], getKey: (item: T) => string | null | undefined) =>
    [...items].sort((a, b) => (getKey(a) || "￿").localeCompare(getKey(b) || "￿"));
  const sortedTransfers = sortByKey(quote.transfers, (t) => t.pickUpTime);
  const sortedCarHires = sortByKey(quote.carHires, (c) => c.pickUpTime);
  const sortedAttractionTickets = sortByKey(quote.attractionTickets, (t) => t.dateOfVisit);
  const sortedLoungePasses = sortByKey(quote.loungePasses, (p) => p.dateOfUsage);
  const sortedAirportParkings = sortByKey(quote.airportParkings, (p) => p.parkingDate);

  return (
    <div data-testid="card-quote-summary-timeline">
      <div className="mb-3">
        <div className="text-xs font-semibold" data-testid="text-timeline-title">Travel Summary</div>
        <div className="mt-0.5 text-[11px] text-black/55" data-testid="text-timeline-subtitle">
          {formatTimelineDate(quote.travelDate)} — {formatTimelineDate(quote.returnDate)} · {quote.destinationName}
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

      {/* Extras */}
      {(quote.transfers.length > 0 || quote.carHires.length > 0 || quote.attractionTickets.length > 0 || quote.loungePasses.length > 0 || quote.airportParkings.length > 0) && (
        <div className="mt-4 pt-4 border-t border-black/8" data-testid="section-extras">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-black/40 mb-3">Extras</div>
          <div className="space-y-2">
            {sortedTransfers.map((t, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-transfer-${idx}`}>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-sky-200 bg-sky-50 text-sky-600">
                  <ArrowLeftRight className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 py-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-sky-600">Transfer</div>
                  {(t.pickUpLocation || t.dropOffLocation) && (
                    <div className="mt-0.5 text-xs font-semibold">{[t.pickUpLocation, t.dropOffLocation].filter(Boolean).join(" → ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {t.pickUpTime && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Pick-up {formatIsoDateTime(t.pickUpTime)}{t.dropOffTime ? ` · Drop-off ${formatIsoDateTime(t.dropOffTime)}` : ""}</span>
                      </div>
                    )}
                    {t.note && <div className="text-[11px] text-black/50 italic">{t.note}</div>}
                    {t.tourOperatorName && <div className="text-[11px] text-black/50">{t.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedCarHires.map((c, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-carhire-${idx}`}>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-amber-200 bg-amber-50 text-amber-600">
                  <Car className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 py-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Car Hire</div>
                  {(c.pickUpLocation || c.dropOffLocation) && (
                    <div className="mt-0.5 text-xs font-semibold">{[c.pickUpLocation, c.dropOffLocation].filter(Boolean).join(" → ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {c.noOfDays != null && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>{c.noOfDays} day{c.noOfDays !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {c.tourOperatorName && <div className="text-[11px] text-black/50">{c.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedAttractionTickets.map((t, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-ticket-${idx}`}>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-purple-200 bg-purple-50 text-purple-600">
                  <Ticket className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 py-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-600">Attraction Ticket</div>
                  {t.ticketType && <div className="mt-0.5 text-xs font-semibold">{t.ticketType}</div>}
                  <div className="mt-0.5 grid gap-0.5">
                    {t.dateOfVisit && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatTimelineDate(t.dateOfVisit)}</span>
                      </div>
                    )}
                    <div className="text-[11px] text-black/60">{t.numberOfTickets} ticket{t.numberOfTickets !== 1 ? "s" : ""}</div>
                    {t.tourOperatorName && <div className="text-[11px] text-black/50">{t.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedLoungePasses.map((p, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-lounge-${idx}`}>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-600">
                  <Coffee className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 py-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-rose-600">Lounge Pass</div>
                  {(p.airportName || p.terminal) && (
                    <div className="mt-0.5 text-xs font-semibold">{[p.airportName, p.terminal ? `Terminal ${p.terminal}` : null].filter(Boolean).join(" · ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {p.dateOfUsage && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatTimelineDate(p.dateOfUsage)}</span>
                      </div>
                    )}
                    {p.note && <div className="text-[11px] text-black/50 italic">{p.note}</div>}
                    {p.tourOperatorName && <div className="text-[11px] text-black/50">{p.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedAirportParkings.map((p, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-parking-${idx}`}>
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600">
                  <ParkingSquare className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 py-0.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Airport Parking</div>
                  {(p.airportName || p.parkingType) && (
                    <div className="mt-0.5 text-xs font-semibold">{[p.airportName, p.parkingType].filter(Boolean).join(" · ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {p.parkingDate && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatTimelineDate(p.parkingDate)}</span>
                      </div>
                    )}
                    {p.duration && <div className="text-[11px] text-black/60">{p.duration}</div>}
                    {p.tourOperatorName && <div className="text-[11px] text-black/50">{p.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
