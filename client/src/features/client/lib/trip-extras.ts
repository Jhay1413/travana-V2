import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { formatIsoDateTime, formatTimelineDate } from "@/features/quote/components/quote-types";
import { buildSortKey } from "./trip-sort";
import type { TripStop } from "./trip-types";

const LAST = "￿";

function sortByKey<T>(items: T[], getKey: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => (getKey(a) || LAST).localeCompare(getKey(b) || LAST));
}

/**
 * Section ranks inside a day. Stops use "0" (outbound) to "9" (flight extras); "-" sorts before them
 * so pre-departure extras land ahead of that day's flight, "6" puts the rest after the day's itinerary.
 */
const BEFORE_FLIGHT = "-";
const AFTER_ITINERARY = "6";
/** Arrival-day airport pick-up: after the outbound flight ("0"/"1"), before hotel check-in ("3"). */
const ARRIVAL_TRANSFER = "2";

/** Sort key for an extra from its ISO date or date-time. Empty string when it has no date (sorts to the end). */
export function extraSortKey(value: string | null | undefined, section: string): string {
  if (!value) return "";
  const [date = "", rest = ""] = value.split(/[T ]/);
  if (!date) return "";
  return buildSortKey(date, section, rest.slice(0, 5));
}

function transferSection(pickUp: string | null | undefined, dropOff: string | null | undefined): string {
  if (/airport/i.test(dropOff ?? "")) return BEFORE_FLIGHT;
  if (/airport/i.test(pickUp ?? "")) return ARRIVAL_TRANSFER;
  return AFTER_ITINERARY;
}

const join = (parts: Array<string | null | undefined>, sep: string) => parts.filter(Boolean).join(sep);

/**
 * Add-ons (merged into the itinerary by date via mergeTripItems): transfers, car hire, attraction tickets,
 * lounge passes and airport parking, each sorted by its own date like the
 * classic timeline's Extras section.
 */
export function buildTripExtras(q: QuoteDisplay): TripStop[] {
  const extras: TripStop[] = [];

  sortByKey(q.transfers, (t) => t.pickUpTime).forEach((t, i) => {
    const lines: string[] = [];
    if (t.pickUpTime) lines.push(`Pick-up ${formatIsoDateTime(t.pickUpTime)}${t.dropOffTime ? ` · Drop-off ${formatIsoDateTime(t.dropOffTime)}` : ""}`);
    if (t.note) lines.push(t.note);
    if (t.tourOperatorName) lines.push(t.tourOperatorName);
    extras.push({
      id: `extra-transfer-${i}`,
      kind: "extra-transfer",
      tone: "extra",
      icon: "transfer",
      label: "Transfer",
      title: join([t.pickUpLocation, t.dropOffLocation], " → "),
      lines,
      pills: [],
      sortKey: extraSortKey(t.pickUpTime, transferSection(t.pickUpLocation, t.dropOffLocation)),
    });
  });

  sortByKey(q.carHires, (c) => c.pickUpTime).forEach((c, i) => {
    const lines: string[] = [];
    if (c.noOfDays != null) lines.push(`${c.noOfDays} day${c.noOfDays !== 1 ? "s" : ""}`);
    if (c.tourOperatorName) lines.push(c.tourOperatorName);
    extras.push({
      id: `extra-carhire-${i}`,
      kind: "extra-carhire",
      tone: "extra",
      icon: "car",
      label: "Car hire",
      title: join([c.pickUpLocation, c.dropOffLocation], " → "),
      lines,
      pills: [],
      sortKey: extraSortKey(c.pickUpTime, AFTER_ITINERARY),
    });
  });

  sortByKey(q.attractionTickets, (t) => t.dateOfVisit).forEach((t, i) => {
    const lines: string[] = [];
    if (t.dateOfVisit) lines.push(formatTimelineDate(t.dateOfVisit));
    const n = t.numberOfTickets ?? 0;
    lines.push(`${n} ticket${n !== 1 ? "s" : ""}`);
    if (t.tourOperatorName) lines.push(t.tourOperatorName);
    extras.push({
      id: `extra-ticket-${i}`,
      kind: "extra-ticket",
      tone: "extra",
      icon: "ticket",
      label: "Attraction ticket",
      title: t.ticketType ?? "",
      lines,
      pills: [],
      sortKey: extraSortKey(t.dateOfVisit, AFTER_ITINERARY),
    });
  });

  sortByKey(q.loungePasses, (p) => p.dateOfUsage).forEach((p, i) => {
    const lines: string[] = [];
    if (p.dateOfUsage) lines.push(formatTimelineDate(p.dateOfUsage));
    if (p.note) lines.push(p.note);
    if (p.tourOperatorName) lines.push(p.tourOperatorName);
    extras.push({
      id: `extra-lounge-${i}`,
      kind: "extra-lounge",
      tone: "extra",
      icon: "coffee",
      label: "Lounge pass",
      title: join([p.airportName, p.terminal ? `Terminal ${p.terminal}` : null], " · "),
      lines,
      pills: [],
      sortKey: extraSortKey(p.dateOfUsage, BEFORE_FLIGHT),
    });
  });

  sortByKey(q.airportParkings, (p) => p.parkingDate).forEach((p, i) => {
    const lines: string[] = [];
    if (p.parkingDate) lines.push(formatTimelineDate(p.parkingDate));
    if (p.duration) lines.push(p.duration);
    if (p.tourOperatorName) lines.push(p.tourOperatorName);
    extras.push({
      id: `extra-parking-${i}`,
      kind: "extra-parking",
      tone: "extra",
      icon: "parking",
      label: "Airport parking",
      title: join([p.airportName, p.parkingType], " · "),
      lines,
      pills: [],
      sortKey: extraSortKey(p.parkingDate, BEFORE_FLIGHT),
    });
  });

  return extras;
}
