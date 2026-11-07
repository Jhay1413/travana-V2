import {
  DEPARTURE_GROUP_LABELS,
  orderDepartureAirports,
} from "@shared/departure-airports";
import type { Airport } from "../types";

export interface DepartureAirportOption {
  value: string;
  label: string;
  /** Heading shown above the first option of each group. */
  group: string;
}

export const airportLabel = (a: Pick<Airport, "airport_name" | "airport_code">): string =>
  `${a.airport_name}${a.airport_code ? ` (${a.airport_code})` : ""}`;

/** Departure-picker options: pinned -> agency's most used -> everything else A-Z. */
export function buildDepartureAirportOptions(
  airports: readonly Airport[],
  mostUsedIds: readonly string[] = [],
): DepartureAirportOption[] {
  return orderDepartureAirports(airports, mostUsedIds).map(({ airport, group }) => ({
    value: airport.id,
    label: airportLabel(airport),
    group: DEPARTURE_GROUP_LABELS[group],
  }));
}
