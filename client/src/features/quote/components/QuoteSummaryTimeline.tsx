import { Plane, Hotel, Bus, Clock, MapPin, Calendar, Anchor, PawPrint, ArrowLeftRight, Car, Ticket, Coffee, ParkingSquare } from "lucide-react";
import type { QuoteDisplay } from "./quote-types";
import { formatTimelineDate, formatTime24, formatIsoDateTime } from "./quote-types";

type TimelineVariant = "default" | "panel";

interface TimelineTypography {
  title: string;
  subtitle: string;
  label: (color: string) => string;
  primary: string;
  secondaryRow: string;
  secondaryText: string;
  iconWrap: string;
  icon: string;
  smallIcon: string;
}

const DEFAULT_TYPOGRAPHY: TimelineTypography = {
  title: "text-xs font-semibold",
  subtitle: "mt-0.5 text-[11px] text-black/55",
  label: (color: string) => `text-[10px] font-semibold uppercase tracking-wide ${color}`,
  primary: "mt-0.5 text-xs font-semibold",
  secondaryRow: "flex items-center gap-1.5 text-[11px] text-black/60",
  secondaryText: "text-[11px] text-black/50",
  iconWrap: "grid h-7 w-7 place-items-center rounded-full border",
  icon: "h-3.5 w-3.5",
  smallIcon: "h-3 w-3 shrink-0",
};

// Sizes step down one notch below xl so the narrow lg panel tier stays legible.
const PANEL_TYPOGRAPHY: TimelineTypography = {
  title: "text-[13px] font-bold 3xl:text-[15px]",
  subtitle: "mt-0.5 text-xs text-black/80 3xl:text-[13px] dark:text-white/80",
  label: (color: string) => `text-xs font-bold 3xl:text-[13px] ${color}`,
  primary: "mt-0.5 text-xs font-bold text-black 3xl:text-[13px] dark:text-white",
  secondaryRow: "flex items-center gap-1.5 text-[11px] text-black/75 3xl:text-xs dark:text-white/75",
  secondaryText: "text-[11px] text-black/75 3xl:text-xs dark:text-white/75",
  iconWrap: "grid h-6 w-6 place-items-center rounded-[6px] border 3xl:h-7 3xl:w-7",
  icon: "h-3 w-3 3xl:h-3.5 3xl:w-3.5",
  smallIcon: "h-3 w-3 shrink-0",
};

export function QuoteSummaryTimeline({ quote, variant = "default" }: { quote: QuoteDisplay; variant?: TimelineVariant }) {
  const T = variant === "panel" ? PANEL_TYPOGRAPHY : DEFAULT_TYPOGRAPHY;
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
            <div className={`${T.iconWrap} border-amber-200 bg-amber-50 text-amber-600`}>
              <PawPrint className={T.icon} />
            </div>
            <div className="mt-1 h-full w-px bg-black/10" />
          </div>
          <div className="flex-1 pb-4">
            <div className={T.label("text-amber-600")}>Lodge Check-in</div>
            <div className={T.primary}>{quote.lodge?.type || "Lodge"}</div>
            <div className="mt-1 grid gap-1">
              <div className={T.secondaryRow}>
                <Calendar className={T.smallIcon} />
                <span>{formatTimelineDate(checkIn)}</span>
              </div>
              {quote.nights > 0 && (
                <div className={T.secondaryRow}>
                  <Clock className={T.smallIcon} />
                  <span>{quote.nights} nights</span>
                </div>
              )}
              {quote.pets > 0 && (
                <div className={T.secondaryRow}>
                  <PawPrint className={T.smallIcon} />
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
              <div className={`${T.iconWrap} border-emerald-200 bg-emerald-50 text-emerald-600`}>
                <Hotel className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-emerald-600")}>Lodge Arrival</div>
              <div className={T.primary}>{quote.accommodation.property}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <MapPin className={T.smallIcon} />
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
            <div className={`${T.iconWrap} border-purple-200 bg-purple-50 text-purple-600`}>
              <PawPrint className={T.icon} />
            </div>
          </div>
          <div className="flex-1 pb-2">
            <div className={T.label("text-purple-600")}>Lodge Checkout</div>
            <div className="mt-1 grid gap-1">
              <div className={T.secondaryRow}>
                <Calendar className={T.smallIcon} />
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
    const validOutboundConnecting = quote.flights.outboundConnecting.filter(
      (leg) => leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo,
    );
    const hasOutboundConnecting = validOutboundConnecting.length > 0;
    const outboundLegCount = (hasOutboundPrimary ? 1 : 0) + validOutboundConnecting.length;
    const buildSortKey = (date: string, section: string, time?: string) =>
      `${date || "9999-12-31"}#${section}#${time || "00:00"}`;

    if (hasOutboundPrimary) {
      timelineItems.push({
        type: "outbound",
        sortKey: buildSortKey(quote.flights.outbound.departDate, "0", quote.flights.outbound.departTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-outbound">
            <div className="flex flex-col items-center">
              <div className={`${T.iconWrap} border-blue-200 bg-blue-50 text-blue-600`}>
                <Plane className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-blue-600")}>Outbound Flight</div>
              <div className={T.primary}>{quote.flights.outbound.from} → {quote.flights.outbound.to}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <Calendar className={T.smallIcon} />
                  <span>{formatTimelineDate(quote.flights.outbound.departDate)}</span>
                </div>
                <div className={T.secondaryRow}>
                  <Clock className={T.smallIcon} />
                  <span>Depart {formatTime24(quote.flights.outbound.departTime)}{quote.flights.outbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.outbound.arriveTime)}` : ""}</span>
                </div>
                {(quote.flights.outbound.carrier || quote.flights.outbound.flightNo) && (
                  <div className={T.secondaryRow}>
                    <Plane className={T.smallIcon} />
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
      validOutboundConnecting.forEach((leg, idx) => {
        const legNumber = (hasOutboundPrimary ? 1 : 0) + idx + 1;
        timelineItems.push({
          type: "outbound-connecting",
          sortKey: buildSortKey(leg.departDate || quote.flights.outbound.departDate, "1", leg.departTime),
          content: (
            <div className="flex gap-2.5" data-testid={`timeline-outbound-connecting-${idx}`}>
              <div className="flex flex-col items-center">
                <div className={`${T.iconWrap} border-blue-200 bg-blue-50/60 text-blue-500`}>
                  <Plane className={T.icon} />
                </div>
                <div className="mt-1 h-full w-px bg-black/10" />
              </div>
              <div className="flex-1 pb-4">
                <div className={T.label("text-blue-500")}>Connecting Flight {legNumber}</div>
                <div className={T.primary}>{leg.from} → {leg.to}</div>
                <div className="mt-1 grid gap-1">
                  {leg.departDate && (
                    <div className={T.secondaryRow}>
                      <Calendar className={T.smallIcon} />
                      <span>{formatTimelineDate(leg.departDate)}</span>
                    </div>
                  )}
                  {leg.departTime && (
                    <div className={T.secondaryRow}>
                      <Clock className={T.smallIcon} />
                      <span>Depart {formatTime24(leg.departTime)}{leg.arriveTime ? ` — Arrive ${formatTime24(leg.arriveTime)}` : ""}</span>
                    </div>
                  )}
                  {leg.flightNo && (
                    <div className={T.secondaryRow}>
                      <Plane className={T.smallIcon} />
                      <span>{leg.flightNo}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        });
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
              <div className={`${T.iconWrap} border-amber-200 bg-amber-50 text-amber-600`}>
                <Bus className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-amber-600")}>Transfer</div>
              <div className={T.primary}>{quote.transferType}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <MapPin className={T.smallIcon} />
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
              <div className={`${T.iconWrap} border-cyan-200 bg-cyan-50 text-cyan-600`}>
                <Anchor className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-cyan-600")}>Cruise Embarkation</div>
              <div className={T.primary}>{quote.cruise.ship || quote.cruise.cruiseLine}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <Calendar className={T.smallIcon} />
                  <span>{formatTimelineDate(cruiseDate)}</span>
                </div>
                {quote.cruise.cruiseName && (
                  <div className={T.secondaryRow}>
                    <Anchor className={T.smallIcon} />
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
              <div className={`${T.iconWrap} border-emerald-200 bg-emerald-50 text-emerald-600`}>
                <Hotel className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-emerald-600")}>Hotel Check-in</div>
              <div className={T.primary}>{quote.accommodation.property}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <Calendar className={T.smallIcon} />
                  <span>{formatTimelineDate(checkIn)}</span>
                  {checkInTime && <span>at {formatTime24(checkInTime)}</span>}
                </div>
                <div className={T.secondaryRow}>
                  <MapPin className={T.smallIcon} />
                  <span>{[quote.resortName, quote.countryName].filter(Boolean).join(", ") || quote.destinationName}</span>
                </div>
                {quote.nights > 0 && (
                  <div className={T.secondaryRow}>
                    <Clock className={T.smallIcon} />
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
              <div className={`${T.iconWrap} border-emerald-200 bg-emerald-50 text-emerald-600`}>
                <Hotel className={T.icon} />
              </div>
              <div className="mt-1 h-full w-px bg-black/10" />
            </div>
            <div className="flex-1 pb-4">
              <div className={T.label("text-emerald-600")}>Hotel Check-in</div>
              {a.property && <div className={T.primary}>{a.property}</div>}
              <div className="mt-1 grid gap-1">
                {a.checkInDate && (
                  <div className={T.secondaryRow}>
                    <Calendar className={T.smallIcon} />
                    <span>{formatTimelineDate(a.checkInDate)}</span>
                  </div>
                )}
                {a.noOfNights != null && (
                  <div className={T.secondaryRow}>
                    <Clock className={T.smallIcon} />
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
                {a.tourOperatorName && <div className={T.secondaryText}>{a.tourOperatorName}</div>}
              </div>
            </div>
          </div>
        ),
      });
    });

    const hasInboundPrimary = Boolean(
      quote.flights.inbound.from ||
      quote.flights.inbound.to ||
      quote.flights.inbound.departDate ||
      quote.returnDate
    );
    const validInboundConnecting = quote.flights.inboundConnecting.filter(
      (leg) => leg.from || leg.to || leg.departDate || leg.arriveDate || leg.flightNo,
    );
    const hasInboundConnecting = validInboundConnecting.length > 0;

    if (hasInboundPrimary) {
      const ibDate = quote.flights.inbound.departDate || quote.returnDate;
      const ibFrom = quote.flights.inbound.from || quote.flights.outbound.to || "";
      const ibTo = quote.flights.inbound.to || quote.flights.outbound.from || "";
      timelineItems.push({
        type: "inbound",
        sortKey: buildSortKey(ibDate, "4", quote.flights.inbound.departTime),
        content: (
          <div className="flex gap-2.5" data-testid="timeline-inbound">
            <div className="flex flex-col items-center">
              <div className={`${T.iconWrap} border-purple-200 bg-purple-50 text-purple-600`}>
                <Plane className={`${T.icon} rotate-180`} />
              </div>
            </div>
            <div className="flex-1 pb-2">
              <div className={T.label("text-purple-600")}>Inbound Flight</div>
              <div className={T.primary}>{ibFrom} → {ibTo}</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <Calendar className={T.smallIcon} />
                  <span>{formatTimelineDate(ibDate)}</span>
                </div>
                {quote.flights.inbound.departTime && (
                  <div className={T.secondaryRow}>
                    <Clock className={T.smallIcon} />
                    <span>Depart {formatTime24(quote.flights.inbound.departTime)}{quote.flights.inbound.arriveTime ? ` — Arrive ${formatTime24(quote.flights.inbound.arriveTime)}` : ""}</span>
                  </div>
                )}
                {(quote.flights.inbound.carrier || quote.flights.inbound.flightNo) && (
                  <div className={T.secondaryRow}>
                    <Plane className={T.smallIcon} />
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
      validInboundConnecting.forEach((leg, idx) => {
        const legNumber = outboundLegCount + (hasInboundPrimary ? 1 : 0) + idx + 1;
        timelineItems.push({
          type: "inbound-connecting",
          sortKey: buildSortKey(leg.departDate || quote.flights.inbound.departDate || quote.returnDate, "5", leg.departTime),
          content: (
            <div className="flex gap-2.5" data-testid={`timeline-inbound-connecting-${idx}`}>
              <div className="flex flex-col items-center">
                <div className={`${T.iconWrap} border-purple-200 bg-purple-50/60 text-purple-500`}>
                  <Plane className={`${T.icon} rotate-180`} />
                </div>
                <div className="mt-1 h-full w-px bg-black/10" />
              </div>
              <div className="flex-1 pb-4">
                <div className={T.label("text-purple-500")}>Connecting Flight {legNumber}</div>
                <div className={T.primary}>{leg.from} → {leg.to}</div>
                <div className="mt-1 grid gap-1">
                  {leg.departDate && (
                    <div className={T.secondaryRow}>
                      <Calendar className={T.smallIcon} />
                      <span>{formatTimelineDate(leg.departDate)}</span>
                    </div>
                  )}
                  {leg.departTime && (
                    <div className={T.secondaryRow}>
                      <Clock className={T.smallIcon} />
                      <span>Depart {formatTime24(leg.departTime)}{leg.arriveTime ? ` — Arrive ${formatTime24(leg.arriveTime)}` : ""}</span>
                    </div>
                  )}
                  {leg.flightNo && (
                    <div className={T.secondaryRow}>
                      <Plane className={T.smallIcon} />
                      <span>{leg.flightNo}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ),
        });
      });
    }

    if (quote.flightMeals || quote.preBookedSeats) {
      timelineItems.push({
        type: "flight-extras",
        sortKey: "9999-12-31#9#23:59",
        content: (
          <div className="flex gap-2.5" data-testid="timeline-flight-extras">
            <div className="flex flex-col items-center">
              <div className={`${T.iconWrap} border-sky-200 bg-sky-50 text-sky-600`}>
                <Plane className={T.icon} />
              </div>
            </div>
            <div className="flex-1 pb-2">
              <div className={T.label("text-sky-600")}>Flight Extras</div>
              <div className="mt-1 grid gap-1">
                <div className={T.secondaryRow}>
                  <span className="font-medium text-black/80">Flight Meals:</span>
                  <span>{quote.flightMeals === "Yes" ? "Yes" : "No"}</span>
                </div>
                <div className={T.secondaryRow}>
                  <span className="font-medium text-black/80">Pre-booked Seats:</span>
                  <span>{quote.preBookedSeats || "No"}</span>
                </div>
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
        <div className={T.title} data-testid="text-timeline-title">Travel Summary</div>
        <div className={T.subtitle} data-testid="text-timeline-subtitle">
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
          <div className={`${T.label("text-black/40")} mb-3`}>Extras</div>
          <div className="space-y-2">
            {sortedTransfers.map((t, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-transfer-${idx}`}>
                <div className={`${T.iconWrap} shrink-0 border-sky-200 bg-sky-50 text-sky-600`}>
                  <ArrowLeftRight className={T.icon} />
                </div>
                <div className="flex-1 py-0.5">
                  <div className={T.label("text-sky-600")}>Transfer</div>
                  {(t.pickUpLocation || t.dropOffLocation) && (
                    <div className={T.primary}>{[t.pickUpLocation, t.dropOffLocation].filter(Boolean).join(" → ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {t.pickUpTime && (
                      <div className={T.secondaryRow}>
                        <Clock className={T.smallIcon} />
                        <span>Pick-up {formatIsoDateTime(t.pickUpTime)}{t.dropOffTime ? ` · Drop-off ${formatIsoDateTime(t.dropOffTime)}` : ""}</span>
                      </div>
                    )}
                    {t.note && <div className={`${T.secondaryText} italic`}>{t.note}</div>}
                    {t.tourOperatorName && <div className={T.secondaryText}>{t.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedCarHires.map((c, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-carhire-${idx}`}>
                <div className={`${T.iconWrap} shrink-0 border-amber-200 bg-amber-50 text-amber-600`}>
                  <Car className={T.icon} />
                </div>
                <div className="flex-1 py-0.5">
                  <div className={T.label("text-amber-600")}>Car Hire</div>
                  {(c.pickUpLocation || c.dropOffLocation) && (
                    <div className={T.primary}>{[c.pickUpLocation, c.dropOffLocation].filter(Boolean).join(" → ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {c.noOfDays != null && (
                      <div className={T.secondaryRow}>
                        <Clock className={T.smallIcon} />
                        <span>{c.noOfDays} day{c.noOfDays !== 1 ? "s" : ""}</span>
                      </div>
                    )}
                    {c.tourOperatorName && <div className={T.secondaryText}>{c.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedAttractionTickets.map((t, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-ticket-${idx}`}>
                <div className={`${T.iconWrap} shrink-0 border-purple-200 bg-purple-50 text-purple-600`}>
                  <Ticket className={T.icon} />
                </div>
                <div className="flex-1 py-0.5">
                  <div className={T.label("text-purple-600")}>Attraction Ticket</div>
                  {t.ticketType && <div className={T.primary}>{t.ticketType}</div>}
                  <div className="mt-0.5 grid gap-0.5">
                    {t.dateOfVisit && (
                      <div className={T.secondaryRow}>
                        <Calendar className={T.smallIcon} />
                        <span>{formatTimelineDate(t.dateOfVisit)}</span>
                      </div>
                    )}
                    <div className={T.secondaryText}>{t.numberOfTickets} ticket{t.numberOfTickets !== 1 ? "s" : ""}</div>
                    {t.tourOperatorName && <div className={T.secondaryText}>{t.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedLoungePasses.map((p, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-lounge-${idx}`}>
                <div className={`${T.iconWrap} shrink-0 border-rose-200 bg-rose-50 text-rose-600`}>
                  <Coffee className={T.icon} />
                </div>
                <div className="flex-1 py-0.5">
                  <div className={T.label("text-rose-600")}>Lounge Pass</div>
                  {(p.airportName || p.terminal) && (
                    <div className={T.primary}>{[p.airportName, p.terminal ? `Terminal ${p.terminal}` : null].filter(Boolean).join(" · ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {p.dateOfUsage && (
                      <div className={T.secondaryRow}>
                        <Calendar className={T.smallIcon} />
                        <span>{formatTimelineDate(p.dateOfUsage)}</span>
                      </div>
                    )}
                    {p.note && <div className={`${T.secondaryText} italic`}>{p.note}</div>}
                    {p.tourOperatorName && <div className={T.secondaryText}>{p.tourOperatorName}</div>}
                  </div>
                </div>
              </div>
            ))}

            {sortedAirportParkings.map((p, idx) => (
              <div key={idx} className="flex gap-2.5" data-testid={`extra-parking-${idx}`}>
                <div className={`${T.iconWrap} shrink-0 border-emerald-200 bg-emerald-50 text-emerald-600`}>
                  <ParkingSquare className={T.icon} />
                </div>
                <div className="flex-1 py-0.5">
                  <div className={T.label("text-emerald-600")}>Airport Parking</div>
                  {(p.airportName || p.parkingType) && (
                    <div className={T.primary}>{[p.airportName, p.parkingType].filter(Boolean).join(" · ")}</div>
                  )}
                  <div className="mt-0.5 grid gap-0.5">
                    {p.parkingDate && (
                      <div className={T.secondaryRow}>
                        <Calendar className={T.smallIcon} />
                        <span>{formatTimelineDate(p.parkingDate)}</span>
                      </div>
                    )}
                    {p.duration && <div className={T.secondaryText}>{p.duration}</div>}
                    {p.tourOperatorName && <div className={T.secondaryText}>{p.tourOperatorName}</div>}
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
