// Departure-airport ordering, shared by the server (to exclude pinned airports
// from the "most used" count) and the client (to order every departure picker).
//
// Order: pinned airports (fixed order) -> the agency's most-used departure
// airports (most used first, pinned excluded, capped) -> everything else A-Z.

export interface DeparturePinned {
  /** IATA-style code as stored in airport_table.airport_code. */
  code: string;
  /** Lower-case whole-name aliases, used only when no airport has the code. */
  names: string[];
}

export const PINNED_DEPARTURE_AIRPORTS: readonly DeparturePinned[] = [
  { code: "NCL", names: ["newcastle", "newcastle international"] },
  { code: "LBA", names: ["leeds bradford", "leeds bradford international"] },
  { code: "MME", names: ["teesside", "teesside international", "durham tees valley"] },
  { code: "MAN", names: ["manchester"] },
  { code: "EDI", names: ["edinburgh"] },
  { code: "LGW", names: ["london gatwick", "gatwick"] },
  { code: "LHR", names: ["london heathrow", "heathrow"] },
  { code: "GLA", names: ["glasgow", "glasgow international"] },
];

export const PINNED_DEPARTURE_AIRPORT_CODES: readonly string[] = PINNED_DEPARTURE_AIRPORTS.map((p) => p.code);

/** How many "most used by your agency" airports to show. */
export const MOST_USED_DEPARTURE_LIMIT = 5;

export type DepartureGroup = "popular" | "mostUsed" | "all";

export const DEPARTURE_GROUP_LABELS: Record<DepartureGroup, string> = {
  popular: "Popular",
  mostUsed: "Most used by your agency",
  all: "All airports",
};

interface AirportLike {
  id: string;
  airport_name: string;
  airport_code: string | null;
}

export interface OrderedDepartureAirport<T extends AirportLike> {
  airport: T;
  group: DepartureGroup;
}

const norm = (s: string | null | undefined): string => (s ?? "").trim().toLowerCase();

function normName(s: string | null | undefined): string {
  return norm(s)
    .replace(/\(.*?\)/g, "")
    .replace(/\s+airport$/, "")
    .trim();
}

/**
 * Orders airports for a departure picker. Input order does not matter; the
 * result contains every input airport exactly once.
 */
export function orderDepartureAirports<T extends AirportLike>(
  airports: readonly T[],
  mostUsedIds: readonly string[] = [],
  limit: number = MOST_USED_DEPARTURE_LIMIT,
): OrderedDepartureAirport<T>[] {
  const used = new Set<string>();
  const result: OrderedDepartureAirport<T>[] = [];

  // Pass 1: match pinned airports by code.
  const matched = new Map<string, T>();
  for (const pin of PINNED_DEPARTURE_AIRPORTS) {
    const hit = airports.find((a) => norm(a.airport_code) === norm(pin.code));
    if (hit) {
      matched.set(pin.code, hit);
      used.add(hit.id);
    }
  }
  // Pass 2: fall back to whole-name match for pins whose code is missing.
  for (const pin of PINNED_DEPARTURE_AIRPORTS) {
    if (matched.has(pin.code)) continue;
    const hit = airports.find((a) => !used.has(a.id) && pin.names.includes(normName(a.airport_name)));
    if (hit) {
      matched.set(pin.code, hit);
      used.add(hit.id);
    }
  }
  for (const pin of PINNED_DEPARTURE_AIRPORTS) {
    const hit = matched.get(pin.code);
    if (hit) result.push({ airport: hit, group: "popular" });
  }

  // Most used by the agency, in the order given, skipping pinned and unknown ids.
  const byId = new Map(airports.map((a) => [a.id, a] as const));
  let taken = 0;
  for (const id of mostUsedIds) {
    if (taken >= limit) break;
    const a = byId.get(id);
    if (!a || used.has(a.id)) continue;
    used.add(a.id);
    result.push({ airport: a, group: "mostUsed" });
    taken += 1;
  }

  const rest = airports
    .filter((a) => !used.has(a.id))
    .sort((x, y) => x.airport_name.localeCompare(y.airport_name, "en", { sensitivity: "base" }));
  for (const a of rest) result.push({ airport: a, group: "all" });
  return result;
}
