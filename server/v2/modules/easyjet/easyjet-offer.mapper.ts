import type { OffersResponse } from './easyjet-offer.schema';
import type { ScrapedFlightJson, ScrapedQuoteJson, ScrapedTransferJson } from './easyjet.types';

const TOUR_OPERATOR = 'easyJet holidays';

// "2026-08-14T17:00:00+00:00" → "2026-08-14T17:00" (form wants local wall time).
function toFormDateTime(iso: string): string {
  return iso.length >= 16 ? iso.slice(0, 16) : iso;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

// easyJet transfer types ("SHARED"/"PRIVATE") → the quote form's dropdown labels.
function mapTransferType(type: string): string {
  const t = type.trim().toUpperCase();
  if (t.includes('PRIVATE')) return 'Private Transfer';
  if (t.includes('SHARED')) return 'Shared Transfer';
  return type ? 'Shared Transfer' : 'None';
}

function bestImage(img: { large?: string; medium?: string; small?: string }): string {
  return img.large || img.medium || img.small || '';
}

/**
 * Maps a validated offers-API response onto the client's ScraperJson contract
 * so it flows through the existing quote-form JSON import pipeline.
 */
export function mapOfferToScrapedQuote(data: OffersResponse, sourceUrl: string): ScrapedQuoteJson {
  const offer = data.offers[0];
  const unit = offer.accom.unit[0];
  const routes = offer.transport?.routes ?? [];
  const outbound = routes.find((r) => r.direction === 'outbound');
  const inbound = routes.find((r) => r.direction === 'inbound');

  const flights: ScrapedFlightJson[] = [];
  if (outbound) {
    flights.push({
      flight_number: outbound.fltNo,
      flight_type: 'outbound',
      departing_airport: outbound.depPt,
      departing_airport_name: outbound.depName,
      departure_date_time: toFormDateTime(outbound.depDate),
      arrival_airport: outbound.arrPt,
      arrival_airport_name: outbound.arrName,
      arrival_date_time: toFormDateTime(outbound.arrDate),
    });
  }
  if (inbound) {
    flights.push({
      flight_number: inbound.fltNo,
      flight_type: 'return',
      departing_airport: inbound.depPt,
      departing_airport_name: inbound.depName,
      departure_date_time: toFormDateTime(inbound.depDate),
      arrival_airport: inbound.arrPt,
      arrival_airport_name: inbound.arrName,
      arrival_date_time: toFormDateTime(inbound.arrDate),
    });
  }

  const transfer = offer.transfers[0];
  const transfers: ScrapedTransferJson[] = transfer
    ? [
        {
          tour_operator: TOUR_OPERATOR,
          note: transfer.name,
          // Transfer price is already inside the package total — record it as
          // included so it doesn't double-count in the quote.
          cost: 0,
          is_included_in_package: true,
        },
      ]
    : [];

  // Complimentary hold luggage, deduped ("23kg hold bag" appears once per pax per leg).
  const luggage = [
    ...new Set(
      (offer.extraLuggageInfo?.items ?? [])
        .filter((item) => item.isComplimentary && item.name)
        .map((item) => item.name),
    ),
  ];

  const hotelImages = data.hotel.images.map(bestImage).filter(Boolean);
  const roomImages = (unit.roomType?.images ?? []).map(bestImage).filter(Boolean);

  return {
    source_url: sourceUrl,
    scraped_at: new Date().toISOString(),
    tour_operator: TOUR_OPERATOR,
    travel_date: toDateOnly(offer.date),
    no_of_nights: offer.stay,
    adults: unit.occupation?.adults ?? 2,
    children: unit.occupation?.children ?? 0,
    infants: unit.occupation?.infants ?? 0,
    // Tourist tax is paid locally by the client, so the selling price excludes
    // it when the API breaks it out; `price` (tax-inclusive) is the fallback
    // for older payloads that don't.
    sales_price: offer.priceExcludingTouristTax ?? offer.price,
    price_per_person: offer.pricePP,
    currency: offer.currency?.code || unit.currency?.code || 'GBP',
    discount: unit.discount ?? 0,
    tourist_tax_total: offer.touristTax,
    promotion_code: offer.promotion?.title || '',
    promotion_discount: offer.promotion?.discountAmountPerBooking ?? 0,
    country: data.hotel.country?.name || '',
    destination: data.hotel.location?.name || '',
    resort: data.hotel.resort?.name || '',
    accommodation: data.hotel.name,
    board_basis: unit.boardType?.title || '',
    room_type: unit.roomType?.title || unit.code,
    check_in_date_time: toDateOnly(offer.date),
    transfer_type: mapTransferType(transfer?.type || ''),
    hotel_description: data.hotel.description,
    hotel_images: hotelImages,
    room_images: roomImages,
    flights,
    transfers,
    included_luggage: luggage,
    star_rating: data.hotel.starRating,
    review_score: data.hotel.rating ?? null,
  };
}
