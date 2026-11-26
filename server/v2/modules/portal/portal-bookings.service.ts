import { customerPrice } from '../../utils/customer-price';
import { portalRepository } from './portal.repository';
import { bookingDestination, bookingTitle } from './portal-booking-title';
import { tripTiming } from './portal-booking-detail.mapper';
import { addNights } from './portal-quotes.mapper';
import type { PortalBookingDto } from './portal.types';

type BookingImageRow = { bookingId: string | null; url: string; isPrimary: boolean | null };

export const portalBookingsService = {
  /** The signed-in client's bookings (LOST ones are excluded by the repository). */
  async listBookings(clientId: string, now: Date = new Date()): Promise<PortalBookingDto[]> {
    const results = await portalRepository.findClientBookings(clientId);

    const bookingIds = results.map((r) => r.bookingId);
    // Resolve imagery to match the canonical booking-details read: the source
    // quote's images (quote_images) via booking.quote_id first (mirroring
    // /quotes), then the booking's own images, then legacy deal_images. The
    // shared accommodation/lodge libraries are deliberately NOT used — a client
    // should only ever see photos put on their own quote or booking.
    const quoteIds = results.map((r) => r.quoteId).filter((id): id is string => !!id);
    const [quoteImgs, ownImages, dealImages] = await Promise.all([
      portalRepository.findImagesForQuotes(quoteIds),
      portalRepository.findImagesForBookings(bookingIds),
      portalRepository.findDealImagesForBookings(bookingIds),
    ]);

    // Prefer quote imagery (primary first, mirroring /quotes).
    const quoteImageMap: Record<string, string> = {};
    for (const img of quoteImgs) {
      if (img.quoteId && (!quoteImageMap[img.quoteId] || img.isPrimary)) {
        quoteImageMap[img.quoteId] = img.url;
      }
    }

    // Per-booking fallbacks in the same precedence the booking-details read uses:
    // own booking images -> deal_images. Within a source the primary image wins
    // (otherwise the first); a source only fills a booking no earlier source resolved.
    const imageMap: Record<string, string> = {};
    const fillFrom = (imgs: BookingImageRow[]) => {
      const best = new Map<string, { url: string; isPrimary: boolean }>();
      for (const img of imgs) {
        if (!img.bookingId) continue;
        const current = best.get(img.bookingId);
        if (!current || (img.isPrimary === true && !current.isPrimary)) {
          best.set(img.bookingId, { url: img.url, isPrimary: img.isPrimary === true });
        }
      }
      for (const [bookingId, { url }] of best) {
        if (!imageMap[bookingId]) imageMap[bookingId] = url;
      }
    };
    fillFrom(ownImages);
    fillFrom(dealImages);

    return results.map((r) => {
      const dest = bookingDestination(r.destinationName, r.countryName);

      // No length recorded (0 or missing): nothing is invented. The booking has no end date and no nights; it
      // is treated as a one-day trip for "has it finished" (see portal-summary.mapper).
      const nights = r.numNights && r.numNights > 0 ? r.numNights : null;
      const startDay = r.travelDate instanceof Date ? r.travelDate.toISOString().slice(0, 10) : String(r.travelDate).slice(0, 10);
      const returnDate = nights ? addNights(startDay, nights) : null;

      // Total includes extras not in the package; per person is the holiday price only.
      const { total: totalPrice, pricePerPerson } = customerPrice({ ...r, adults: r.adult, children: r.child });

      const timing = tripTiming(startDay, returnDate, now);

      return {
        id: r.bookingId,
        title: bookingTitle(r.title, dest),
        destination: dest,
        hotel: r.accommodationName || r.title || '',
        price: totalPrice,
        price_per_person: parseFloat(pricePerPerson.toFixed(2)),
        travel_date: r.travelDate,
        return_date: returnDate,
        nights,
        booking_reference: r.haysRef || r.supplierRef || '',
        image_url: (r.quoteId && quoteImageMap[r.quoteId]) || imageMap[r.bookingId] || '',
        documents_url: '#',
        supplier_reference: r.supplierRef?.trim() || null,
        operator_name: r.operatorName || null,
        board: r.boardName || null,
        adults: r.adult ?? 0,
        children: r.child ?? 0,
        infants: r.infant ?? 0,
        trip_status: timing.status,
        days_to_go: timing.daysToGo,
      };
    });
  },
};
