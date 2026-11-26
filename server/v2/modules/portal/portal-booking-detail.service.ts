import type { PortalBookingDetail } from '@shared/portal-bookings';
import { AppError } from '../../utils/error-handler';
import { portalRepository } from './portal.repository';
import { buildBookingDetail } from './portal-booking-detail.mapper';
import { portalBookingDetailRepository } from './portal-booking-detail.repository';

type ImageRow = { url: string; isPrimary: boolean | null };

/** Distinct photos in the order the list uses: the source quote's, then the booking's own, then legacy deal images. Primary first within a source. */
function collectImages(...sources: ImageRow[][]): PortalBookingDetail['images'] {
  const seen = new Set<string>();
  const out: PortalBookingDetail['images'] = [];
  for (const rows of sources) {
    const ordered = [...rows.filter((r) => r.isPrimary === true), ...rows.filter((r) => r.isPrimary !== true)];
    for (const r of ordered) {
      if (!r.url || seen.has(r.url)) continue;
      seen.add(r.url);
      out.push({ id: `photo-${out.length + 1}`, url: r.url, isPrimary: out.length === 0 });
    }
  }
  return out;
}

export const portalBookingDetailService = {
  /**
   * One of the signed-in customer's bookings in full. A booking that is not theirs, does not exist, is inactive or
   * is LOST all answer the same 404, so the answer reveals nothing about other customers' bookings.
   */
  async getBooking(clientId: string, bookingId: string, now: Date = new Date()): Promise<PortalBookingDetail> {
    const header = await portalBookingDetailRepository.findOwnedHeader(clientId, bookingId);
    if (!header) throw new AppError('Booking not found', 404);

    const [flights, accommodations, transfers, carHires, tickets, lounges, parkings, cruises, upsells, quoteImages, ownImages, dealImages] =
      await Promise.all([
        portalBookingDetailRepository.findFlights(bookingId),
        portalBookingDetailRepository.findAccommodations(bookingId),
        portalBookingDetailRepository.findTransfers(bookingId),
        portalBookingDetailRepository.findCarHires(bookingId),
        portalBookingDetailRepository.findTickets(bookingId),
        portalBookingDetailRepository.findLounges(bookingId),
        portalBookingDetailRepository.findParkings(bookingId),
        portalBookingDetailRepository.findCruises(bookingId),
        portalBookingDetailRepository.findUpsells(bookingId),
        header.quoteId ? portalRepository.findImagesForQuotes([header.quoteId]) : Promise.resolve([]),
        portalRepository.findImagesForBookings([bookingId]),
        portalRepository.findDealImagesForBookings([bookingId]),
      ]);

    return buildBookingDetail(
      {
        header,
        flights,
        accommodations,
        transfers,
        carHires,
        tickets,
        lounges,
        parkings,
        cruises,
        upsells,
        images: collectImages(quoteImages, ownImages, dealImages),
      },
      now,
    );
  },
};
