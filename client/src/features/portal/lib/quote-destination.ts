/** Turns the destination guide stored with a quote into the sections the quote screen shows. */

export interface DestinationFact {
  label: string;
  value: string;
}

export interface DestinationThing {
  name: string;
  tag: string;
  line: string;
  details: string[];
}

export interface DestinationMonth {
  month: string;
  high: number;
  low: number | null;
  rainfall: number | null;
}

export type DestinationSection =
  | { id: "todo"; title: string; sub: string; things: DestinationThing[] }
  | { id: "know"; title: string; sub: string; facts: DestinationFact[]; note: string }
  | { id: "when"; title: string; sub: string; facts: DestinationFact[]; reason: string; months: DestinationMonth[] }
  | { id: "getting"; title: string; sub: string; facts: DestinationFact[]; note: string };

export interface DestinationContent {
  name: string;
  tagline: string;
  sections: DestinationSection[];
}

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function parse(data: unknown): Obj | null {
  if (typeof data === "string") {
    try {
      const parsed: unknown = JSON.parse(data);
      return isObj(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isObj(data) ? data : null;
}

function facts(source: Obj | null, rows: Array<[string, string]>): DestinationFact[] {
  if (!source) return [];
  return rows.map(([key, label]) => ({ label, value: text(source[key]) })).filter((f) => f.value);
}

/**
 * The destination content for a quote, or null when there is nothing worth showing. A section with no content
 * is left out entirely (never an empty heading).
 */
export function buildDestination(guide: { destination: string; country: string | null; data: unknown } | null): DestinationContent | null {
  if (!guide) return null;
  const data = parse(guide.data);
  if (!data) return null;

  const travel = isObj(data.travelInfo) ? data.travelInfo : null;
  const best = isObj(data.bestTimeToVisit) ? data.bestTimeToVisit : null;
  const flights = isObj(data.flightTimesFromUK) ? data.flightTimesFromUK : null;

  const sections: DestinationSection[] = [];

  const things: DestinationThing[] = list(data.mustDo)
    .filter(isObj)
    .map((t) => ({
      name: text(t.name),
      tag: text(t.category),
      line: text(t.shortDesc),
      details: [
        text(t.price) && `Price: ${text(t.price)}`,
        text(t.duration) && `Takes ${text(t.duration)}`,
        text(t.openingHours) && `Open: ${text(t.openingHours)}`,
        text(t.bestFor) && `Best for: ${text(t.bestFor)}`,
        text(t.tips) && `Tip: ${text(t.tips)}`,
        text(t.address),
      ].filter((d): d is string => !!d),
    }))
    .filter((t) => t.name);
  if (things.length > 0) sections.push({ id: "todo", title: "Things to do", sub: `${things.length} idea${things.length === 1 ? "" : "s"} for your trip`, things });

  const knowFacts = facts(travel, [
    ["currency", "Currency"],
    ["language", "Language"],
    ["timezone", "Time zone"],
    ["visaRequired", "Visa"],
    ["waterSafety", "Tap water"],
    ["plugType", "Plugs"],
  ]);
  const summary = travel ? text(travel.summary) : "";
  if (knowFacts.length > 0 || summary) sections.push({ id: "know", title: "Good to know", sub: "Time, money, water and plugs", facts: knowFacts, note: summary });

  const months: DestinationMonth[] = list(data.temperatures)
    .filter(isObj)
    .map((m) => ({ month: text(m.month), high: num(m.avgHigh) ?? NaN, low: num(m.avgLow), rainfall: num(m.rainfall) }))
    .filter((m) => m.month && Number.isFinite(m.high));
  const whenFacts = facts(best, [
    ["months", "Best months"],
    ["peakSeason", "Peak season"],
    ["budgetSeason", "Best value"],
  ]);
  const reason = best ? text(best.reason) : "";
  if (whenFacts.length > 0 || reason || months.length > 0) sections.push({ id: "when", title: "When to go", sub: "Best months and the weather", facts: whenFacts, reason, months });

  const airports = list(flights?.airports).map(text).filter(Boolean);
  const airlines = list(flights?.airlines).map(text).filter(Boolean);
  const gettingFacts = [
    ...facts(flights, [["directHours", "Flight time"]]),
    ...(airports.length ? [{ label: "UK airports", value: airports.join(", ") }] : []),
    ...(airlines.length ? [{ label: "Airlines", value: airlines.join(", ") }] : []),
  ];
  const tips = flights ? text(flights.tips) : "";
  if (gettingFacts.length > 0 || tips) sections.push({ id: "getting", title: "Getting there", sub: "Flights from the UK", facts: gettingFacts, note: tips });

  if (sections.length === 0) return null;
  return {
    name: guide.destination,
    tagline: text(data.tagline),
    sections,
  };
}
