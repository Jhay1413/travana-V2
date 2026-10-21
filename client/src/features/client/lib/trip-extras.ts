import type { QuoteDisplay } from "@/features/quote/components/quote-types";
import { formatIsoDateTime, formatTimelineDate } from "@/features/quote/components/quote-types";
import type { TripStop } from "./trip-types";

const LAST = "￿";

function sortByKey<T>(items: T[], getKey: (item: T) => string | null | undefined): T[] {
  return [...items].sort((a, b) => (getKey(a) || LAST).localeCompare(getKey(b) || LAST));
}

const join = (parts: Array<string | null | undefined>, sep: string) => parts.filter(Boolean).join(sep);

/**
 * Add-ons after the main itinerary: transfers, car hire, attraction tickets,
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
      sortKey: t.pickUpTime ?? "",
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
      sortKey: c.pickUpTime ?? "",
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
      sortKey: t.dateOfVisit ?? "",
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
      sortKey: p.dateOfUsage ?? "",
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
      sortKey: p.parkingDate ?? "",
    });
  });

  return extras;
}
