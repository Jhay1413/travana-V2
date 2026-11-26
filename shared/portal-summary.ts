/** What `GET /api/v2/portal/summary` returns: everything the customer portal's Home needs above the fold. */

export interface PortalSummaryNextBooking {
  id: string;
  title: string;
  /** "Resort area, Country" (or whichever half exists, or "TBC"). */
  destination: string;
  /** First day, "YYYY-MM-DD". */
  startDate: string;
  /** Last day, "YYYY-MM-DD"; null when the booking records no length (a one-day trip as far as "finished" goes). */
  endDate: string | null;
  nights: number | null;
  board: string | null;
  adults: number;
  children: number;
  infants: number;
  /** Lead image or "" when the booking has none. */
  imageUrl: string;
  /** Whole UK calendar days from today to the first day (0 = leaves today). */
  daysToGo: number;
}

export interface PortalSummaryPriceHeld {
  token: string;
  title: string;
  /** Customer total, extras included (the same figure the quote list shows). */
  total: number;
  /** The quote's real expiry (ISO). */
  expiresAt: string;
  /** The UK calendar day of the expiry, "YYYY-MM-DD": the date to print, matching `daysLeft`. */
  expiresOn: string;
  /** Whole UK calendar days left (0 = the last day). */
  daysLeft: number;
}

export interface PortalSummaryRewards {
  /** Wallet credit available, in pounds; 0 when none. */
  walletCredit: number;
  /** A referral reward has become due and is waiting to be approved. */
  rewardWaiting: boolean;
}

export interface PortalSummary {
  firstName: string | null;
  counts: {
    /** Quotes the customer has not answered yet. */
    quotesAwaiting: number;
    /** Bookings that have not finished (leaving soon, or away now). */
    upcomingBookings: number;
  };
  nextBooking: PortalSummaryNextBooking | null;
  priceHeld: PortalSummaryPriceHeld | null;
  rewards: PortalSummaryRewards;
  /** Deals this customer has already told the agent they are interested in (so the state follows them across devices and tabs). */
  toldDealIds: string[];
}
