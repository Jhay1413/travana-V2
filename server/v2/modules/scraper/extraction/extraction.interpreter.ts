import type { ScrapedQuoteJson, ScrapedFlightJson, ScrapedTransferJson } from '../../easyjet/easyjet.types';
import type { ExtractionSpec, FieldRule, FieldTransform } from './extraction.types';

// Fixed, trusted interpreter: applies a declarative ExtractionSpec to a captured
// DOM ({title, text, url}) and produces the ScraperJson the quote-form import
// consumes. Only runs the regexes/transforms the spec declares — no code eval.

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function titleCaseSlug(s: string): string {
  return s
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Parse common date shapes into YYYY-MM-DD: "06 Sep 2026", "Sun 06 Sep 2026",
// "06-09-2026", "2026-09-06".
function parseDate(raw: string): string {
  const s = raw.trim();
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(s);
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()] ?? '01'}-${m[1].padStart(2, '0')}`;
  return s;
}

function applyTransform(value: string, transform?: FieldTransform): string | number {
  const v = (value ?? '').trim();
  switch (transform) {
    case 'number':
      return Number(v.replace(/[^\d.]/g, '')) || 0;
    case 'date':
      return parseDate(v);
    case 'titleCase':
      return titleCaseSlug(v);
    case 'lower':
      return v.toLowerCase();
    case 'upper':
      return v.toUpperCase();
    case 'trim':
    default:
      return v;
  }
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern, 'i');
  } catch {
    return null;
  }
}

// Reads a dot/bracket path from a parsed JSON object, e.g. "offers[0].price".
function getByPath(obj: unknown, path: string): unknown {
  const parts = path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean);
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function finalize(raw: string, rule: FieldRule): string | number {
  let out = applyTransform(raw, rule.transform);
  if (rule.map && typeof out === 'string' && out in rule.map) out = rule.map[out];
  return out;
}

function isEmpty(v: string | number): boolean {
  return v === '' || v === 0;
}

function resolveField(
  rule: FieldRule,
  ctx: { title: string; text: string; url: string; apiJson?: unknown; imagesText?: string },
): string | number {
  // 1. API first: if the captured API JSON has this value, use it.
  if (rule.jsonPath && ctx.apiJson != null) {
    const v = getByPath(ctx.apiJson, rule.jsonPath);
    if (v != null && v !== '') {
      const out = finalize(String(v), rule);
      if (!isEmpty(out)) return out;
    }
  }

  // 2. DOM/text/title/url/images fallback (fills gaps the API didn't cover).
  let source: string;
  if (rule.from === 'title') source = ctx.title;
  else if (rule.from === 'images') source = ctx.imagesText ?? '';
  else if (rule.from === 'url') {
    if (rule.urlSegment != null) {
      let segs: string[] = [];
      try {
        segs = new URL(ctx.url).pathname.split('/').filter(Boolean);
      } catch {
        segs = [];
      }
      source = segs[rule.urlSegment] ?? '';
    } else source = ctx.url;
  } else source = ctx.text;

  let value = source;
  if (rule.regex) {
    const re = safeRegex(rule.regex);
    const m = re ? re.exec(source) : null;
    value = m ? (m[rule.group ?? 1] ?? '') : '';
  }
  const out = finalize(value, rule);
  if (isEmpty(out) && rule.fallback != null) return rule.fallback;
  return out;
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function nbr(v: unknown): number {
  return typeof v === 'number' ? v : Number(v) || 0;
}
// Truthy for scraped flags (hot_tub, cruise_only): a non-empty value that isn't
// an explicit negative reads as true.
function truthy(v: unknown): boolean {
  if (typeof v === 'number') return v > 0;
  const s = (typeof v === 'string' ? v : '').trim().toLowerCase();
  return s !== '' && s !== 'no' && s !== 'false' && s !== '0' && s !== 'none';
}

// Strips the size/variant modifiers so the same photo at different sizes dedupes
// to one URL: drops the query string and a trailing ":variant" on the last path
// segment (e.g. ".../REU_..._05:Product-Web--2048-x-1365?w=223" → ".../..._05").
function imageBase(src: string): string {
  return src.split('?')[0].replace(/:[^/:]*$/, '');
}

// Selects the property gallery from every captured <img>. Images aren't in
// innerText, so they're captured separately (CapturedImage[]) and chosen here —
// by the spec's imageUrlIncludes when set, else by the dominant image-CDN host.
// Fully generic: no supplier names or filename formats are assumed.
function selectGalleryImages(
  images: { src: string; w?: number; h?: number }[] | undefined,
  spec: ExtractionSpec,
): string[] {
  if (!images || images.length === 0) return [];
  // Third-party widgets (reviews, maps, social) are never the property gallery.
  const EXCLUDE = /tripadvisor|tacdn|googleapis|gstatic|feefo|facebook|twitter|doubleclick|recaptcha/i;
  const cleaned = images.map((i) => i.src).filter((s) => s && !s.startsWith('data:') && !EXCLUDE.test(s));
  if (cleaned.length === 0) return [];

  let pool: string[];
  const inc = spec.imageUrlIncludes?.toLowerCase();
  const byInclude = inc ? cleaned.filter((s) => s.toLowerCase().includes(inc)) : [];
  if (byInclude.length) {
    pool = byInclude;
  } else {
    // Auto-detect: the gallery is the host with the most DISTINCT photos, after
    // dropping site chrome (logos/icons/promos under a CMS "/-/media/" path that
    // aren't served by an image resizer).
    const byHost = new Map<string, Set<string>>();
    for (const s of cleaned) {
      if (/logo|sprite|placeholder|\/-\/media\//i.test(s) && !/\/is\/image\//i.test(s)) continue;
      let host = '';
      try {
        host = new URL(s).host;
      } catch {
        continue;
      }
      if (!byHost.has(host)) byHost.set(host, new Set());
      byHost.get(host)!.add(imageBase(s));
    }
    let bestHost = '';
    let bestCount = 0;
    for (const [host, set] of byHost) if (set.size > bestCount) [bestHost, bestCount] = [host, set.size];
    pool = bestHost
      ? cleaned.filter((s) => {
          try {
            return new URL(s).host === bestHost;
          } catch {
            return false;
          }
        })
      : [];
  }

  // Dedupe by base image (order preserved), request a sensible size from resizers.
  const seen = new Set<string>();
  const hotelImages: string[] = [];
  for (const s of pool) {
    const base = imageBase(s);
    if (seen.has(base)) continue;
    seen.add(base);
    hotelImages.push(/\/is\/image\//i.test(base) ? `${base}?wid=1200` : base);
    if (hotelImages.length >= 25) break;
  }
  return hotelImages;
}

// Parses a flight-details modal (opened via spec.flightModalTrigger) into both
// legs, with real depart/arrive date-times and the destination airport. Generic:
// it keys off "Going Out"/"Coming Back" + "Depart:/Arrive: <date> at HH:MM". A
// block looks like:
//   Going Out
//   Newcastle  Reus (Barcelona South) REU
//   Depart: Sun 06 Sep 2026 at 16:30
//   Arrive: Sun 06 Sep 2026 at 20:15
//   Coming Back
//   …
interface ParsedFlightModal {
  destName: string;
  destCode: string;
  homeName: string;
  outDepart: string; // "YYYY-MM-DDTHH:mm"
  outArrive: string;
  retDepart: string;
  retArrive: string;
}
function combineDateTime(datePart: string, time: string): string {
  const iso = parseDate(datePart);
  return time ? `${iso}T${time.padStart(5, '0')}` : iso;
}
function parseFlightModal(text: string | undefined, homeNameHint: string): ParsedFlightModal | null {
  if (!text || !/Depart:/i.test(text)) return null;
  const outStart = text.search(/going out|going there|outbound/i);
  const backStart = text.search(/coming back|coming home|return flight|inbound/i);
  if (outStart < 0 || backStart < 0 || backStart <= outStart) return null;
  const outText = text.slice(outStart, backStart);
  const retText = text.slice(backStart);

  const legTime = (block: string, label: 'Depart' | 'Arrive'): string => {
    const m = new RegExp(`${label}:\\s*(.+?)\\s+at\\s+(\\d{1,2}:\\d{2})`, 'i').exec(block);
    return m ? combineDateTime(m[1], m[2]) : '';
  };
  const outDepart = legTime(outText, 'Depart');
  const outArrive = legTime(outText, 'Arrive');
  const retDepart = legTime(retText, 'Depart');
  const retArrive = legTime(retText, 'Arrive');
  if (!outDepart && !retDepart) return null;

  // The airport line is the first content line of the outbound section that isn't
  // the header or a Depart/Arrive/duration label.
  let airportLine = '';
  for (const raw of outText.split('\n')) {
    const l = raw.trim();
    if (!l || /going out|going there|outbound/i.test(l)) continue;
    if (/flight duration|depart:|arrive:/i.test(l)) break;
    airportLine = l;
    break;
  }
  let destName = '';
  let destCode = '';
  let homeName = homeNameHint;
  if (airportLine) {
    const codes = airportLine.match(/\b[A-Z]{3}\b/g);
    destCode = codes ? codes[codes.length - 1] : '';
    const noCode = destCode ? airportLine.replace(new RegExp(`\\s*${destCode}\\s*$`), '').trim() : airportLine;
    const parts = noCode.split(/\s{2,}|\s*[→>→]\s*/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      [homeName, destName] = [homeName || parts[0], parts[1]];
    } else if (homeNameHint && noCode.includes(homeNameHint)) {
      destName = noCode.replace(homeNameHint, '').trim();
    } else {
      destName = noCode;
    }
  }
  return { destName, destCode, homeName, outDepart, outArrive, retDepart, retArrive };
}

function addNights(isoDate: string, nights: number): string {
  if (!isoDate || !nights) return isoDate;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + nights);
  return d.toISOString().slice(0, 10);
}

/**
 * Runs a declarative extraction spec against a captured DOM and returns a
 * fully-formed ScraperJson (scalar fields from the spec; structured arrays —
 * flights, transfers, luggage — derived by fixed convention).
 */
export function runExtractionSpec(
  spec: ExtractionSpec,
  ctx: {
    title: string;
    text: string;
    url: string;
    apiJson?: unknown;
    images?: { src: string; w?: number; h?: number }[];
    flightsText?: string; // text of a flight-details modal, if one was opened
  },
  scrapedAt: string,
): ScrapedQuoteJson {
  const text = (ctx.text || '').slice(0, 40_000);
  const hotelImages = selectGalleryImages(ctx.images, spec);
  // Image URLs, joined, so a spec field rule can read them (from: 'images') —
  // e.g. a destination code that only appears in image filenames.
  const imagesText = (ctx.images ?? []).map((i) => i.src).join('\n');
  const c = { ...ctx, text, imagesText };

  const f: Record<string, string | number> = { ...(spec.constants ?? {}) };
  for (const [key, rule] of Object.entries(spec.fields ?? {})) {
    f[key] = resolveField(rule, c);
  }

  const adults = nbr(f.adults) || 2;
  const nights = nbr(f.no_of_nights);
  const travelDate = str(f.travel_date);
  const pricePerPerson = nbr(f.price_per_person);
  const total = nbr(f.sales_price) || pricePerPerson * adults;
  const departureName = str(f.departure_airport_name);
  const departureCode = str(f.departure_airport);
  // Destination airport comes from the flight modal below, or spec field rules
  // (which may read text/url/images) — nothing supplier-specific in code.
  const arrivalName = str(f.arrival_airport_name);
  const arrivalCode = str(f.arrival_airport);
  const transferType = str(f.transfer_type) || 'None';

  // Luggage from a repeated pattern, e.g. "(2) 22kg baggage".
  const luggage: string[] = [];
  if (spec.luggageRegex) {
    const re = (() => {
      try {
        return new RegExp(spec.luggageRegex, 'gi');
      } catch {
        return null;
      }
    })();
    if (re) {
      for (const m of text.matchAll(re)) {
        const label = m[2] ? `${m[1]} × ${m[2]}` : m[1] ?? m[0];
        if (!luggage.includes(label)) luggage.push(label); // pages repeat the panel — dedupe
      }
    }
  }

  const transfers: ScrapedTransferJson[] =
    transferType !== 'None'
      ? [{ tour_operator: str(f.tour_operator) || 'Supplier', note: transferType, cost: 0, is_included_in_package: true }]
      : [];

  // Prefer a flight-details modal (real times + destination name/code) when one
  // was captured; otherwise fall back to home name (page) + destination code
  // (image) with date-only times.
  const modal = parseFlightModal(ctx.flightsText, departureName);
  const returnDate = addNights(travelDate, nights);
  const destName = modal?.destName || arrivalName;
  const destCode = modal?.destCode || arrivalCode;
  const homeName = modal?.homeName || departureName;
  const flights: ScrapedFlightJson[] =
    homeName || destCode || destName
      ? [
          {
            flight_number: '', flight_type: 'outbound',
            departing_airport: departureCode, departing_airport_name: homeName,
            departure_date_time: modal?.outDepart || travelDate,
            arrival_airport: destCode, arrival_airport_name: destName,
            arrival_date_time: modal?.outArrive || travelDate,
          },
          {
            flight_number: '', flight_type: 'return',
            departing_airport: destCode, departing_airport_name: destName,
            departure_date_time: modal?.retDepart || returnDate,
            arrival_airport: departureCode, arrival_airport_name: homeName,
            arrival_date_time: modal?.retArrive || returnDate,
          },
        ]
      : [];

  const result: ScrapedQuoteJson = {
    source_url: ctx.url,
    scraped_at: scrapedAt,
    tour_operator: str(f.tour_operator),
    travel_date: travelDate,
    no_of_nights: nights,
    adults,
    children: nbr(f.children),
    infants: nbr(f.infants),
    sales_price: total,
    price_per_person: pricePerPerson,
    currency: str(f.currency) || 'GBP',
    discount: nbr(f.discount),
    tourist_tax_total: nbr(f.tourist_tax_total),
    promotion_code: str(f.promotion_code),
    promotion_discount: nbr(f.promotion_discount),
    country: str(f.country),
    destination: str(f.destination),
    resort: str(f.resort),
    accommodation: str(f.accommodation),
    board_basis: str(f.board_basis),
    room_type: str(f.room_type),
    check_in_date_time: travelDate,
    transfer_type: transferType,
    hotel_description: str(f.hotel_description),
    hotel_images: hotelImages,
    room_images: [],
    flights,
    transfers,
    included_luggage: luggage,
    star_rating: str(f.star_rating),
    review_score: f.review_score != null && f.review_score !== '' ? nbr(f.review_score) : null,
  };

  // ─── Cruise Package: added only when the page is a cruise ──────────────────
  // (client detects a cruise from cruise_line + ship_name).
  if (str(f.cruise_line) && str(f.ship_name)) {
    result.cruise_line = str(f.cruise_line);
    result.ship_name = str(f.ship_name);
    result.cruise_date = str(f.cruise_date) || travelDate;
    result.cruise_title = str(f.cruise_title);
    result.embarkation = str(f.embarkation);
    result.debarkation = str(f.debarkation);
    result.cabin_type = str(f.cabin_type);
    result.cabin_number = str(f.cabin_number);
    result.cruise_only = truthy(f.cruise_only);
    result.cruise_extras = str(f.cruise_extras);

    const itinerary: { day: number; description: string }[] = [];
    if (spec.itineraryRegex) {
      const re = (() => {
        try {
          return new RegExp(spec.itineraryRegex, 'gi');
        } catch {
          return null;
        }
      })();
      if (re) {
        let i = 0;
        for (const m of text.matchAll(re)) {
          i += 1;
          const dayNum = m[1] ? parseInt(String(m[1]).replace(/\D/g, ''), 10) || i : i;
          itinerary.push({ day: dayNum, description: (m[2] ?? m[1] ?? '').trim() });
        }
      }
    }
    if (itinerary.length) result.itinerary = itinerary;
  }

  // ─── Hot Tub Break / lodge: added only when the page is a lodge ────────────
  const isLodge =
    !!str(f.lodge_type) || !!str(f.lodge_code) || !!str(f.lodge_park_name) || !!str(f.cottage_id) || truthy(f.hot_tub);
  if (isLodge) {
    result.lodge_type = str(f.lodge_type);
    result.lodge_code = str(f.lodge_code);
    result.lodge_park_name = str(f.lodge_park_name) || str(f.resort);
    result.cottage_id = str(f.cottage_id);
    result.hot_tub = truthy(f.hot_tub);
    result.pets = nbr(f.pets);
  }

  return result;
}
