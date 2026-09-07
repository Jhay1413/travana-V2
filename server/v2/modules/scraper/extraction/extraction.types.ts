// ─── Declarative DOM extraction spec ─────────────────────────────────────────
//
// A supplier's "how to read the page" is stored as DATA (this spec), generated
// by AI from a captured DOM and applied by a fixed, trusted interpreter
// (extraction.interpreter.ts). No supplier code is executed — the interpreter
// only runs regexes/transforms the spec declares, so a new supplier is added by
// config alone and a compromised spec can't run arbitrary code.

export type FieldSource = 'text' | 'title' | 'url' | 'images' | 'headings' | 'deepText';
export type FieldTransform = 'number' | 'date' | 'titleCase' | 'trim' | 'lower' | 'upper';

export interface FieldRule {
  // Where to read: page innerText (default), page title, the deep-link URL, the
  // captured image URLs, the page's h1/h2 headings (one per line, document
  // order — anchor a rule with ^ + a line count rather than by wording, since a
  // headline is arbitrary prose), or "deepText" — the full DOM text INCLUDING
  // collapsed/hidden nodes and open shadow roots. Prefer "text"; reach for
  // "deepText" ONLY for a value that genuinely never appears in the visible
  // text (a cruise itinerary sitting inside a collapsed drawer — see
  // extraction.interpreter.ts's itinerary fallback for the real case this
  // covers), because deepText also contains inactive tabs, other cabin grades
  // and pre-rendered alternatives that a loose rule can match by mistake.
  // Optional so a pure-API override rule can be just { jsonPath: "…" } — e.g.
  // the easyjet adapter's config overrides, where there is no captured DOM.
  from?: FieldSource;
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

  // ─── Provenance (picker-spec.ts / EXTRACTION_AUDIT.md §4 Phase 3) ──────────
  // All four below are metadata ONLY — the interpreter never reads them when
  // running a rule. They record where a rule came from, for the review UI and
  // for mergePickedIntoSpec's `replaced` reporting, without changing runtime
  // behaviour. A spec stored before these existed simply has them undefined,
  // which is indistinguishable from 'generated' — exactly the backwards
  // compatibility this needs.
  origin?: 'picked' | 'generated'; // 'picked' = a human clicked the element and it verified; 'generated' = the AI wrote it from one example page
  verifiedValue?: string; // the exact value the agent's click reproduced at pick time (deriveSpecFromPicks only stores a rule that verifies against it)
  strategy?: string; // which derivation strategy produced this rule (see DerivationStrategy in picker-spec.ts) — 'url-param' | 'label-anchored' | 'heading-position' | 'title-prefix' | 'line-offset'
  pickedAt?: string; // ISO timestamp of when the pick was made
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
  // Images can't be read from innerText, so they're captured separately and
  // selected here.
  //
  // Optional: substring(s) identifying the property gallery among the captured
  // <img> URLs. Pipe-separate alternatives when a supplier serves photos from
  // more than one host ("content.tui.co.uk|cdn.images.tui"); naming only one of
  // them selects that host's stragglers and DISCARDS the real gallery, which is
  // worse than not setting it at all. Omit it entirely and the interpreter
  // auto-detects the dominant image CDN, which handles most portals.
  imageUrlIncludes?: string;
  // Optional: keep only images sitting inside a container whose class names or
  // data-tid contain this (case-insensitive), e.g. "hotel-main-view".
  //
  // A hotel page shows the property carousel AND one carousel per room card,
  // all served from the same image host — so neither imageUrlIncludes nor the
  // host heuristic can separate them; only DOM position can. The capture sends
  // each image's surrounding class/data-tid names and this filters on them.
  // Ignored when the capture carries no such context (pre-v9 bookmarklet).
  imageContainerIncludes?: string;
  // Optional: a case-insensitive regex matching the visible text of a control
  // (button/link) that opens a "flight details / compare airports" modal holding
  // the real flight times + destination airport (e.g. "compare airport"). When
  // set, the scraper clicks it and the interpreter reads the times from the modal.
  // Supplier-specific wording lives HERE (generated into the spec), never in code.
  flightModalTrigger?: string;
  // Optional (cruise only): build the day-by-day itinerary from every match.
  // Group 1 = day (number or "Day 3"), group 2 = description/port.
  itineraryRegex?: string;
  // Optional: the ONE package type an agent (or the AI generator) DECLARED this
  // supplier's pages to be, rather than leaving it to be inferred from which
  // fields happened to resolve. Virgin Voyages' ship_name regex was pinned to
  // one voyage's wording and matched nothing — under pure inference that made
  // the page look like a package holiday and dropped the entire cruise block
  // (line, sailing date, cabin, itinerary) along with the ship. When this is
  // set it is AUTHORITATIVE: 'cruise'/'lodge' emit that block even if a field
  // inside it resolved empty, and 'package-holiday' suppresses both. Unset
  // (the case for every spec stored before this field existed) falls back to
  // the pre-existing field-based inference, unchanged.
  packageType?: 'cruise' | 'package-holiday' | 'lodge';
}
