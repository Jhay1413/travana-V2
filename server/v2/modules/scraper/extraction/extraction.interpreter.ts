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
    // Lower-case the tail so SHOUTED page text ("IN PRAGUE, CZECH REPUBLIC")
    // title-cases properly, not just URL slugs. A word that is ALREADY mixed
    // case is left alone, so "easyJet" or "McCarthy" survive.
    .map((w) => {
      const body = w === w.toUpperCase() ? w.slice(1).toLowerCase() : w.slice(1);
      return w.charAt(0).toUpperCase() + body;
    })
    .join(' ');
}

// Parse common date shapes into YYYY-MM-DD: "06 Sep 2026", "Sun 06 Sep 2026",
// "06-09-2026", "2026-09-06".
function parseDate(raw: string): string {
  // Drop ordinal suffixes ("14th Aug 2026") before matching — portals write
  // dates both ways and the day-month-year pattern below expects a bare number.
  const s = raw.trim().replace(/(\d{1,2})(st|nd|rd|th)\b/gi, '$1');
  let m = /(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = /(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/.exec(s);
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()] ?? '01'}-${m[1].padStart(2, '0')}`;
  // MONTH FIRST — "Jul 02, 2027", "July 2 2027" — how US portals write a date.
  // Tried after the day-first form above, which owns "9 May 2027", so the two
  // can't compete. Without this branch a month-first date parsed to nothing,
  // the field was discarded as un-ISO, and the sailing date silently fell back
  // to a URL parameter: Carnival's "sailDate=07022027" is MMDDYYYY, read there
  // as DDMMYYYY, which dated a 2 July sailing 7 February.
  m = /([A-Za-z]{3})[A-Za-z]*\s+(\d{1,2}),?\s+(\d{4})/.exec(s);
  if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, '0')}`;
  // Compact 8-digit dates with no separators, as analytics blobs often carry
  // them (Jet2's dataLayer writes "06092026"). A plausible-looking leading year
  // is NOT enough to call it YYYYMMDD: "19092026" (19 Sep 2026) leads with
  // "1909" and would read as month 20 — which reached the DB as travel_date
  // "1909-20-26" and blew up the insert. Pick the ordering that is an actual
  // calendar date instead; only one of the two ever can be.
  m = /^(\d{8})$/.exec(s);
  if (m) {
    const d = m[1];
    const asYmd = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`; // YYYYMMDD
    const asDmy = `${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}`; // DDMMYYYY
    if (isCalendarDate(asYmd)) return asYmd;
    if (isCalendarDate(asDmy)) return asDmy;
    return s;
  }
  return s;
}

// True only for a real YYYY-MM-DD day in a plausible year — "2026-02-30" and
// "1909-20-26" both fail, so neither can be handed on as a date.
function isCalendarDate(iso: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (year < 1900 || year > 2100) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

function applyTransform(value: string, transform?: FieldTransform): string | number {
  const v = (value ?? '').trim();
  switch (transform) {
    case 'number': {
      // A value counts as a number only if it IS one — optionally wrapped in a
      // currency symbol or a trailing unit — not merely because it contains
      // digits. Stripping every non-digit turns an occupancy string like
      // "A:02 C:00 I:00" into 20000, and a composite value silently becomes a
      // plausible-looking number. Returning 0 here is deliberate: isEmpty(0) is
      // true, so the rule falls through to its regex/DOM source instead.
      const cleaned = v.replace(/,/g, '');
      const m = /^[^\d-]*(-?\d+(?:\.\d+)?)[^\d]*$/.exec(cleaned);
      return m ? Number(m[1]) : 0;
    }
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
  ctx: { title: string; text: string; url: string; apiJson?: unknown; imagesText?: string; headingsText?: string },
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
  else if (rule.from === 'headings') source = ctx.headingsText ?? '';
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
  } else if (rule.from !== 'url') {
    // No regex and no URL segment to take: there is nothing to select WITH, so
    // the whole page innerText/title would otherwise land in the field. That
    // happens whenever a jsonPath rule misses — the AI writes jsonPath-only
    // rules and the DOM fallback has no pattern — and a whole page dumped into
    // "accommodation" is far worse than an empty value.
    value = '';
  }
  const out = finalize(value, rule);
  if (isEmpty(out) && rule.fallback != null) return rule.fallback;
  return out;
}

/**
 * Applies a spec's scalar field rules ON TOP of an already-mapped quote —
 * the config-override path for CODE-based adapters (easyjet): the structured
 * mapping (flights/transfers/images) stays in code, but any scalar field can
 * be re-pointed from the supplier's stored config without a deploy, e.g.
 *   fields: { sales_price: { jsonPath: "offers[0].priceExcludingTouristTax", transform: "number" } }
 * Rules that resolve to nothing leave the mapped value untouched, and only
 * keys that exist on the quote as scalars are overridable — a rule can't
 * replace a structured array or invent new fields.
 */
export function applyScalarOverrides(
  base: ScrapedQuoteJson,
  spec: Pick<ExtractionSpec, 'constants' | 'fields'> | undefined,
  ctx: { url: string; apiJson?: unknown; title?: string; text?: string },
): ScrapedQuoteJson {
  if (!spec || (!spec.fields && !spec.constants)) return base;
  const record = base as unknown as Record<string, unknown>;
  const isOverridableKey = (key: string): boolean => {
    if (!(key in record)) return false;
    const cur = record[key];
    return cur === null || ['string', 'number', 'boolean'].includes(typeof cur);
  };
  // Keep the base field's numeric type: resolveField stringifies jsonPath hits
  // unless the rule declares transform "number", and a config author will
  // forget that more often than not.
  const coerce = (key: string, v: string | number): string | number =>
    typeof record[key] === 'number' && typeof v === 'string' ? Number(v.replace(/[^\d.-]/g, '')) || 0 : v;

  const out: Record<string, unknown> = { ...record };
  const resolveCtx = { title: ctx.title ?? '', text: ctx.text ?? '', url: ctx.url, apiJson: ctx.apiJson };
  for (const [key, value] of Object.entries(spec.constants ?? {})) {
    if (isOverridableKey(key) && value !== '' && value != null) out[key] = coerce(key, value);
  }
  for (const [key, rule] of Object.entries(spec.fields ?? {})) {
    if (!isOverridableKey(key)) continue;
    const value = resolveField(rule, resolveCtx);
    if (!isEmpty(value)) out[key] = coerce(key, value);
  }
  return out as unknown as ScrapedQuoteJson;
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
// This is the RENDERABLE base — still a working URL — so it is what gets emitted.
function imageBase(src: string): string {
  return src.split('?')[0].replace(/:[^/:]*$/, '');
}

// Size variants written into the PATH rather than the query. Suppliers split
// three ways here: a query parameter (TUI's "?w=1080"), a preset appended to the
// last segment (Scene7's ":Product-Web--2048-x-1365"), or a path segment /
// filename suffix (easyJet publishes each photo as {large, medium, small}, which
// renders as ".../large/x.jpg" or ".../x_large.jpg"). imageBase only handles the
// first two, so path-encoded variants of one photo used to survive deduping and
// the gallery came back with every picture two or three times over.
//
// Matched by VOCABULARY, never by "a segment that looks numeric" — an id path
// like /hotels/12345/ must not be mistaken for a size and merge two hotels'
// galleries into one.
const SIZE_WORDS: Record<string, number> = {
  tiny: 100, mini: 100, thumb: 150, thumbs: 150, thumbnail: 150, thumbnails: 150,
  xxs: 120, xs: 200, preview: 250, small: 400, sm: 400, s: 400,
  medium: 800, med: 800, md: 800, m: 800,
  large: 1600, lg: 1600, l: 1600, xl: 2000, xxl: 2400,
  hero: 2000, full: 2400, orig: 3000, original: 3000,
};
// Explicit dimensions in a path segment: "800x600", "w_1200", "h600", "1200w".
const SIZE_DIMS = /^(?:(\d{2,5})x\d{2,5}|[whq]_(\d{2,5})|(\d{2,5})[wh])$/i;

// The width a path token asks for, or 0 when it isn't a size token at all.
function pathSizeHint(token: string): number {
  const word = SIZE_WORDS[token.toLowerCase()];
  if (word) return word;
  const dims = SIZE_DIMS.exec(token);
  return dims ? Number(dims[1] ?? dims[2] ?? dims[3]) : 0;
}

// How wide this URL asks for the photo, from wherever the size is encoded.
// Used to keep the LARGEST variant of a photo — a page routinely renders a 232px
// thumbnail and a 1080px hero of one picture, and shipping the thumbnail to a
// quote looks broken.
function sizeHint(src: string): number {
  const fromQuery = widthHint(src);
  if (fromQuery) return fromQuery;
  let best = 0;
  for (const token of variantTokens(src)) best = Math.max(best, pathSizeHint(token));
  return best;
}

// The size tokens carried in a URL's path: whole segments ("/large/") and
// trailing filename modifiers ("x_large.jpg", "x-800x600.jpg", "x@2x.jpg").
function variantTokens(src: string): string[] {
  const tokens: string[] = [];
  let path: string[];
  try {
    path = new URL(src).pathname.split('/').filter(Boolean);
  } catch {
    return tokens;
  }
  path.forEach((seg, i) => {
    const isLast = i === path.length - 1;
    if (!isLast) {
      if (pathSizeHint(seg)) tokens.push(seg);
      return;
    }
    // Filename: read modifiers off the stem, keeping the extension out of it.
    const stem = seg.replace(/\.[a-z0-9]{2,5}$/i, '');
    for (const part of stem.split(/[-_@]/).slice(1)) {
      if (pathSizeHint(part) || /^\d(?:\.\d)?x$/i.test(part)) tokens.push(part);
    }
  });
  return tokens;
}

// The identity of the PHOTO, independent of which size variant this URL points
// at. Grouping/deduping only — never emitted, because stripping the size tokens
// usually leaves a path that 404s. The URL kept for a group is the widest
// variant that was actually seen.
function imageKey(src: string): string {
  const base = imageBase(src);
  const tokens = variantTokens(src);
  if (tokens.length === 0) return base;
  let key = base;
  for (const token of tokens) {
    key = key
      .replace(new RegExp(`/${escapeRe(token)}/`, 'i'), '/')
      .replace(new RegExp(`[-_@]${escapeRe(token)}(?=\\.[a-z0-9]{2,5}$|$)`, 'i'), '');
  }
  return key;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Image URLs carried in the operator's booking JSON. A rendered gallery is
// LAZY-LOADED — TUI ships 35 slides but only the first handful hold a real src,
// the rest being "image coming soon" placeholders until scrolled — so the <img>
// list is always a partial view. The JSON lists them outright. Collected by
// shape (an absolute URL ending in an image extension) and then passed through
// the same chrome/off-site filters as the DOM images, so logos and map tiles
// are rejected identically. SVGs are skipped: at this level they are brand
// marks and airline logos, never photography.
function imagesFromJson(apiJson: unknown): string[] {
  const found: string[] = [];
  const IMAGE_URL = /^https?:\/\/[^\s"']+\.(?:jpe?g|png|webp|avif)(?:\?|$)/i;
  const visit = (node: unknown, depth: number): void => {
    if (node == null || depth > 8 || found.length > 200) return;
    if (typeof node === 'string') {
      if (IMAGE_URL.test(node)) found.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const v of node) visit(v, depth + 1);
      return;
    }
    if (typeof node === 'object') for (const v of Object.values(node as Json)) visit(v, depth + 1);
  };
  visit(apiJson, 0);
  return found;
}

// How wide a resizer was asked to render this image, when the size rides in the
// query string. Path-encoded sizes go through pathSizeHint; sizeHint reads both.
//
// Two spellings, because portals disagree. A plain parameter ("?w=1080",
// "?wid=700") and a COMPOUND one that packs a whole instruction into a single
// value — TUI ships "?i10c=img.resize(width:470);img.crop(width:470,height:265)",
// where the width sits behind a colon inside another parameter. Matching only
// "w=" made every TUI variant of one photo score 0, so the first URL seen won
// and a 658px thumbnail shipped in place of the 1080px hero that was also on
// the page. Hence the wider prefix/separator classes.
function widthHint(src: string): number {
  const m = /[?&:,;(](?:w|wid|width)[=:](\d{2,5})\b/i.exec(src);
  return m ? Number(m[1]) : 0;
}

// Resolves a possibly-relative <img> src against the page it came from. Portals
// emit both forms in the same gallery, and a relative one must not be discarded
// just because it can't be parsed on its own.
function absolutiseImage(src: string, pageUrl: string): string {
  try {
    return new URL(src, pageUrl || undefined).href;
  } catch {
    return '';
  }
}

// Many sites serve every image through their own optimiser
// (…/_next/image?url=<real>, Cloudinary, imgix, Sitecore …). That puts the whole
// page — hotel photography AND brand/marketing tiles — on ONE host, which
// defeats grouping by host. The real origin is the wrapped URL, so unwrap it
// when a query parameter holds an absolute URL. Used for GROUPING and DEDUPING
// only: the rendered proxy URL is what gets returned, since that is the form the
// page actually loaded successfully.
const PROXY_PARAMS = ['url', 'u', 'src', 'image', 'imageUrl'];
function imageOrigin(absSrc: string): string {
  try {
    const parsed = new URL(absSrc);
    for (const key of PROXY_PARAMS) {
      const inner = parsed.searchParams.get(key);
      if (inner && /^https?:\/\//i.test(inner)) return new URL(inner).href;
    }
    return absSrc;
  } catch {
    return absSrc;
  }
}

// Selects the property gallery from every captured <img>. Images aren't in
// innerText, so they're captured separately (CapturedImage[]) and chosen here —
// by the spec's imageUrlIncludes when set, else by the dominant image-CDN host.
// Fully generic: no supplier names or filename formats are assumed.
function selectGalleryImages(
  images: { src: string; w?: number; h?: number; context?: string }[] | undefined,
  spec: ExtractionSpec,
  pageUrl: string,
): string[] {
  if (!images || images.length === 0) return [];

  // Narrow to a container FIRST, when the spec names one and the capture knows
  // where each image sat. A hotel page carries the property carousel and one
  // per room card, all from the same image host — so URL and host tests can't
  // tell a bedroom shot from the hotel gallery, and room photos were landing in
  // the quote. Applied before everything below so the chrome filters and the
  // host heuristic only ever see the right container's images.
  const container = spec.imageContainerIncludes?.toLowerCase();
  if (container) {
    // Only images captured FROM THE DOM carry a position. Ones harvested out of
    // the booking JSON have none — they never sat anywhere on the page — so a
    // rule about WHERE an image was must not be allowed to judge them.
    //
    // This matters more than it sounds: easyJet's slider is virtualised and
    // holds three <img> at a time, so the bulk of its gallery arrives via the
    // JSON. Filtering context-less images out alongside the room cards would
    // have cut that supplier from ~20 photos to 3.
    const positioned = images.filter((i) => i.context != null);
    const unpositioned = images.filter((i) => i.context == null);
    const inContainer = positioned.filter((i) => (i.context as string).toLowerCase().includes(container));
    // Only honour it when it actually matched — a spec naming a container the
    // page no longer uses (or a capture with no contexts at all) must not strip
    // the DOM's contribution to the gallery.
    if (inContainer.length) images = unpositioned.concat(inContainer);
  }
  // Third-party widgets (reviews, maps, social, surveys) are never the property
  // gallery. These are matched by HOST because a widget's own filenames are
  // arbitrary — Qualtrics' survey prompt ships "wr-dialog-close-btn-black.png",
  // which reads as neither chrome nor photography and was landing in TUI
  // galleries as a result.
  const EXCLUDE =
    /tripadvisor|tacdn|googleapis|gstatic|feefo|facebook|twitter|doubleclick|recaptcha|qualtrics|siteintercept/i;
  // Site furniture: logos, UI icons, flags, pictograms, "image coming soon"
  // placeholders and anything under a static-asset path. These outnumber the
  // real photography on some portals, so counting images per host picks the
  // chrome instead of the gallery unless they're removed first.
  const CHROME =
    /logo|sprite|placeholder|pictogram|badge|\bflag\b|coming[-_]soon|[-_]icon|\/icons?\/|\/static-images\/|\/_ui\/|\/assets\/|\/-\/media\//i;
  // Resolve relative srcs up front — a gallery routinely mixes both forms, and
  // dropping the relative half loses most of the photography.
  const cleaned = images
    .map((i) => (i.src && !i.src.startsWith('data:') ? absolutiseImage(i.src, pageUrl) : ''))
    .filter((s) => s && !EXCLUDE.test(s));
  if (cleaned.length === 0) return [];

  let pool: string[];
  // Pipe-separated alternatives, because one supplier can serve photos from
  // several hosts — TUI uses BOTH content.tui.co.uk and cdn.images.tui, and
  // naming only one of them silently discarded the gallery on any deal served
  // from the other. A plain substring with no pipe behaves exactly as before.
  const inc = (spec.imageUrlIncludes ?? '')
    .toLowerCase()
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);
  const byInclude = inc.length ? cleaned.filter((s) => inc.some((i) => s.toLowerCase().includes(i))) : [];
  if (byInclude.length) {
    pool = byInclude;
  } else {
    // Drop site chrome first, then decide. An image resizer path (/is/image/)
    // always carries real photography, so it survives the chrome filter.
    const photos = cleaned.filter((s) => !CHROME.test(s) || /\/is\/image\//i.test(s));

    // Property galleries are served from a DIFFERENT origin than the page —
    // a photo CDN or media bucket (media.jet2.com, cdn.images.tui, an S3
    // bucket behind the site's own image proxy) — while brand and UI assets
    // come from the site itself. That separation is a far better signal than
    // sheer count, which a portal's own furniture can win outright.
    const pageHost = (() => {
      try {
        return new URL(pageUrl).host;
      } catch {
        return '';
      }
    })();
    const originHost = (s: string): string => {
      try {
        return new URL(imageOrigin(s)).host;
      } catch {
        return '';
      }
    };
    const offSite = photos.filter((s) => {
      const h = originHost(s);
      return h && h !== pageHost;
    });

    if (offSite.length) {
      pool = offSite;
    } else {
      // Self-hosted gallery: fall back to the origin host with the most
      // DISTINCT photos.
      const byHost = new Map<string, Set<string>>();
      for (const s of photos) {
        const host = originHost(s);
        if (!host) continue;
        if (!byHost.has(host)) byHost.set(host, new Set());
        byHost.get(host)!.add(imageKey(imageOrigin(s)));
      }
      let bestHost = '';
      let bestCount = 0;
      for (const [host, set] of byHost) if (set.size > bestCount) [bestHost, bestCount] = [host, set.size];
      pool = bestHost ? photos.filter((s) => originHost(s) === bestHost) : [];
    }
  }

  // Dedupe by the ORIGIN photo (first-seen order preserved) so one picture
  // rendered at several sizes counts once — keeping the WIDEST variant, since
  // the same picture routinely appears as both a thumbnail and a hero, whether
  // the size is written in the query or in the path.
  const byBase = new Map<string, string>();
  const order: string[] = [];
  for (const s of pool) {
    const base = imageKey(imageOrigin(s));
    const current = byBase.get(base);
    if (current === undefined) {
      byBase.set(base, s);
      order.push(base);
    } else if (sizeHint(s) > sizeHint(current)) {
      byBase.set(base, s);
    }
  }

  const hotelImages: string[] = [];
  for (const base of order) {
    const chosen = byBase.get(base) as string;
    const rendered = imageBase(chosen);
    hotelImages.push(/\/is\/image\//i.test(rendered) ? `${rendered}?wid=1200` : chosen);
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
  // Only the stacked-itinerary format (parseFlightList) carries these.
  homeCode?: string;
  outFlightNo?: string;
  retFlightNo?: string;
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

  // The airport pair is the first content line(s) of the outbound section that
  // aren't the header or a Depart/Arrive/duration label.
  //
  // Normally ONE line — portals put both airports in a single heading separated
  // by an inline icon, and a capture of the RENDERED panel collapses that to
  // "Newcastle  Reus (Barcelona South) REU". But a panel captured while CLOSED
  // has no rendered text: innerText degrades to textContent and the deep-text
  // walker emits one line per text node, so the pair arrives split in two. Take
  // up to two lines and rejoin them with the double space the splitter below
  // keys on — but only when that actually recovers an airport code the first
  // line lacked, so a portal whose second line is something else is untouched.
  const contentLines: string[] = [];
  for (const raw of outText.split('\n')) {
    const l = raw.trim();
    if (!l || /going out|going there|outbound/i.test(l)) continue;
    if (/flight duration|depart:|arrive:/i.test(l)) break;
    contentLines.push(l);
    if (contentLines.length === 2) break;
  }
  const IATA = /\b[A-Z]{3}\b/;
  let airportLine = contentLines[0] ?? '';
  if (contentLines.length === 2 && !IATA.test(airportLine) && IATA.test(contentLines[1])) {
    airportLine = `${contentLines[0]}  ${contentLines[1]}`;
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

// Second flight convention: a STACKED ITINERARY printed in the page's own text
// rather than behind a "Depart:/Arrive:" modal. Each leg renders as one value
// per line:
//   Fri 14th Aug 2026
//   EZY2051
//   17:00            ← departs
//   23:25            ← arrives
//   Manchester
//   (MAN)
//   Rhodes, Diagoras
//   (RHO)
// Keyed on that SHAPE — a date, a flight code, two times, then two
// name/(CODE) airport pairs — not on any supplier's wording, so any portal
// laying flights out this way is read without new configuration. The first
// match is the outbound leg and the second the return.
const FLIGHT_LEG_RE = new RegExp(
  [
    String.raw`(?:^|\n)[^\S\n]*(?:[A-Za-z]{3,9},?[^\S\n]+)?`, // optional weekday
    String.raw`(\d{1,2}(?:st|nd|rd|th)?[^\S\n]+[A-Za-z]{3,9}[^\S\n]+\d{4})[^\S\n]*\n`, // date
    String.raw`[^\S\n]*([A-Z]{1,3}[^\S\n]?\d{1,4}[A-Z]?)[^\S\n]*\n`, // flight number
    String.raw`[^\S\n]*(\d{1,2}:\d{2})[^\S\n]*\n`, // depart time
    String.raw`[^\S\n]*(\d{1,2}:\d{2})[^\S\n]*\n`, // arrive time
    String.raw`[^\S\n]*([^\n()]+?)[^\S\n]*\n[^\S\n]*\(([A-Z]{3})\)[^\S\n]*\n`, // from name + code
    String.raw`[^\S\n]*([^\n()]+?)[^\S\n]*\n[^\S\n]*\(([A-Z]{3})\)`, // to name + code
  ].join(''),
  'g',
);

function parseFlightList(text: string | undefined): ParsedFlightModal | null {
  if (!text) return null;
  FLIGHT_LEG_RE.lastIndex = 0;
  const legs = [...text.matchAll(FLIGHT_LEG_RE)];
  if (legs.length === 0) return null;

  const leg = (i: number) => {
    const m = legs[i];
    if (!m) return null;
    const [, date, flightNo, dep, arr, fromName, fromCode, toName, toCode] = m;
    return {
      depart: combineDateTime(date, dep),
      // Only one date is printed per leg, so an after-midnight arrival carries
      // its departure date — that is all the page actually states.
      arrive: combineDateTime(date, arr),
      flightNo: flightNo.replace(/\s+/g, ''),
      fromName: fromName.trim(),
      fromCode,
      toName: toName.trim(),
      toCode,
    };
  };

  const out = leg(0);
  const ret = leg(1);
  if (!out) return null;

  return {
    homeName: out.fromName,
    homeCode: out.fromCode,
    destName: out.toName,
    destCode: out.toCode,
    outDepart: out.depart,
    outArrive: out.arrive,
    retDepart: ret?.depart ?? '',
    retArrive: ret?.arrive ?? '',
    outFlightNo: out.flightNo,
    retFlightNo: ret?.flightNo ?? '',
  };
}

// Third flight convention: OUT/RTN leg cards, where each leg is a labelled
// block holding a date, two times, and two airport name + bare CODE pairs:
//   OUT   Sun 30 Aug 2026
//   06:00   Direct  1h 50m   08:50
//   London Stansted  STN     Prague  PRG
//   Ryanair
// Rather than assume a fixed line order (portals reflow these cards freely),
// each block is SCANNED: first date wins, the first two times are depart/arrive,
// and the first and last airport codes are origin and destination.
const LEG_LABELS = /\b(OUT|RTN|OUTBOUND|INBOUND|RETURN|DEPARTING|RETURNING)\b/g;
// Words that look like airport codes but aren't — leg labels and common card
// furniture. Anything else in caps of exactly three letters is treated as IATA.
const NOT_A_CODE = /^(OUT|RTN|VAT|ATO|TBC|N\/A)$/;

function scanFlightBlock(block: string): {
  depart: string;
  arrive: string;
  fromName: string;
  fromCode: string;
  toName: string;
  toCode: string;
} | null {
  const date = /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\s+\d{4})/.exec(block)?.[1] ?? '';
  const times = [...block.matchAll(/\b(\d{1,2}:\d{2})\b/g)].map((m) => m[1]);
  if (!date || times.length < 2) return null;

  // Airport codes with the line they sit on, so the name can be read from the
  // same line or the one above (both layouts occur).
  const lines = block.split('\n').map((l) => l.trim());
  const codes: { code: string; name: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    for (const m of lines[i].matchAll(/\b([A-Z]{3})\b/g)) {
      if (NOT_A_CODE.test(m[1])) continue;
      const sameLine = lines[i].replace(m[1], '').trim();
      const name = sameLine || lines[i - 1] || '';
      codes.push({ code: m[1], name: name.replace(/\s{2,}/g, ' ').trim() });
    }
  }
  if (codes.length < 2) return null;

  const from = codes[0];
  const to = codes[codes.length - 1];
  return {
    depart: combineDateTime(date, times[0]),
    arrive: combineDateTime(date, times[1]),
    fromName: from.name,
    fromCode: from.code,
    toName: to.name,
    toCode: to.code,
  };
}

function parseFlightLegCards(text: string | undefined): ParsedFlightModal | null {
  if (!text) return null;
  LEG_LABELS.lastIndex = 0;
  const marks = [...text.matchAll(LEG_LABELS)];
  if (marks.length < 1) return null;

  // A leg block runs from its label to the next label (or a bounded tail).
  const blocks: string[] = [];
  for (let i = 0; i < marks.length && blocks.length < 2; i++) {
    const start = marks[i].index ?? 0;
    const end = marks[i + 1]?.index ?? Math.min(text.length, start + 600);
    blocks.push(text.slice(start, end));
  }

  const out = scanFlightBlock(blocks[0] ?? '');
  if (!out) return null;
  const ret = blocks[1] ? scanFlightBlock(blocks[1]) : null;

  return {
    homeName: out.fromName,
    homeCode: out.fromCode,
    destName: out.toName,
    destCode: out.toCode,
    outDepart: out.depart,
    outArrive: out.arrive,
    retDepart: ret?.depart ?? '',
    retArrive: ret?.arrive ?? '',
  };
}

// Fourth flight convention: INLINE PROSE legs, where a whole leg is written as
// one sentence instead of a card or a stacked list:
//   Manchester to Denpasar/Bali, Return, 2 Adults
//   Outbound: Depart MAN 17th Jun 2027, 18:40, Arrive DPS 19th Jun 2027, 00:05 | Flying with: Swiss International (LX381) - Economy class
//   Inbound: Depart DPS 28th Jun 2027, 13:20, Arrive MAN 29th Jun 2027, 08:15 | Flying with: Singapore Airlines (SQ939) - Economy class
// Keyed on the SHAPE — a "Depart …" clause followed by an "Arrive …" clause on
// the same line, each carrying an airport code, a date and a time — so any
// portal writing its itinerary as prose is read without new configuration.
// Unlike the stacked layout this one states BOTH dates, so an after-midnight
// arrival keeps its own date rather than borrowing the departure's.
const OUT_LABEL = /\b(outbound|outward|going out|going there|departing)\b/i;
const RET_LABEL = /\b(inbound|returning|return leg|return flight|coming back|coming home|homebound)\b/i;
const DEPART_WORD = /\bdepart(?:s|ing|ure)?\b/i;
const ARRIVE_WORD = /\barriv(?:e|es|ing|al)\b/i;
const DATE_IN_TEXT =
  /(\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]{3,9}\.?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/;
// "Manchester to Denpasar/Bali, Return, 2 Adults" — the header portals print
// above such an itinerary. Only read for the airport NAMES, which the leg
// sentences themselves give as codes alone.
const ROUTE_HEADER = /^([A-Za-z][A-Za-z .'/-]{2,39}?)\s+to\s+([A-Za-z][A-Za-z .'/-]{2,39}?)(?:,|$)/;

// Reads one "<code> <date>, <time>" clause. The code is the token right after
// the Depart/Arrive keyword, so carrier text further along the line can never
// be mistaken for an airport.
function scanInlineClause(clause: string): { code: string; when: string } | null {
  const date = DATE_IN_TEXT.exec(clause)?.[1] ?? '';
  if (!date) return null;
  const time = /\b(\d{1,2}:\d{2})\b/.exec(clause)?.[1] ?? '';
  const head = clause.slice(0, clause.indexOf(date));
  const code = [...head.matchAll(/\b([A-Z]{3})\b/g)].map((m) => m[1]).find((c) => !NOT_A_CODE.test(c)) ?? '';
  return { code, when: combineDateTime(date, time) };
}

function parseInlineLeg(line: string): {
  depart: string;
  arrive: string;
  fromCode: string;
  toCode: string;
  flightNo: string;
} | null {
  const d = DEPART_WORD.exec(line);
  const a = ARRIVE_WORD.exec(line);
  if (!d || !a || a.index <= d.index) return null;
  const dep = scanInlineClause(line.slice(d.index + d[0].length, a.index));
  // The arrival clause ends where the carrier note starts.
  const arr = scanInlineClause(line.slice(a.index + a[0].length).split(/\s*[|·•]\s*/)[0]);
  if (!dep) return null;
  const tail = line.includes('|') ? line.slice(line.indexOf('|')) : line.slice(a.index);
  const flightNo =
    /\(([A-Z]{1,3}\s?\d{1,4}[A-Z]?)\)/.exec(line)?.[1] ?? /\b([A-Z]{2}\s?\d{1,4}[A-Z]?)\b/.exec(tail)?.[1] ?? '';
  return {
    depart: dep.when,
    arrive: arr?.when ?? '',
    fromCode: dep.code,
    toCode: arr?.code ?? '',
    flightNo: flightNo.replace(/\s+/g, ''),
  };
}

function parseFlightInlineLegs(text: string | undefined): ParsedFlightModal | null {
  if (!text) return null;
  const lines = text.split('\n').map((l) => l.trim());
  const legs: { leg: NonNullable<ReturnType<typeof parseInlineLeg>>; isReturn: boolean; index: number }[] = [];
  lines.forEach((line, index) => {
    if (!line) return;
    const leg = parseInlineLeg(line);
    if (leg) legs.push({ leg, isReturn: RET_LABEL.test(line) && !OUT_LABEL.test(line), index });
  });
  if (legs.length === 0) return null;

  const outEntry = legs.find((l) => !l.isReturn) ?? legs[0];
  const retEntry = legs.find((l) => l !== outEntry && l.isReturn) ?? legs.find((l) => l !== outEntry);
  const out = outEntry.leg;
  const ret = retEntry?.leg;

  // Airport names off the route header directly above the outbound leg, when
  // there is one — the leg sentences name airports by code only.
  let homeName = '';
  let destName = '';
  for (let i = outEntry.index - 1; i >= 0 && i >= outEntry.index - 3; i--) {
    if (!lines[i]) continue;
    const m = ROUTE_HEADER.exec(lines[i]);
    if (m) {
      [homeName, destName] = [m[1].trim(), m[2].trim()];
      break;
    }
  }

  return {
    homeName,
    homeCode: out.fromCode,
    destName,
    destCode: out.toCode,
    outDepart: out.depart,
    outArrive: out.arrive,
    retDepart: ret?.depart ?? '',
    retArrive: ret?.arrive ?? '',
    outFlightNo: out.flightNo,
    retFlightNo: ret?.flightNo ?? '',
  };
}

// ─── Flights from the operator's own booking JSON ────────────────────────────
// Best source by a distance: operators embed the booking record as JSON in the
// page, so the legs arrive already structured — no shadow DOM, no collapsed
// panels, no prose to regex. Keyed on SHAPE, not on any supplier: find arrays
// held under an outbound/inbound-ish key whose entries carry an airport pair
// and a time, then read each leg through a list of the field names operators
// actually use. Both of TUI's own shapes (itinerary.outbounds[] with string
// airports, flightViewData[].outboundSectors[] with {code,name} objects) parse
// through the same code.
const OUTBOUND_KEY = /^(outbounds?|outboundsectors?|outboundflights?|outboundlegs?|departures?)$/i;
const INBOUND_KEY = /^(inbounds?|inboundsectors?|inboundflights?|inboundlegs?|returns?|returnsectors?)$/i;

type Json = Record<string, unknown>;

function asRecord(v: unknown): Json | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

// Reads a value by trying several key spellings, case-insensitively.
function pick(obj: Json | null, names: string[]): unknown {
  if (!obj) return undefined;
  const lower = new Map(Object.keys(obj).map((k) => [k.toLowerCase(), k]));
  for (const n of names) {
    const key = lower.get(n.toLowerCase());
    if (key !== undefined && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return undefined;
}

// An airport is written either as a string name beside a separate code field,
// or as a nested { code, name } object.
function airportFrom(leg: Json, kind: 'departure' | 'arrival'): { code: string; name: string } {
  const base = kind === 'departure' ? ['departureAirport', 'departAirport', 'origin', 'from'] : ['arrivalAirport', 'arriveAirport', 'destination', 'to'];
  const codeKeys = base.map((b) => `${b}Code`).concat(kind === 'departure' ? ['departAirportCode'] : ['arrivalAirportCode']);
  const nameKeys = base.map((b) => `${b}Name`);

  const raw = pick(leg, base);
  const nested = asRecord(raw);
  const code = String(pick(leg, codeKeys) ?? (nested ? pick(nested, ['code', 'iata']) : '') ?? '').trim();
  const name = String(
    pick(leg, nameKeys) ?? (nested ? pick(nested, ['name']) : typeof raw === 'string' ? raw : '') ?? '',
  ).trim();
  return { code: /^[A-Z]{3}$/i.test(code) ? code.toUpperCase() : '', name };
}

// "0600" / "6:00" / "06:00" → "06:00".
function normaliseTime(v: unknown): string {
  const s = String(v ?? '').trim();
  let m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
  m = /^(\d{2})(\d{2})$/.exec(s);
  if (m) return `${m[1]}:${m[2]}`;
  return '';
}

function legFromJson(leg: Json): { depart: string; arrive: string; flightNo: string; from: { code: string; name: string }; to: { code: string; name: string } } | null {
  const sched = asRecord(pick(leg, ['schedule', 'times', 'timings'])) ?? leg;
  const depDate = String(pick(sched, ['departureDate', 'departDate', 'formattedDepartureDate', 'commonDepartureDate']) ?? '');
  const arrDate = String(pick(sched, ['arrivalDate', 'formattedArrivalDate', 'commonArrivalDate']) ?? depDate);
  const depTime = normaliseTime(pick(sched, ['formattedDepartureTime', 'depTime', 'departureTime']));
  const arrTime = normaliseTime(pick(sched, ['formattedArrivalTime', 'arrTime', 'arrivalTime']));
  if (!depDate || !depTime) return null;

  const carrier = asRecord(pick(leg, ['carrier', 'airline', 'operatingCarrier']));
  const flightNo = String(pick(leg, ['flightNumber', 'flightNo']) ?? (carrier ? pick(carrier, ['flightNumber', 'flightNo']) : '') ?? '').trim();

  return {
    depart: combineDateTime(depDate, depTime),
    arrive: arrTime ? combineDateTime(arrDate, arrTime) : '',
    flightNo,
    from: airportFrom(leg, 'departure'),
    to: airportFrom(leg, 'arrival'),
  };
}

function parseFlightsFromJson(apiJson: unknown): ParsedFlightModal | null {
  if (!apiJson || typeof apiJson !== 'object') return null;
  let out: ReturnType<typeof legFromJson> = null;
  let ret: ReturnType<typeof legFromJson> = null;

  const visit = (node: unknown, depth: number): void => {
    if (!node || typeof node !== 'object' || depth > 8 || (out && ret)) return;
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1);
      return;
    }
    for (const [key, value] of Object.entries(node as Json)) {
      if (Array.isArray(value) && value.length) {
        const first = asRecord(value[0]);
        if (first) {
          if (!out && OUTBOUND_KEY.test(key)) out = legFromJson(first) ?? out;
          else if (!ret && INBOUND_KEY.test(key)) ret = legFromJson(first) ?? ret;
        }
      }
      visit(value, depth + 1);
    }
  };
  visit(apiJson, 0);

  const o = out as ReturnType<typeof legFromJson>;
  const r = ret as ReturnType<typeof legFromJson>;
  if (!o) return null;
  return {
    homeName: o.from.name,
    homeCode: o.from.code,
    destName: o.to.name,
    destCode: o.to.code,
    outDepart: o.depart,
    outArrive: o.arrive,
    retDepart: r?.depart ?? '',
    retArrive: r?.arrive ?? '',
    outFlightNo: o.flightNo,
    retFlightNo: r?.flightNo ?? '',
  };
}

// Reliable fallbacks read straight from the deal URL when the page text didn't
// yield a value — generic (any supplier), since dates and lodge codes are almost
// always in the URL even when the rendered text/regex is inconsistent.
// Outbound-date parameter names, widest vocabulary first. `from`/`to` are a
// DATE RANGE on some portals (easyJet's trade portal writes
// "?from=25-10-2026&to=01-11-2026") and a route on others ("?from=LBA") — which
// is safe to try either way, because a value is only accepted below once it has
// parsed to a real YYYY-MM-DD, and an airport code never does.
const URL_DATE_KEYS = [
  'start', 'date', 'when', 'traveldate', 'travel_date', 'checkin', 'arrival', 'depart',
  'from', 'datefrom', 'startdate', 'start_date', 'departdate', 'depart_date',
  'departuredate', 'departure_date', 'outbound', 'outbounddate', 'checkindate', 'check_in',
  // Cruise checkouts date the deal by its SAILING, never by a "checkin".
  'saildate', 'sail_date', 'sailingdate', 'sailing_date', 'embarkdate', 'embarkationdate',
  'cruisedate', 'cruise_date',
] as const;

function dateFromUrl(url: string): string {
  try {
    // Param names are matched case-INSENSITIVELY: portals spell the same key
    // every which way ("sailDate", "departDate", "CHECKIN"), and a key list can
    // never enumerate the casings.
    const params = new Map<string, string>();
    for (const [k, v] of new URL(url).searchParams) {
      if (!params.has(k.toLowerCase())) params.set(k.toLowerCase(), v);
    }
    for (const key of URL_DATE_KEYS) {
      const v = params.get(key);
      if (v) {
        const d = parseDate(v);
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
      }
    }
  } catch {
    /* not a URL */
  }
  return '';
}
function lodgeCodeFromUrl(url: string): string {
  try {
    const last = new URL(url).pathname.split('/').filter(Boolean).pop() || '';
    const m = last.match(/([a-z]{2,3}\d{3,})$/i); // e.g. "…-lp33338" → "lp33338"
    if (m) return m[1];
  } catch {
    /* not a URL */
  }
  return '';
}

// ── Supplier-agnostic fallbacks for overfitted specs ─────────────────────────
// Spec field rules are AI-generated from ONE example deal, and a bad generation
// can pin a rule to that example's literal value (a board_basis regex that just
// says "Half Board" matches nothing on a Self Catering deal). These fallbacks
// only run when the spec produced nothing, so a good spec always wins.

// The board-basis vocabulary is industry-standard — scan the page text for it
// directly. The EARLIEST match in the text wins (the deal summary renders
// before footer/filter links); on a tie the longer phrase wins so
// "All Inclusive Plus" isn't reported as "All Inclusive".
const BOARD_BASIS_VOCAB = [
  'All Inclusive Plus', 'All Inclusive', 'Half Board Plus', 'Half Board',
  'Full Board Plus', 'Full Board', 'Bed and Breakfast', 'Bed & Breakfast',
  'Self Catering', 'Self-Catering', 'Room Only',
] as const;
const BOARD_BASIS_CANONICAL: Record<string, string> = {
  'Bed & Breakfast': 'Bed and Breakfast',
  'Self-Catering': 'Self Catering',
};
function boardBasisFromText(pageText: string): string {
  let best: { index: number; term: string } | null = null;
  for (const term of BOARD_BASIS_VOCAB) {
    const index = pageText.toLowerCase().indexOf(term.toLowerCase());
    if (index === -1) continue;
    if (!best || index < best.index || (index === best.index && term.length > best.term.length)) {
      best = { index, term };
    }
  }
  return best ? (BOARD_BASIS_CANONICAL[best.term] ?? best.term) : '';
}

// Party size from the deal URL. Jet2-style room tokens ("r2c9r2c10" = a room of
// 2 adults + a child aged 9, a room of 2 adults + a child aged 10): adults are
// summed across rooms and each c-token is ONE child (its number is the AGE, not
// a count). Plain adults/children params are the generic fallback.
function occupancyFromUrl(url: string): { adults: number; children: number } | null {
  try {
    const params = new URL(url).searchParams;
    const occ = params.get('occupancy');
    if (occ && /^(?:r\d+(?:c\d+)*)+$/i.test(occ)) {
      let adults = 0;
      let children = 0;
      for (const m of occ.matchAll(/r(\d+)/gi)) adults += Number(m[1]);
      for (const _m of occ.matchAll(/c\d+/gi)) children += 1;
      if (adults > 0) return { adults, children };
    }
    const adults = Number(params.get('adults') ?? params.get('ad'));
    if (Number.isFinite(adults) && adults > 0) {
      const children = Number(params.get('children') ?? params.get('ch')) || 0;
      return { adults, children };
    }
    const rooms = occupancyFromRoomParams(params);
    if (rooms) return rooms;
  } catch {
    /* not a URL */
  }
  return null;
}

// Duration written into the page's own wording, e.g. "5-Night Hamburg &
// Rotterdam Cruise". Deliberately keyed on the SINGULAR, adjectival form
// ("5-night holiday", "7 night stay") — the plural ("2 nights") is what a
// duration PICKER prints for options the guest hasn't chosen, and reading one
// of those would report someone else's holiday length.
function nightsFromText(pageText: string): number {
  const m = /\b(\d{1,2})[-\s]night\b/i.exec(pageText);
  const n = m ? Number(m[1]) : 0;
  return n > 0 && n < 100 ? n : 0;
}

// Party size from INDEXED ROOM PARAMS — "r0a=2&r0c=0" (room 0: 2 adults, 0
// children), the shape cruise and multi-room checkouts use. Case-sensitive on
// purpose: the same URLs carry unrelated capitalised keys ("r0A=1102" is a
// price), and a value is only believed when it reads as a plausible headcount.
function occupancyFromRoomParams(params: URLSearchParams): { adults: number; children: number } | null {
  let adults = 0;
  let children = 0;
  let sawAdults = false;
  for (const [key, value] of params) {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0 || n > 20) continue;
    if (/^r\d+a$/.test(key)) {
      adults += n;
      sawAdults = true;
    } else if (/^r\d+c$/.test(key)) {
      children += n;
    }
  }
  return sawAdults && adults > 0 ? { adults, children } : null;
}

function nightsFromUrl(url: string): number {
  try {
    const params = new URL(url).searchParams;
    for (const key of ['duration', 'nights', 'los', 'no_of_nights']) {
      const v = Number(params.get(key));
      if (Number.isFinite(v) && v > 0 && v < 100) return v;
    }
  } catch {
    /* not a URL */
  }
  return 0;
}

// A date normalised to YYYY-MM-DD, or '' when the value isn't a date at all.
// parseDate hands back whatever it was given when nothing matches, which is
// fine for a best-effort field but not for one date that has to EQUAL another.
function isoDate(raw: string): string {
  if (!raw) return '';
  const d = parseDate(raw);
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : '';
}

// The calendar day of a "YYYY-MM-DDTHH:mm" stamp, or '' if there isn't one.
function dateOnly(stamp: string | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(stamp ?? '');
  return m ? m[1] : '';
}

function addNights(isoDate: string, nights: number): string {
  if (!isoDate || !nights) return isoDate;
  const d = new Date(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return isoDate;
  d.setUTCDate(d.getUTCDate() + nights);
  return d.toISOString().slice(0, 10);
}

// Spec keys that exist only for a sailing. A spec carrying any of them was
// written against a cruise page, which classifies the SUPPLIER — the spec is
// reused for every deal on that portal. Deliberately excludes the common
// fields (price, nights, operator…): those say nothing about the package type.
const CRUISE_SPEC_KEYS = [
  'cruise_line',
  'ship_name',
  'cruise_date',
  'cruise_title',
  'embarkation',
  'debarkation',
  'cabin_type',
  'cabin_number',
  'cruise_only',
] as const;

// ─── Cruise itinerary printed as a DAY / PORT table ──────────────────────────
// The day-by-day ports are the one part of a cruise page that no field rule can
// reach: it is a repeating table, not a scalar. A spec CAN declare an
// itineraryRegex, but the AI writes that from one example and it is the first
// thing to break — so the shape is also read here, supplier-neutrally:
//   Day  Port
//   1
//   Southampton, England
//   Departs at 5:00 pm
//   2
//   Cruising
//   Day at Sea
// A row is a line holding ONLY a day number (or "Day 3"), then the port on the
// next line and any detail line after it. Rows must run 1, 2, 3… without a gap,
// which is what keeps a page of prices or a numbered FAQ from parsing as an
// itinerary.
// A day cell, which is a NUMBER OR A RANGE: an overnight port call is printed
// as one row spanning two days ("8 - 9", "Days 8-9"). Stripping the non-digits
// out of that — which both readers below used to do — turned day 8-9 into day
// 89, and the run of days then broke at the range, truncating the itinerary.
const ITINERARY_DAY_LINE = /^(?:days?\s*)?(\d{1,2})(?:\s*[-–—]\s*(\d{1,2})?)?[\s.:)\t]*$/i;
// How many days one row may span. An overnight port call spans two, but a row
// is also how a line prints an unbroken block of SEA DAYS, and an ocean
// crossing is long: Cunard writes a transatlantic as "Day 7-13". A cap of 3
// silently collapsed that to day 7 alone — and because the days after it then
// no longer followed on, the rest of the itinerary was dropped too, ending a
// 28-day voyage at day 7. Still bounded, so a stray "1-99" cannot fabricate a
// hundred rows.
const MAX_DAY_RANGE = 21;
// The same shape read out of a longer string, for spec-supplied day values
// ("Day 8-9", "8 – 9").
function parseDayRange(raw: string): { start: number; end: number } | null {
  const m = /(\d{1,2})(?:\s*[-–—]\s*(\d{1,2}))?/.exec(raw);
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] ? Number(m[2]) : start;
  // A range runs forwards and stays short; anything else is read as one day.
  return { start, end: end > start && end - start <= MAX_DAY_RANGE ? end : start };
}

// One row per day the cell covers, so an overnight port appears on both of its
// days instead of leaving a hole in the list.
function daysInRange(range: { start: number; end: number }): number[] {
  const days: number[] = [];
  for (let d = range.start; d <= range.end; d++) days.push(d);
  return days;
}

function parseItineraryTable(pageText: string): { day: number; description: string; sub_description?: string }[] {
  const lines = pageText.split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
  // Every line that is just a day number (or a day range), with what it claims.
  const marks: { index: number; start: number; end: number }[] = [];
  lines.forEach((line, index) => {
    const m = ITINERARY_DAY_LINE.exec(line);
    if (!m) return;
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : start;
    marks.push({ index, start, end: end > start && end - start <= MAX_DAY_RANGE ? end : start });
  });

  const rows: { day: number; description: string; sub_description?: string }[] = [];
  let lastDay = 0;
  for (let i = 0; i < marks.length; i++) {
    // Days must run 1, 2, 3… without a gap — measured against the last day
    // COVERED, so a "8 - 9" row is followed by 10. That is what keeps a
    // numbered FAQ or a list of prices from parsing as an itinerary. A "1"
    // restarts the run, so a stray number earlier in the page can't hold it
    // hostage.
    if (marks[i].start !== lastDay + 1) {
      if (marks[i].start !== 1) continue;
      rows.length = 0;
    }
    // The row's content runs to the next day line — bounded, so the last row
    // can't swallow the rest of the page.
    const end = Math.min(marks[i + 1]?.index ?? lines.length, marks[i].index + 5);
    const content = lines
      .slice(marks[i].index + 1, end)
      .filter((l) => l && !l.startsWith('*') && l.length <= 80);
    if (!content.length) continue;
    for (const day of daysInRange(marks[i])) {
      rows.push({
        day,
        description: content[0],
        // "Departs at 5:00 pm", "Day at Sea", "From 7:00 am - 4:00 pm" — the
        // times the port line doesn't carry.
        ...(content[1] ? { sub_description: content[1] } : {}),
      });
    }
    lastDay = marks[i].end;
  }
  // Two rows is a coincidence; three consecutive days is an itinerary.
  return rows.length >= 3 ? rows : [];
}

// The value a labelled pair states, e.g. "Onboard" / "Freedom of the Seas".
// Cruise pages print their headline facts this way — label line, value line —
// and the label vocabulary is industry-standard, not supplier wording.
function labelledValue(pageText: string, label: RegExp): string {
  const lines = pageText.split('\n').map((l) => l.trim());
  for (let i = 0; i < lines.length; i++) {
    if (!label.test(lines[i])) continue;
    const value = lines.slice(i + 1).find((l) => l);
    if (value && value.length <= 80 && !label.test(value)) return value;
  }
  return '';
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
    images?: { src: string; w?: number; h?: number; context?: string }[];
    headings?: string[]; // the page's h1/h2 text, document order
    flightsText?: string; // text of a flight-details modal, if one was opened
  },
  scrapedAt: string,
): ScrapedQuoteJson {
  const text = (ctx.text || '').slice(0, 40_000);
  // Booking-JSON images first: they're the complete list, whereas the rendered
  // <img> set is whatever lazy-loading happened to have reached.
  const hotelImages = selectGalleryImages(
    [...imagesFromJson(ctx.apiJson).map((src) => ({ src })), ...(ctx.images ?? [])],
    spec,
    ctx.url,
  );
  // Image URLs, joined, so a spec field rule can read them (from: 'images') —
  // e.g. a destination code that only appears in image filenames.
  const imagesText = (ctx.images ?? []).map((i) => i.src).join('\n');
  // Headings, one per line in document order, for from: 'headings' rules. The
  // deal's headline is here; in the page body it is an unanchorable line.
  const headingsText = (ctx.headings ?? []).join('\n');
  const c = { ...ctx, text, imagesText, headingsText };

  const f: Record<string, string | number> = { ...(spec.constants ?? {}) };
  for (const [key, rule] of Object.entries(spec.fields ?? {})) {
    const value = resolveField(rule, c);
    // A rule that matched NOTHING must not wipe a constant of the same name.
    // The AI writes both — it is told to declare tour_operator/currency as
    // constants AND to try to extract every common field — so a spec routinely
    // carries a constant and a rule for one key. The rule then returned '' on
    // any page whose wording it didn't fit, blanking a value the spec author
    // had stated outright. `tour_operator` blanking this way is what left the
    // quote form's operator dropdown empty on captured imports, while the
    // file-upload path (whose JSON carries the name directly, no spec involved)
    // kept working.
    //
    // A constant is an explicit statement; an empty match is "found nothing".
    // The explicit statement wins. Rules that DO match still override, and a
    // rule with a `fallback` still applies it (resolveField returns the
    // fallback, which is not empty). Mirrors applyScalarOverrides, which has
    // always guarded this way.
    if (isEmpty(value) && f[key] !== undefined && f[key] !== '') continue;
    f[key] = value;
  }

  // Party size / duration: the URL is authoritative when the spec's text rules
  // missed (the deal URL almost always carries occupancy + duration params).
  const occupancy = occupancyFromUrl(ctx.url);
  const adults = nbr(f.adults) || occupancy?.adults || 2;
  const nights = nbr(f.no_of_nights) || nightsFromUrl(ctx.url) || nightsFromText(ctx.title) || nightsFromText(text);
  const pricePerPerson = nbr(f.price_per_person);
  const total = nbr(f.sales_price) || pricePerPerson * adults;
  const departureName = str(f.departure_airport_name);
  const departureCode = str(f.departure_airport);
  // Destination airport comes from the flight modal below, or spec field rules
  // (which may read text/url/images) — nothing supplier-specific in code.
  const arrivalName = str(f.arrival_airport_name);
  const arrivalCode = str(f.arrival_airport);
  const transferType = str(f.transfer_type) || 'None';

  // Geo hierarchy. The form resolves Country > Destination > Resort >
  // Accommodation as a chain, so a hole in the middle orphans everything below
  // it — a resort cannot be created without a destination, nor a hotel without
  // a resort. Portals legitimately publish fewer than four levels: an island
  // nation is a country with no separate destination ("IN MALDIVES"), and a
  // city break has no resort. Carry the nearest level above down into the gap
  // so the hotel still lands somewhere, rather than dropping it.
  const country = str(f.country);
  const destination = str(f.destination) || country;
  const resort = str(f.resort) || destination;

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
  // Four conventions, all supplier-neutral: a "Depart:/Arrive:" details modal
  // (Jet2-shaped), a stacked itinerary printed in the page's own text
  // (easyJet-shaped), one-sentence legs (Vista-shaped) and OUT/RTN leg cards
  // (TUI-shaped). The modal wins when present because it is unambiguous;
  // the list is searched in the modal text first, then the page body, since
  // some portals render the itinerary inline with no modal at all.
  // The operator's own booking JSON wins outright when the page carries one:
  // it is already structured, so nothing is inferred. The text layouts below
  // remain for pages that embed no such record.
  const modal =
    parseFlightsFromJson(ctx.apiJson) ??
    parseFlightModal(ctx.flightsText, departureName) ??
    parseFlightList(ctx.flightsText) ??
    parseFlightList(text) ??
    parseFlightInlineLegs(ctx.flightsText) ??
    parseFlightInlineLegs(text) ??
    parseFlightLegCards(ctx.flightsText) ??
    parseFlightLegCards(text);
  // Prefer the extracted date; fall back to the deal URL (reliable) when the
  // page text didn't yield one; last, take the date off the outbound flight.
  //
  // The flight fallback is what saves a portal whose URL names its dates
  // something dateFromUrl doesn't recognise AND whose spec rule missed: the
  // itinerary block above has already been parsed into a real departure
  // timestamp, so the date IS on the page, just not anywhere the two earlier
  // sources look. Without it travel_date imported empty — and because
  // check_in_date_time and the return leg's fallback times are derived from
  // it, an empty travel_date emptied those too.
  //
  // A CRUISE HAS ONE DATE: the sailing. cruise_date is therefore resolved first
  // and becomes the travel date, so the two can never disagree and everything
  // derived from travel_date — the return date, check_in_date_time, the flight
  // fallback times — lines up with the sailing. It is normalised on the way in:
  // a spec rule captures the page's own wording ("21 Jun 2027") unless it
  // declares transform:'date', and that reached the form as text the date field
  // could not read.
  const sailDate = isoDate(str(f.cruise_date));
  const travelDate =
    sailDate || isoDate(str(f.travel_date)) || str(f.travel_date) || dateFromUrl(ctx.url) || dateOnly(modal?.outDepart);
  const returnDate = addNights(travelDate, nights);
  const destName = modal?.destName || arrivalName;
  const destCode = modal?.destCode || arrivalCode;
  const homeName = modal?.homeName || departureName;
  const homeCode = departureCode || modal?.homeCode || '';

  // Last resort for times: SPEC FIELDS holding a bare "HH:MM". Some portals
  // never render an itinerary but do publish the departure times in their
  // analytics blob as loose values (Jet2's dataLayer keeps them in
  // dimension19/dimension20), which no itinerary parser can recognise. Naming
  // them as ordinary fields lets a spec point a jsonPath at them — config, not
  // another supplier-specific branch in here. Only used when the parsers above
  // found nothing, since a real itinerary is always better.
  const withTime = (date: string, field: string): string => {
    const t = normaliseTime(str(f[field]));
    return date && t ? `${date}T${t}` : date;
  };

  const flights: ScrapedFlightJson[] =
    homeName || destCode || destName
      ? [
          {
            flight_number: modal?.outFlightNo ?? str(f.outbound_flight_number), flight_type: 'outbound',
            departing_airport: homeCode, departing_airport_name: homeName,
            departure_date_time: modal?.outDepart || withTime(travelDate, 'outbound_depart_time'),
            arrival_airport: destCode, arrival_airport_name: destName,
            arrival_date_time: modal?.outArrive || withTime(travelDate, 'outbound_arrive_time'),
          },
          {
            flight_number: modal?.retFlightNo ?? str(f.inbound_flight_number), flight_type: 'return',
            departing_airport: destCode, departing_airport_name: destName,
            departure_date_time: modal?.retDepart || withTime(returnDate, 'inbound_depart_time'),
            arrival_airport: homeCode, arrival_airport_name: homeName,
            arrival_date_time: modal?.retArrive || withTime(returnDate, 'inbound_arrive_time'),
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
    children: nbr(f.children) || occupancy?.children || 0,
    infants: nbr(f.infants),
    sales_price: total,
    price_per_person: pricePerPerson,
    currency: str(f.currency) || 'GBP',
    discount: nbr(f.discount),
    tourist_tax_total: nbr(f.tourist_tax_total),
    promotion_code: str(f.promotion_code),
    promotion_discount: nbr(f.promotion_discount),
    country,
    destination,
    resort,
    accommodation: str(f.accommodation),
    // The portal's own headline for the deal. Falls back to the hotel name,
    // which is what most portals put in that heading anyway — so a supplier
    // whose spec has no quote_title rule still gets a titled quote instead of a
    // blank one.
    quote_title: str(f.quote_title) || str(f.accommodation),
    board_basis: str(f.board_basis) || boardBasisFromText(text),
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
  //
  // A day-by-day PORT TABLE is cruise evidence in its own right — nothing else
  // publishes one — so a page carrying one is treated as a cruise even when the
  // spec's cruise_line/ship_name rules missed. Without that the whole cruise
  // block was dropped, and with it the itinerary: the client routes a scraped
  // deal to its cruise importer on cruise_line + ship_name, and only that
  // importer maps the itinerary onto the form.
  const portTable = parseItineraryTable(text);
  // A SPEC THAT DECLARES CRUISE FIELDS is the third kind of evidence, and the
  // one that covers checkouts printing no itinerary at all (Virgin Voyages'
  // summary page states the ship, the sailing and the cabin, but never a
  // day-by-day plan). The AI is told to add cruise fields ONLY to a page that
  // is a sailing, and a spec is reused for one portal — so cruise rules in the
  // spec are that portal's author saying "this site sells cruises".
  //
  // Without this the whole cruise block hung on ONE AI-written ship_name regex:
  // when that regex broke — pinned to an example voyage's wording, say — the
  // deal silently imported as a package holiday, losing the line, the sailing
  // date, the cabin and the itinerary along with the ship.
  const specDeclaresCruise =
    !!spec.itineraryRegex ||
    CRUISE_SPEC_KEYS.some((key) => spec.fields?.[key] != null || spec.constants?.[key] != null);
  const isCruisePage = !!str(f.cruise_line) || !!str(f.ship_name) || portTable.length > 0 || specDeclaresCruise;
  // Label pairs the page prints beside the table ("On Board" / "Freedom of the
  // Seas"). Only consulted when the spec said nothing. "On Board" is TWO WORDS
  // on Royal Caribbean's own pages — their UI dictionary spells the label
  // "common.onboard": "On Board" — so the space is optional here.
  const shipName = str(f.ship_name) || (isCruisePage ? labelledValue(text, /^(on\s?board|ship|your ship|sailing on)$/i) : '');
  // The operator of a cruise line's own site IS the cruise line; an agent
  // portal reselling a cruise names the line on the page, and its spec rule
  // wins here.
  const cruiseLine = str(f.cruise_line) || (isCruisePage ? str(f.tour_operator) : '');
  // The SHIP is no longer part of the gate. A named line on a page the spec
  // calls a cruise is enough: an unnamed ship is one blank field the agent
  // fills in, whereas dropping the block loses everything the page did state.
  if (isCruisePage && cruiseLine) {
    result.cruise_line = cruiseLine;
    result.ship_name = shipName;
    result.cruise_date = travelDate; // === travel_date, by construction above
    result.cruise_title = str(f.cruise_title) || str(f.quote_title);
    result.embarkation =
      str(f.embarkation) || labelledValue(text, /^(leaving from|departing from|departure port|sails from|embarkation)$/i);
    // A cruise ends where its last day docks, which the table already states.
    result.debarkation = str(f.debarkation) || portTable[portTable.length - 1]?.description || '';
    result.cabin_type = str(f.cabin_type);
    result.cabin_number = str(f.cabin_number);
    result.cruise_only = truthy(f.cruise_only);
    result.cruise_extras = str(f.cruise_extras);

    let itinerary: { day: number; description: string; sub_description?: string }[] = [];
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
          // Ranges again: "Day 8-9" is days 8 AND 9, never day 89.
          const range = m[1] ? parseDayRange(String(m[1])) : null;
          const description = (m[2] ?? m[1] ?? '').trim();
          for (const day of range ? daysInRange(range) : [i]) itinerary.push({ day, description });
        }
      }
    }
    // The spec's own regex wins; the table scan is what saves a supplier whose
    // rule was never generated or no longer matches.
    if (!itinerary.length) itinerary = portTable;
    if (itinerary.length) result.itinerary = itinerary;
  }

  // ─── Hot Tub Break / lodge: added only when the page is a lodge ────────────
  const isLodge =
    !!str(f.lodge_type) || !!str(f.lodge_code) || !!str(f.lodge_park_name) || !!str(f.cottage_id) || truthy(f.hot_tub);
  if (isLodge) {
    // lodge_code is almost always the trailing code in the deal URL path (e.g.
    // "…-lp33338"); fall back to it so the code is saved even when the page text
    // didn't expose it — otherwise the created lodge has no code.
    const lodgeCode = str(f.lodge_code) || str(f.cottage_id) || lodgeCodeFromUrl(ctx.url);
    result.lodge_type = str(f.lodge_type);
    result.lodge_code = lodgeCode;
    result.lodge_park_name = str(f.lodge_park_name) || str(f.resort);
    result.cottage_id = str(f.cottage_id) || lodgeCode;
    result.hot_tub = truthy(f.hot_tub);
    result.pets = nbr(f.pets);
  }

  return result;
}
