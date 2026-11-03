import type { Airport } from "@/features/airport/types";
import type { LookupCountry } from "@/features/lookups";

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

/**
 * The UK country row, found by name or ISO code rather than a hardcoded id
 * (same rule as the enquiry wizard). Undefined when lookup data is not seeded.
 */
export function findUkCountry(countries: LookupCountry[] | undefined): LookupCountry | undefined {
  return (countries ?? []).find((c) => {
    const name = norm(c.country_name);
    const code = norm(c.country_code);
    return name === "united kingdom" || name === "uk" || code === "gb" || code === "uk";
  });
}

const PINNED_AIRPORT_CODES = ["NCL"];

/** Pinned airport codes first (when present), everything else in its existing order. */
export function withPinnedAirportsFirst(airports: Airport[]): Airport[] {
  const rest = [...airports];
  const pinned: Airport[] = [];
  for (const code of PINNED_AIRPORT_CODES) {
    const idx = rest.findIndex((a) => norm(a.airport_code) === code.toLowerCase());
    if (idx !== -1) pinned.push(...rest.splice(idx, 1));
  }
  return [...pinned, ...rest];
}
