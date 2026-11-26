// What the portal API returns for quotes lives in shared/portal-quotes.ts (the client uses the same types).
export type {
  PortalQuoteListItem,
  PortalQuoteDetail,
  PortalQuoteDetailFlight,
  PortalQuoteDetailAccommodation,
  PortalQuoteDetailTransfer,
  PortalQuoteDetailCarHire,
  PortalQuoteDetailTicket,
  PortalQuoteDetailLounge,
  PortalQuoteDetailParking,
  PortalQuoteDetailCruise,
  PortalQuoteOwnership,
} from '@shared/portal-quotes';

export interface PortalQuoteListRow {
  quoteId: string;
  title: string | null;
  salesPrice: string | null;
  discounts: string | null;
  serviceCharge: string | null;
  /** Cost of extras not included in the package (added to the customer total). */
  extrasTotal: string | number | null;
  adult: number | null;
  child: number | null;
  infant: number | null;
  travelDate: string;
  numNights: number | null;
  dateExpiry: Date | string | null;
  sentAt: Date | string | null;
  quoteToken: string | null;
  operatorName: string | null;
  boardName: string | null;
  accommodationName: string | null;
  destinationName: string | null;
  countryName: string | null;
}

/** Who owns a visible quote token and whether it is a published deal for the viewer, plus the fields the public quote data does not carry. */
export interface PortalQuoteAccessRow {
  quoteId: string;
  ownerClientId: string | null;
  /** A published deal of the viewer's own agency (the deals-list predicate); never true for another agency's. */
  isPublishedDeal: boolean;
  /** The quote's deal already has an active BOOKED booking. */
  isBooked: boolean;
  operatorName: string | null;
  dateExpiry: Date | string | null;
  sentAt: Date | string | null;
}

/** A decision-relevant row of quote_customer_actions (accepted / declined / reopened), newest first. */
export interface PortalDecisionActionRow {
  quoteId: string;
  actionType: string;
  message: string | null;
  reason: string | null;
  wantsSimilar: boolean | null;
  createdAt: Date | string;
}
