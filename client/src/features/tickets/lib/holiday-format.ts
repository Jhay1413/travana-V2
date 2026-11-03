/** "7 nights" / "1 night"; null when unknown. */
export function nightsLabel(nights: number | null | undefined): string | null {
  if (nights == null || nights <= 0) return null;
  return `${nights} ${nights === 1 ? "night" : "nights"}`;
}

/** "2 adults, 1 child, 1 infant"; null when nobody is counted. */
export function passengersLabel(p: { adults?: number | null; children?: number | null; infants?: number | null }): string | null {
  const parts: string[] = [];
  if (p.adults) parts.push(`${p.adults} adult${p.adults === 1 ? "" : "s"}`);
  if (p.children) parts.push(`${p.children} ${p.children === 1 ? "child" : "children"}`);
  if (p.infants) parts.push(`${p.infants} infant${p.infants === 1 ? "" : "s"}`);
  return parts.length > 0 ? parts.join(", ") : null;
}

/** "Newcastle International (NCL)" -> "Newcastle International, NCL". */
export function airportLabel(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.replace(/\s*\(([^)]+)\)\s*$/, ", $1");
}

/** Parses a money string; null when blank, invalid or not above zero. */
export function positiveAmount(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}
