import type { Page } from 'puppeteer';
import { AppError } from '../../../utils/error-handler';
import type { ScrapedQuoteJson } from '../../easyjet/easyjet.types';
import type { PriceApiConfig } from '../scraper-engine.types';

// ─── Authed JSON price-API path (Hoseasons) ──────────────────────────────────
//
// Some lodge portals price a deal through an authed JSON endpoint keyed by an id
// that lives on the property page rather than in the deal URL. The priced
// ?params URL redirects to login, but the bare property page loads — so after
// login we open the property page, discover the id (from the page's own
// intercepted AJAX, else its HTML), fire the price AJAX with the deal's dates,
// and read the price from the returned array. No AI, no DOM scraping of prices.

// One priced option in the AJAX response array (Hoseasons SERVICE-RESULT-AJAX).
interface PriceRow {
  Date?: string; // "20 Nov - 27 Nov (Fri-Fri)"
  Duration?: string;
  Price?: string; // "£630"
  WasPrice?: string;
  BookingUrlLink?: string; // "...&acode=lp33338&start=20-11-2026&nights=7&ucode=lp33338"
  IsOnRequest?: boolean;
}

const money = (s?: string): number => {
  if (!s) return 0;
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : 0;
};

// "07-12-2026" (dd-mm-yyyy) → "2026-12-07".
const ddmmyyyyToIso = (s: string): string => {
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (!m) return s;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

// "seven-lakes-country-park-slcp" → "Seven Lakes Country Park" (drops a trailing
// short code segment like "-slcp" / "-lp33338").
const slugToName = (slug: string): string =>
  slug
    .replace(/-(?:[a-z]{2,4}\d*|lp\d+)$/i, '')
    .split('-')
    .filter(Boolean)
    .map((w) => (/^\d+$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .trim();

// Parses "…/holiday-parks/<park-slug>/<lodge-slug-with-unitcode>" into park name,
// lodge name and unit code (e.g. lp33338).
function parseDealSlugs(dealUrl: string): { park: string; lodge: string; unitCode: string } {
  let park = '';
  let lodge = '';
  let unitCode = '';
  try {
    const segs = new URL(dealUrl).pathname.split('/').filter(Boolean);
    const lodgeSlug = segs[segs.length - 1] || '';
    const parkSlug = segs[segs.length - 2] || '';
    const code = lodgeSlug.match(/(lp\d+|[a-z]{2}\d{3,})$/i);
    unitCode = code ? code[1] : '';
    lodge = slugToName(lodgeSlug);
    park = slugToName(parkSlug);
  } catch {
    /* leave blank */
  }
  return { park, lodge, unitCode };
}

// Reads the id (e.g. WebsiteID) from the property page: first the URL the page's
// own AJAX fired at, then a regex over its HTML.
async function discoverId(
  page: Page,
  apiUrl: string | null,
  cfg: PriceApiConfig,
): Promise<string | null> {
  const idParam = cfg.idParam || 'WebsiteID';
  if (apiUrl) {
    try {
      const v = new URL(apiUrl).searchParams.get(idParam);
      if (v) return v;
    } catch {
      /* fall through */
    }
  }
  const pattern = cfg.idRegex || `${idParam}["'\\s:=]+?(\\d{3,7})`;
  const html = await page.content().catch(() => '');
  const m = html.match(new RegExp(pattern, 'i'));
  return m ? m[1] : null;
}

// Builds the price-AJAX URL: prefer the intercepted call (copy its fixed params,
// e.g. AccInfo/BookingPageName/range) and override the dates/occupancy with the
// deal's; else fall back to the configured template.
function buildAjaxUrl(
  origin: string,
  apiUrl: string | null,
  id: string,
  cfg: PriceApiConfig,
  deal: URLSearchParams,
): string {
  const idParam = cfg.idParam || 'WebsiteID';
  const carry = ['start', 'nights', 'adult', 'child', 'infant', 'pets'] as const;
  if (apiUrl) {
    const u = new URL(apiUrl, origin);
    for (const k of carry) {
      const v = deal.get(k);
      if (v != null) u.searchParams.set(k, v);
    }
    u.searchParams.set(idParam, id);
    return u.toString();
  }
  if (cfg.urlTemplate) {
    const filled = cfg.urlTemplate.replace(/\{(\w+)\}/g, (_, key: string) => {
      if (key === 'websiteId' || key === 'id' || key === idParam) return id;
      return deal.get(key) ?? '0';
    });
    return /^https?:\/\//i.test(filled) ? filled : origin.replace(/\/+$/, '') + filled;
  }
  throw new AppError(
    'Price API could not build a request URL — the property page fired no AJAX to copy and no urlTemplate is configured.',
    502,
  );
}

// Picks the priced row for the deal's start date; falls back to the first row.
function matchRow(rows: PriceRow[], dealStart: string): PriceRow | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const exact = rows.find((r) => (r.BookingUrlLink || '').includes(`start=${dealStart}`));
  if (exact) return exact;
  // Date field like "07 Dec - …"; match the day+month of the deal start.
  const iso = ddmmyyyyToIso(dealStart);
  const [, mo, d] = iso.split('-');
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][Number(mo) - 1];
  const byDate = rows.find((r) => new RegExp(`^0?${Number(d)}\\s+${mon}`, 'i').test((r.Date || '').trim()));
  return byDate || rows[0];
}

export async function runPriceApi(
  page: Page,
  apiUrl: string | null,
  dealUrl: string,
  cfg: PriceApiConfig,
  supplierName: string,
): Promise<ScrapedQuoteJson> {
  const deal = (() => {
    try {
      return new URL(dealUrl).searchParams;
    } catch {
      return new URLSearchParams();
    }
  })();
  const origin = (() => {
    try {
      return new URL(dealUrl).origin;
    } catch {
      return '';
    }
  })();

  const id = await discoverId(page, apiUrl, cfg);
  if (!id) {
    throw new AppError(
      `Could not find the ${cfg.idParam || 'WebsiteID'} on the property page — the price API cannot be called. The page may not have loaded, or its id lives somewhere the discovery regex doesn't match.`,
      502,
    );
  }

  const ajaxUrl = buildAjaxUrl(origin, apiUrl, id, cfg, deal);
  console.log('[scraper] price API url=', ajaxUrl);

  // Fire from inside the page so the authed + Akamai cookies apply.
  const res = await page.evaluate(async (target: string) => {
    const r = await fetch(target, { credentials: 'include', headers: { Accept: 'application/json, */*' } });
    return { status: r.status, body: await r.text() };
  }, ajaxUrl);
  if (res.status < 200 || res.status >= 300) {
    throw new AppError(`Price API returned HTTP ${res.status}.`, 502);
  }
  let rows: PriceRow[];
  try {
    rows = JSON.parse(res.body) as PriceRow[];
  } catch {
    throw new AppError('Price API returned a non-JSON response (likely a bot/login challenge).', 502);
  }

  const dealStart = deal.get('start') || '';
  const row = matchRow(rows, dealStart);
  if (!row) {
    throw new AppError('Price API returned no availability for this property/date.', 502);
  }

  const { park, lodge, unitCode } = parseDealSlugs(dealUrl);
  const adults = Number(deal.get('adult') || 0);
  const children = Number(deal.get('child') || 0);
  const infants = Number(deal.get('infant') || 0);
  const pets = Number(deal.get('pets') || 0);
  const nights = Number(deal.get('nights') || row.Duration || 0);
  const salesPrice = money(row.Price);
  const pax = Math.max(1, adults + children);
  const currency = cfg.currency || 'GBP';

  // hot_tub: honour an explicit mention on the property page; default false so
  // the field is present (the client treats a present hot_tub as a lodge signal).
  const pageText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
  const hotTub = /hot\s*tub/i.test(pageText) || /hot\s*tub/i.test(lodge);

  return {
    source_url: dealUrl,
    scraped_at: new Date().toISOString(),
    tour_operator: supplierName || 'Supplier',
    travel_date: ddmmyyyyToIso(dealStart),
    no_of_nights: nights,
    adults,
    children,
    infants,
    sales_price: salesPrice,
    price_per_person: salesPrice ? Math.round((salesPrice / pax) * 100) / 100 : 0,
    currency,
    discount: 0,
    tourist_tax_total: 0,
    promotion_code: '',
    promotion_discount: 0,
    country: 'United Kingdom',
    destination: park,
    resort: park,
    accommodation: lodge,
    board_basis: 'Self Catering',
    room_type: '',
    check_in_date_time: '',
    transfer_type: 'None',
    hotel_description: '',
    hotel_images: [],
    room_images: [],
    flights: [],
    transfers: [],
    included_luggage: [],
    star_rating: '',
    review_score: null,
    // Lodge fields — these route the import into the Hot Tub Break section.
    lodge_type: '',
    lodge_code: unitCode,
    lodge_park_name: park,
    cottage_id: unitCode,
    hot_tub: hotTub,
    pets,
  };
}
