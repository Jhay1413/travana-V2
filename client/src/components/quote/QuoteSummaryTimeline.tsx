import { Plane, Hotel, Bus, Clock, MapPin, Calendar, Anchor, PawPrint } from "lucide-react";
import type { QuoteDisplay } from "./quote-types";
import { formatTimelineDate, formatTime24 } from "./quote-types";

export function QuoteSummaryTimeline({ quote }: { quote: QuoteDisplay }) {
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
    const hasOutboundPrimary = Boolean(
      quote.flights.outbound.from ||
      quote.flights.outbound.to ||
      quote.flights.outbound.departDate ||
      quote.flights.outbound.flightNo
    );
    const hasOutboundConnecting = quote.flights.outboundConnecting.some(
      (leg) => leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo,
    );

    if (hasOutboundPrimary) {
      const sortKey = quote.flights.outbound.departDate + "T" + (quote.flights.outbound.departTime || "00:00");
      timelineItems.push({
        type: "outbound",
        sortKey,
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

    if (hasOutboundConnecting) {
      quote.flights.outboundConnecting.forEach((leg, idx) => {
        if (leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo) {
          const connSortKey = leg.departDate + "T" + (leg.departTime || "00:01");
          timelineItems.push({
            type: "outbound-connecting",
            sortKey: connSortKey,
            content: (
              <div className="flex gap-2.5" data-testid={`timeline-outbound-connecting-${idx}`}>
                <div className="flex flex-col items-center">
                  <div className="grid h-7 w-7 place-items-center rounded-full border border-blue-200 bg-blue-50/60 text-blue-500">
                    <Plane className="h-3.5 w-3.5" />
                  </div>
                  <div className="mt-1 h-full w-px bg-black/10" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Connecting Flight {hasOutboundPrimary ? idx + 2 : idx + 1}</div>
                  <div className="mt-0.5 text-xs font-semibold">{leg.from} → {leg.to}</div>
                  <div className="mt-1 grid gap-1">
                    {leg.departDate && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatTimelineDate(leg.departDate)}</span>
                      </div>
                    )}
                    {leg.departTime && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Depart {formatTime24(leg.departTime)}{leg.arriveTime ? ` — Arrive ${formatTime24(leg.arriveTime)}` : ""}</span>
                      </div>
                    )}
                    {leg.flightNo && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Plane className="h-3 w-3 shrink-0" />
                        <span>{leg.flightNo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          });
        }
      });
    }

    if (isCruise && quote.cruise) {
      const cruiseDate = quote.cruise.cruiseDate || quote.travelDate;
      const sortKey = cruiseDate + "T12:00";
      timelineItems.push({
        type: "cruise-embarkation",
        sortKey,
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
      const sortKey = checkIn + "T" + checkInTime;
      timelineItems.push({
        type: "hotel",
        sortKey,
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

    if (quote.transferType && !isCruise) {
      const transferDate = quote.checkInDate || quote.travelDate;
      const sortKey = transferDate + "T" + (quote.flights.outbound.arriveTime || "12:00");
      timelineItems.push({
        type: "transfer",
        sortKey,
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

    const hasInboundPrimary = Boolean(
      quote.flights.inbound.from ||
      quote.flights.inbound.to ||
      quote.flights.inbound.departDate ||
      quote.returnDate
    );
    const hasInboundConnecting = quote.flights.inboundConnecting.some(
      (leg) => leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo,
    );

    if (hasInboundPrimary) {
      const ibDate = quote.flights.inbound.departDate || quote.returnDate;
      const sortKey = ibDate + "T" + (quote.flights.inbound.departTime || "23:59");
      const ibFrom = quote.flights.inbound.from || quote.flights.outbound.to || "";
      const ibTo = quote.flights.inbound.to || quote.flights.outbound.from || "";
      timelineItems.push({
        type: "inbound",
        sortKey,
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

    if (hasInboundConnecting) {
      quote.flights.inboundConnecting.forEach((leg, idx) => {
        if (leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo) {
          const connSortKey = leg.departDate + "T" + (leg.departTime || "23:58");
          timelineItems.push({
            type: "inbound-connecting",
            sortKey: connSortKey,
            content: (
              <div className="flex gap-2.5" data-testid={`timeline-inbound-connecting-${idx}`}>
                <div className="flex flex-col items-center">
                  <div className="grid h-7 w-7 place-items-center rounded-full border border-purple-200 bg-purple-50/60 text-purple-500">
                    <Plane className="h-3.5 w-3.5 rotate-180" />
                  </div>
                  <div className="mt-1 h-full w-px bg-black/10" />
                </div>
                <div className="flex-1 pb-4">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-purple-500">Connecting Flight {hasInboundPrimary ? idx + 2 : idx + 1}</div>
                  <div className="mt-0.5 text-xs font-semibold">{leg.from} → {leg.to}</div>
                  <div className="mt-1 grid gap-1">
                    {leg.departDate && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{formatTimelineDate(leg.departDate)}</span>
                      </div>
                    )}
                    {leg.departTime && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span>Depart {formatTime24(leg.departTime)}{leg.arriveTime ? ` — Arrive ${formatTime24(leg.arriveTime)}` : ""}</span>
                      </div>
                    )}
                    {leg.flightNo && (
                      <div className="flex items-center gap-1.5 text-[11px] text-black/60">
                        <Plane className="h-3 w-3 shrink-0" />
                        <span>{leg.flightNo}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ),
          });
        }
      });
    }
  }

  timelineItems.sort((a, b) => a.sortKey.localeCompare(b.sortKey));

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
    </div>
  );
}
