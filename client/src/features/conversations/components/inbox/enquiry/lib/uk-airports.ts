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

