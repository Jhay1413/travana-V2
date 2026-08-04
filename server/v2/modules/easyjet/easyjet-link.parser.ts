import { AppError } from '../../utils/error-handler';
import type { EasyJetLinkParams } from './easyjet.types';

const TRADE_PORTAL_HOSTS = ['www.easyjet.com', 'easyjet.com'];

// Deep links carry dates as DD-MM-YYYY; the offers API wants YYYY-MM-DD.
function toIsoDate(ddmmyyyy: string, paramName: string): string {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(ddmmyyyy);
  if (!match) throw new AppError(`Invalid ${paramName} date in easyJet link: "${ddmmyyyy}"`, 400);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function nightsBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`);
  const to = Date.parse(`${toIso}T00:00:00Z`);
  const nights = Math.round((to - from) / 86_400_000);
  if (!Number.isFinite(nights) || nights <= 0) {
    throw new AppError('easyJet link has an invalid date range', 400);
  }
  return nights;
}

// Pulls a room code (e.g. "DB02") out of whichever param carries it. A room
// code can contain dots, spaces and "!" (e.g. "TWN.ST!NOR.OPQ BAR RO"), so
// it can't be matched by a plain alphanumeric pattern.
function extractRoomCode(q: URLSearchParams): string {
  // offerRooms is authoritative: "paxCount/roomCode" per room, rooms
  // comma-separated. Take everything after the first "/" of the first room
  // spec — the code itself never contains a "/", but may contain other punctuation.
  const offerRooms = q.get('offerRooms');
  if (offerRooms && offerRooms.trim()) {
    const firstRoom = offerRooms.split(',')[0].trim();
    const slash = firstRoom.indexOf('/');
    const code = (slash >= 0 ? firstRoom.slice(slash + 1) : firstRoom).trim();
    if (code) return code;
  }
  // Other link variants carry a bare code under one of these params.
  for (const name of ['room[0].roomCode', 'roomCode', 'roomcode', 'room']) {
    const v = (q.get(name) || '').trim();
    if (v) return v;
  }
  return '';
}

/**
 * Parses a trade-portal deep link, e.g.
 *   https://www.easyjet.com/en/holidays/trade-portal/greece/rhodes/faliraki/venezia-resort-hotel?to=21-08-2026&from=14-08-2026&...
 * into the parameter set the hotel/offers API expects.
 *
 * Occupancy (adults/children/infants) is not reliably encoded in the link, so
 * callers pass it explicitly (the quote form knows the party); defaults 2/0/0.
 */
export function parseEasyJetDeepLink(
  url: string,
  occupancy?: { adults?: number; children?: number; infants?: number },
): EasyJetLinkParams {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new AppError('Invalid URL', 400);
  }

  if (!TRADE_PORTAL_HOSTS.includes(parsed.hostname) || !parsed.pathname.includes('/holidays/')) {
    throw new AppError('URL is not an easyJet holidays trade-portal link', 400);
  }

  const q = parsed.searchParams;

  // A complete deep link carries the package/flight/hotel IDs after `geog`.
  // When copied from a linkified source (chat/email), auto-linkifiers cut the
  // URL at the first `|` in geog=ES|GR|TR, dropping all of them. Detect that
  // up front and give a targeted message rather than a confusing per-field one.
  const CORE_IDS = ['org', 'accId', 'outId', 'inId', 'packId', 'boardType'];
  const missingCore = CORE_IDS.filter((name) => !(q.get(name) || '').trim());
  if (missingCore.length === CORE_IDS.length) {
    throw new AppError(
      'This easyJet link looks truncated — everything after "geog=" is missing. ' +
        'Copy the full URL from the browser address bar (a link copied from a chat/email often gets cut at the "|" character).',
      400,
    );
  }

  const required = (name: string): string => {
    const value = (q.get(name) || '').trim();
    if (!value) throw new AppError(`easyJet link is missing the "${name}" parameter`, 400);
    return value;
  };

  const startDate = toIsoDate(required('from'), 'from');
  const endDate = toIsoDate(required('to'), 'to');

  // Room code (e.g. "DB02" or "TWN.ST!NOR.OPQ BAR RO"). Best-effort only: the
  // scraper navigates to this exact deep link and intercepts the page's own
  // offers response, so the room code is used solely to rebuild the fallback
  // API URL. A link variant we can't parse it from must not block the scrape.
  const roomCode = extractRoomCode(q);

  return {
    startDate,
    duration: nightsBetween(startDate, endDate),
    flexibleDays: Number(q.get('flex')) || 0,
    departure: required('org'),
    adults: occupancy?.adults ?? 2,
    children: occupancy?.children ?? 0,
    infants: occupancy?.infants ?? 0,
    roomCode,
    accommodationId: required('accId'),
    outboundRouteId: required('outId'),
    inboundRouteId: required('inId'),
    packageId: required('packId'),
    boardType: required('boardType'),
    transfer: (q.get('transfer') || '').trim(),
    geography: (q.get('geog') || '').trim(),
    isExt: q.get('isExt') === '1',
    lateRoomCheckout: q.get('lateRoomCheckout') === '1',
  };
}

/** Builds the internal offers-API URL the trade portal itself calls. */
export function buildOffersApiUrl(params: EasyJetLinkParams): string {
  const query = new URLSearchParams({
    startDate: params.startDate,
    flexibleDays: String(params.flexibleDays),
    duration: String(params.duration),
    departure: params.departure,
    'room[0].adults': String(params.adults),
    'room[0].children': String(params.children),
    'room[0].infants': String(params.infants),
    'room[0].roomCode': params.roomCode,
    accommodationId: params.accommodationId,
    outboundRouteId: params.outboundRouteId,
    inboundRouteId: params.inboundRouteId,
    packageId: params.packageId,
    boardType: params.boardType,
    transfer: params.transfer,
    geography: params.geography,
    isExt: String(params.isExt),
    lateRoomCheckout: String(params.lateRoomCheckout),
    searchPrice: '0',
  });
  return `https://www.easyjet.com/holidays/_api/v1.0/hotel/offers?${query.toString()}`;
}
