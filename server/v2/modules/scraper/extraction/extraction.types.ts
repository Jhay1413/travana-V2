// ─── Declarative DOM extraction spec ─────────────────────────────────────────
//
// A supplier's "how to read the page" is stored as DATA (this spec), generated
// by AI from a captured DOM and applied by a fixed, trusted interpreter
// (extraction.interpreter.ts). No supplier code is executed — the interpreter
// only runs regexes/transforms the spec declares, so a new supplier is added by
// config alone and a compromised spec can't run arbitrary code.

export type FieldSource = 'text' | 'title' | 'url' | 'images';
export type FieldTransform = 'number' | 'date' | 'titleCase' | 'trim' | 'lower' | 'upper';

export interface FieldRule {
  from: FieldSource; // where to read: page innerText, page title, or the deep-link URL
  // API-first: if the page's captured API JSON has this value, use it. Dot/bracket
  // path e.g. "offers[0].price". If it's absent/empty, the regex below (on the
  // DOM) is used as the fallback — this is how API data and DOM data merge.
  jsonPath?: string;
  regex?: string; // applied to the source; the capture group is the value
  group?: number; // capture group index (default 1)
  urlSegment?: number; // for from:'url' — take this path segment before regex/transform
  transform?: FieldTransform;
  // Map the extracted value onto a canonical one (e.g. {"Express transfers":
  // "Shared Transfer"}). Applied after transform, before fallback.
  map?: Record<string, string>;
  fallback?: string | number; // used when nothing matches
}

export interface ExtractionSpec {
  version: number;
  // Wait until the page contains something matching this before reading (so the
  // SPA has rendered the priced quote). Matched against innerText.
  wait?: { textMatches?: string; timeoutMs?: number };
  // Fixed values merged into the result (e.g. tour_operator, currency).
  constants?: Record<string, string | number>;
  // ScraperJson field name → how to extract it. Scalar fields only; the
  // interpreter derives the structured arrays (flights/transfers/luggage).
  fields: Record<string, FieldRule>;
  // Optional: build included_luggage from every match of this pattern.
  // Group 1 (count) and group 2 (label) are combined, e.g. "(2) 22kg baggage".
  luggageRegex?: string;
  // Optional: substring/host that identifies the property gallery among the
  // captured <img> URLs (e.g. "media.jet2.com/is/image"). When omitted, the
  // interpreter auto-detects the dominant image CDN. Images can't be read from
  // innerText, so they're captured separately and selected here.
  imageUrlIncludes?: string;
  // Optional: a case-insensitive regex matching the visible text of a control
  // (button/link) that opens a "flight details / compare airports" modal holding
  // the real flight times + destination airport (e.g. "compare airport"). When
  // set, the scraper clicks it and the interpreter reads the times from the modal.
  // Supplier-specific wording lives HERE (generated into the spec), never in code.
  flightModalTrigger?: string;
  // Optional (cruise only): build the day-by-day itinerary from every match.
  // Group 1 = day (number or "Day 3"), group 2 = description/port.
  itineraryRegex?: string;
}
