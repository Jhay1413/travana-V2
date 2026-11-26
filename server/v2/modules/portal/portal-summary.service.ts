import type { PortalSummary } from '@shared/portal-summary';
import { referralRepository } from '../referral/referral.repository';
import { walletService } from '../wallet/wallet.service';
import { portalRepository } from './portal.repository';
import { portalBookingsService } from './portal-bookings.service';
import { portalQuotesService } from './portal-quotes.service';
import { buildNextBooking, pickNextBooking, pickPriceHeld, undecidedQuotes, unfinishedBookings } from './portal-summary.mapper';
import { portalSummaryRepository } from './portal-summary.repository';

// Portal clients are not staff, so the wallet read runs with no agency scope (as portal.service does).
const TRUSTED_PORTAL_SCOPE = { orgId: null } as const;

export const portalSummaryService = {
  /**
   * Home above the fold for the signed-in customer, built only from their own quotes (the customer-visible rule),
   * their own live bookings, their wallet and their referrals. Nothing from the cost or commission side is read.
   */
  async getSummary(clientId: string, now: Date = new Date()): Promise<PortalSummary> {
    const [name, quotes, bookings, balance, referrals, toldDealIds] = await Promise.all([
      portalRepository.findClientNameById(clientId),
      portalQuotesService.listQuotes(clientId),
      portalBookingsService.listBookings(clientId),
      walletService.getBalance(clientId, TRUSTED_PORTAL_SCOPE),
      referralRepository.findByReferrerClientId(clientId),
      portalRepository.findToldDealIds(clientId),
    ]);

    const timings = unfinishedBookings(bookings, now);
    const next = pickNextBooking(timings);
    const facts = next ? await portalSummaryRepository.findBookingFacts(clientId, next.booking.id) : null;

    return {
      firstName: name?.firstName?.trim() || null,
      counts: { quotesAwaiting: undecidedQuotes(quotes).length, upcomingBookings: timings.length },
      nextBooking: next
        ? buildNextBooking(next, {
            board: facts?.boardName ?? null,
            adults: facts?.adult ?? 0,
            children: facts?.child ?? 0,
            infants: facts?.infant ?? 0,
          })
        : null,
      priceHeld: pickPriceHeld(quotes, now),
      rewards: {
        walletCredit: balance > 0 ? Math.round(balance * 100) / 100 : 0,
        rewardWaiting: referrals.some((r) => r.isDue),
      },
      toldDealIds,
    };
  },
};
