import { NO_DECISION, type PortalQuoteDecision } from '@shared/portal-quotes';
import { customerPrice } from '../../utils/customer-price';
import type { quotePublicRepository } from '../quote/quote-public.repository';
import type {
  PortalDecisionActionRow,
  PortalQuoteAccessRow,
  PortalQuoteDetail,
  PortalQuoteListItem,
  PortalQuoteListRow,
} from './portal-quotes.types';

/** The public quote repository's output: the allowlisted source the portal detail is built from. */
export type PublicQuoteData = NonNullable<Awaited<ReturnType<typeof quotePublicRepository.findByToken>>>;

type DateLike = Date | string | null | undefined;

/** ISO string for a timestamp or date column value; null when there is none. */
export function toIso(value: DateLike): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The "YYYY-MM-DD" date `nights` after `date`, in UTC so a daylight-saving change can never shift it. */
export function addNights(date: string, nights: number): string {
  const ms = new Date(`${date.slice(0, 10)}T00:00:00Z`).getTime();
  return new Date(ms + nights * 86400000).toISOString().slice(0, 10);
}

/**
 * The customer's current decision on each quote: the newest accepted / declined / reopened action wins
 * (accepted = interested, declined = not interested, reopened = the undo of a decline).
 * `rows` must be newest first.
 */
export function latestDecisions(rows: PortalDecisionActionRow[]): Map<string, PortalQuoteDecision> {
  const out = new Map<string, PortalQuoteDecision>();
  for (const r of rows) {
    if (out.has(r.quoteId)) continue;
    const at = toIso(r.createdAt);
    if (r.actionType === 'accepted') {
      out.set(r.quoteId, { state: 'interested', reason: null, note: r.message, wantsSimilar: null, at });
    } else if (r.actionType === 'declined') {
      out.set(r.quoteId, { state: 'declined', reason: r.reason, note: r.message, wantsSimilar: r.wantsSimilar, at });
    } else {
      out.set(r.quoteId, { ...NO_DECISION });
    }
  }
  return out;
}

export function decisionFor(map: Map<string, PortalQuoteDecision>, quoteId: string): PortalQuoteDecision {
  return map.get(quoteId) ?? { ...NO_DECISION };
}

export function buildListItem(
  r: PortalQuoteListRow,
  extra: { token: string; imageUrl: string; photoCount: number; decision: PortalQuoteDecision },
): PortalQuoteListItem {
  const dest = r.destinationName && r.countryName ? `${r.destinationName}, ${r.countryName}` : r.countryName || r.destinationName || 'TBC';
  // Total includes extras not in the package; per person is the holiday price only.
  const { total, pricePerPerson } = customerPrice({ ...r, adults: r.adult, children: r.child });
  return {
    id: r.quoteId,
    token: extra.token,
    title: r.title || `${dest} Getaway`,
    destination: dest,
    hotel: r.accommodationName || '',
    operator_name: r.operatorName || null,
    price: total,
    price_per_person: parseFloat(pricePerPerson.toFixed(2)),
    travel_date: r.travelDate,
    return_date: r.numNights ? addNights(r.travelDate, r.numNights) : null,
    nights: r.numNights || null,
    board: r.boardName || null,
    adults: r.adult ?? 0,
    children: r.child ?? 0,
    infants: r.infant ?? 0,
    expiry_date: toIso(r.dateExpiry),
    sent_at: toIso(r.sentAt),
    image_url: extra.imageUrl,
    photo_count: extra.photoCount,
    quote_url: `/portal/quote/${extra.token}`,
    decision: extra.decision,
  };
}

/** Lead image (the primary one, else the first) and how many distinct photos each quote has. */
export function summariseImages(
  rows: Array<{ quoteId: string | null; url: string; isPrimary: boolean | null }>,
): Map<string, { url: string; count: number }> {
  const work = new Map<string, { url: string; seen: Set<string> }>();
  for (const img of rows) {
    if (!img.quoteId) continue;
    const entry = work.get(img.quoteId) ?? { url: '', seen: new Set<string>() };
    entry.seen.add(img.url);
    if (!entry.url || img.isPrimary) entry.url = img.url;
    work.set(img.quoteId, entry);
  }
  const result = new Map<string, { url: string; count: number }>();
  work.forEach((v, k) => result.set(k, { url: v.url, count: v.seen.size }));
  return result;
}

/**
 * The portal's detail of one quote. Built field by field from the public quote data (an allowlist), so
 * nothing else on that record, and nothing from the cost side, can reach a customer. The sales price,
 * discounts and service charge are folded into the customer total by `customerPrice` and then dropped.
 */
export function buildDetail(
  data: PublicQuoteData,
  access: PortalQuoteAccessRow,
  token: string,
  opts: { canDecide: boolean; canShare: boolean; decision: PortalQuoteDecision },
): PortalQuoteDetail {
  const { total, pricePerPerson } = customerPrice({ ...data, adults: data.adults, children: data.children });
  const travelDate = data.travelDate ?? null;
  return {
    id: access.quoteId,
    token,
    title: data.title,
    holidayType: data.holidayType,
    travelDate,
    returnDate: travelDate && data.numNights ? addNights(travelDate, data.numNights) : null,
    numNights: data.numNights,
    adults: data.adults,
    children: data.children,
    infants: data.infants,
    pets: data.pets,
    total,
    pricePerPerson: parseFloat(pricePerPerson.toFixed(2)),
    operatorName: access.operatorName || null,
    expiryDate: toIso(access.dateExpiry),
    sentAt: toIso(access.sentAt),
    destinationName: data.destinationName,
    countryName: data.countryName,
    resortName: data.resortName,
    transferType: data.transferType,
    flightMeals: data.flightMeals,
    preBookedSeats: data.preBookedSeats,
    tags: [...data.tags],
    flights: data.flights.map((f) => ({
      flightType: f.flightType,
      flightNumber: f.flightNumber,
      departingAirport: f.departingAirport,
      arrivalAirport: f.arrivalAirport,
      departureDateTime: toIso(f.departureDateTime),
      arrivalDateTime: toIso(f.arrivalDateTime),
      legOrder: f.legOrder,
    })),
    accommodations: data.accommodations.map((a) => ({
      name: a.name,
      boardBasis: a.boardBasis,
      roomType: a.roomType,
      checkInDateTime: toIso(a.checkInDateTime),
      resortName: a.resortName,
    })),
    transfers: data.transfers.map((t) => ({
      from: t.from,
      to: t.to,
      pickUpTime: toIso(t.pickUpTime),
      dropOffTime: toIso(t.dropOffTime),
      note: t.note,
    })),
    carHires: data.carHires.map((c) => ({
      pickupLocation: c.pickupLocation,
      dropoffLocation: c.dropoffLocation,
      pickupTime: toIso(c.pickupTime),
      dropoffTime: toIso(c.dropoffTime),
      numDays: c.numDays,
    })),
    attractionTickets: data.attractionTickets.map((t) => ({
      type: t.type,
      dateOfVisit: toIso(t.dateOfVisit),
      numberOfTickets: t.numberOfTickets,
    })),
    loungePasses: data.loungePasses.map((l) => ({
      airportName: l.airportName,
      terminal: l.terminal,
      dateOfUsage: toIso(l.dateOfUsage),
      note: l.note,
    })),
    airportParkings: data.airportParkings.map((p) => ({
      airportName: p.airportName,
      parkingType: p.parkingType,
      parkingDate: toIso(p.parkingDate),
    })),
    cruises: data.cruises.map((c) => ({
      cruiseLine: c.cruiseLine,
      ship: c.ship,
      cabinType: c.cabinType,
      cruiseName: c.cruiseName,
      cruiseDate: c.cruiseDate ?? null,
      itinerary: c.itinerary.map((i) => ({ day: i.day, description: i.description, subDescription: i.subDescription })),
    })),
    images: data.images
      .filter((i): i is typeof i & { image_url: string } => !!i.image_url)
      .map((i) => ({ id: i.id, url: i.image_url, isPrimary: !!i.isPrimary })),
    destinationGuide: data.destinationGuru
      ? { destination: data.destinationGuru.destination, country: data.destinationGuru.country, data: data.destinationGuru.data }
      : null,
    agent: { name: data.agent.name, avatar: data.agent.avatar },
    canDecide: opts.canDecide,
    canShare: opts.canShare,
    decision: opts.decision,
  };
}
