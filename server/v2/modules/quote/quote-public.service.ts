import { quotePublicRepository } from "./quote-public.repository";
import { AppError } from "../../utils/error-handler";
import { customerPrice } from "../../utils/customer-price";
import { looksLikeQuoteToken } from "../../utils/quote-token";
import type { Scope } from "../../utils/scope";
import { assertQuoteReadable } from "./quote-access";
import { toPortalBranding } from "../portal/portal-branding.service";
import {
  PUBLIC_SHARE_METHODS,
  QuoteBlockedError,
  type AgencyContact,
  type PreviewQuotePayload,
  type PublicQuotePayload,
  type PublicShareMethod,
  type QuoteAccessRow,
  type QuoteBlock,
} from "./quote-public.types";
import type { InsertQuoteView } from "@shared/schema";

/** The agent hears about shared-link opens at most this often per quote, however many views there are. */
export const LINK_VIEW_NOTIFY_WINDOW_MINUTES = 60;

type QuoteRecord = NonNullable<Awaited<ReturnType<typeof quotePublicRepository.findRecordById>>>;

function isoDate(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** What a link with no agency behind it carries: the same shape, nothing in it. */
export function noAgency(): AgencyContact {
  return { name: null, phone: null, logoUrl: null, iconUrl: null, email: null, address: null };
}

/**
 * The agency's identity for the page and its "please contact" lines. Built by the portal's own branding allowlist
 * (same fields, same http(s)-or-site-relative URL check), then narrowed to the six fields this page shows.
 */
function agencyContact(row: Pick<QuoteAccessRow, "agencyName" | "agencyLogoUrl" | "agencySettings">): AgencyContact {
  const b = toPortalBranding({ name: row.agencyName ?? "", logoUrl: row.agencyLogoUrl, brandColor: null, settings: row.agencySettings });
  return { name: b.name, phone: b.phone, logoUrl: b.logoUrl, iconUrl: b.iconUrl, email: b.email, address: b.address };
}

/**
 * Why the public link must not open this quote, or null when it may. The visibility rule is the portal's
 * (customerVisibleQuoteWhere); a booked deal and a soft-deleted client are the other two reasons. Booked is only
 * ever said of a quote that would otherwise be visible: nothing else is revealed.
 */
export function blockFor(state: QuoteAccessRow | null): QuoteBlock | null {
  if (!state) return { code: "UNAVAILABLE", agency: noAgency() };
  const agency = agencyContact(state);
  if (!state.visible || state.clientDeleted) return { code: "UNAVAILABLE", agency };
  if (state.isBooked) return { code: "BOOKED", agency };
  return null;
}

/** The public payload, built field by field from the stored record: nothing is spread, so nothing leaks by default. */
export function toPublicPayload(data: QuoteRecord, state: QuoteAccessRow | null, now: Date = new Date()): PublicQuotePayload {
  // Total = sales − discount + service charge + extras not in the package; per person is that total over travellers.
  const price = customerPrice(data);
  const expiry = state?.dateExpiry ? new Date(state.dateExpiry) : null;
  const expired = !!expiry && !Number.isNaN(expiry.getTime()) && expiry.getTime() < now.getTime();
  return {
    title: data.title,
    holidayType: data.holidayType,
    travelDate: data.travelDate,
    numNights: data.numNights,
    adults: data.adults,
    children: data.children,
    infants: data.infants,
    pets: data.pets,
    totalPrice: price.total.toFixed(2),
    pricePerPerson: price.pricePerPerson.toFixed(2),
    transferType: data.transferType,
    flightMeals: data.flightMeals,
    preBookedSeats: data.preBookedSeats,
    destinationName: data.destinationName,
    countryName: data.countryName,
    resortName: data.resortName,
    flights: data.flights.map((f) => ({
      flightType: f.flightType,
      flightNumber: f.flightNumber,
      departingAirport: f.departingAirport,
      arrivalAirport: f.arrivalAirport,
      departureDateTime: f.departureDateTime,
      arrivalDateTime: f.arrivalDateTime,
      legOrder: f.legOrder,
    })),
    accommodations: data.accommodations.map((a) => ({
      name: a.name,
      boardBasis: a.boardBasis,
      roomType: a.roomType,
      checkInDateTime: a.checkInDateTime,
      starRating: a.starRating,
    })),
    transfers: data.transfers.map((t) => ({ from: t.from, to: t.to, note: t.note })),
    carHires: data.carHires.map((c) => ({ pickupLocation: c.pickupLocation, dropoffLocation: c.dropoffLocation, numDays: c.numDays })),
    attractionTickets: data.attractionTickets.map((t) => ({ type: t.type, dateOfVisit: t.dateOfVisit, numberOfTickets: t.numberOfTickets })),
    loungePasses: data.loungePasses.map((p) => ({ airportName: p.airportName, terminal: p.terminal, dateOfUsage: p.dateOfUsage })),
    airportParkings: data.airportParkings.map((p) => ({ airportName: p.airportName, parkingType: p.parkingType, parkingDate: p.parkingDate })),
    cruises: data.cruises.map((c) => ({
      cruiseLine: c.cruiseLine,
      ship: c.ship,
      cabinType: c.cabinType,
      cruiseName: c.cruiseName,
      cruiseDate: c.cruiseDate,
      itinerary: c.itinerary.map((i) => ({ day: i.day, description: i.description, subDescription: i.subDescription })),
    })),
    images: data.images.map((i) => ({ image_url: i.image_url, isPrimary: i.isPrimary })),
    destinationGuru: data.destinationGuru
      ? { destination: data.destinationGuru.destination, country: data.destinationGuru.country, data: data.destinationGuru.data }
      : null,
    agent: { name: data.agent.name, avatar: data.agent.avatar },
    agency: state ? agencyContact(state) : noAgency(),
    expired,
    expiredOn: expired ? isoDate(expiry) : null,
  };
}

type NotifyInfo = { title: string | null; destinationName: string | null; clientId: string | null; clientName: string | null };

/** Label + link shared by the portal and shared-link view notifications. */
function describeNotifyTarget(quoteId: string, info: NotifyInfo | null) {
  const ownerClientId = info?.clientId ?? null;
  const label = info?.title || info?.destinationName || "";
  return {
    ownerClientId,
    label,
    quotePhrase: label ? `${label} quote` : "quote",
    link: ownerClientId ? `/clients/${ownerClientId}?holiday=quote:${quoteId}` : `/quotes/${quoteId}`,
  };
}

export type CustomerActionType = "accepted" | "changes_requested" | "declined" | "reopened";

export interface CustomerActionDetails {
  /** One of the portal's fixed decline reasons. */
  reason?: string | null;
  wantsSimilar?: boolean | null;
}

/** [title, message, link, notification type] for the agent's bell, per kind of action. */
function describeCustomerAction(
  actionType: CustomerActionType,
  name: string,
  dest: string,
  message: string | null,
  details?: CustomerActionDetails,
): [string, string, undefined, string] {
  const quote = `the ${dest} quote`;
  const note = message ? `: "${message}"` : "";
  switch (actionType) {
    case "accepted":
      return ["Quote Accepted!", `${name} wants to book on ${quote}${note}`, undefined, "quote_accepted"];
    case "changes_requested":
      return ["Changes Requested", `${name} has requested changes on ${quote}${note}`, undefined, "quote_changes_requested"];
    case "declined": {
      const why = details?.reason ? ` (${details.reason})` : "";
      const similar = details?.wantsSimilar ? " They would like something similar." : "";
      return ["Quote Declined", `${name} is not interested in ${quote}${why}${note}.${similar}`, undefined, "quote_declined"];
    }
    case "reopened":
      return ["Quote Reopened", `${name} has reopened ${quote}, so it is undecided again`, undefined, "quote_reopened"];
  }
}

export const quotePublicService = {
  /** The quote a token opens, or a 404 that is the same for a malformed, unknown and duplicated token. */
  async resolveToken(token: string): Promise<string> {
    if (!looksLikeQuoteToken(token)) throw new AppError("Quote not found", 404);
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);
    return quoteId;
  },

  /**
   * Throws QuoteBlockedError (answered 410) unless the public link may open the quote: it must be visible to the
   * customer by the portal's rule, not booked, and its client not deleted. Returns the facts for the expired banner.
   */
  async assertOpen(quoteId: string): Promise<QuoteAccessRow> {
    const state = await quotePublicRepository.findAccessState(quoteId);
    const block = blockFor(state);
    if (block || !state) throw new QuoteBlockedError(block ?? { code: "UNAVAILABLE", agency: noAgency() });
    return state;
  },

  /** The quote as the public page shows it. Expired and accepted quotes open; blocked ones answer 410. */
  async getPublicQuote(token: string): Promise<PublicQuotePayload> {
    const quoteId = await this.resolveToken(token);
    const state = await this.assertOpen(quoteId);
    const data = await quotePublicRepository.findRecordById(quoteId);
    if (!data) throw new AppError("Quote not found", 404);
    return toPublicPayload(data, state);
  },

  /**
   * Staff preview: the same payload whatever the quote's state (booked, lost, archived, deleted), for a quote the
   * caller may read in the CRM (same organisation and role rules), and it never records a view. `previewBlock` says
   * whether customers would be refused, so the page can show the staff bar.
   */
  async getPreviewQuote(token: string, scope: Scope): Promise<PreviewQuotePayload> {
    const quoteId = await this.resolveToken(token);
    await assertQuoteReadable(quoteId, scope);
    const [state, data] = await Promise.all([quotePublicRepository.findAccessState(quoteId), quotePublicRepository.findRecordById(quoteId)]);
    if (!data) throw new AppError("Quote not found", 404);
    return { ...toPublicPayload(data, state), previewBlock: blockFor(state)?.code ?? null };
  },

  /** Records a view of an open quote. A blocked quote records nothing and tells nobody. */
  async logView(token: string, viewData: Omit<InsertQuoteView, "quoteId">) {
    const quoteId = await this.resolveToken(token);
    await this.assertOpen(quoteId);

    const view = await quotePublicRepository.logView(quoteId, viewData);

    await this.notifyLinkView(quoteId, viewData);
    return view;
  },

  /**
   * Records what a customer did with a quote and tells the owning agent. "accepted" is the customer's
   * "I'm interested" (the public page's Accept and the portal's button are the same record and notification);
   * "declined" and "reopened" (the undo of a decline) come from the portal only.
   */
  async handleCustomerAction(
    token: string,
    actionType: CustomerActionType,
    message: string | null,
    customerName: string | null,
    details?: CustomerActionDetails,
  ) {
    const quoteId = await quotePublicRepository.findQuoteIdByToken(token);
    if (!quoteId) throw new AppError("Quote not found", 404);

    const action = await quotePublicRepository.createCustomerAction({
      quoteId,
      actionType,
      message,
      customerName,
      ...(details?.reason != null ? { reason: details.reason } : {}),
      ...(details?.wantsSimilar != null ? { wantsSimilar: details.wantsSimilar } : {}),
    });

    const quoteData = await quotePublicRepository.findByToken(token);
    const dest = quoteData?.destinationName || "their holiday";
    const name = customerName || "A customer";

    await quotePublicRepository.notifyAgent(
      quoteId,
      ...describeCustomerAction(actionType, name, dest, message, details),
    );

    return action;
  },

  /**
   * Notify the owning agent that a client opened a quote in the portal. The
   * message names the client and the quote; the link opens the quote in place
   * on the client page.
   */
  async notifyPortalView(_token: string, quoteId: string, viewerClientId: string | null, viewerName: string | null) {
    // Best-effort: a notification failure must never fail the view request.
    try {
      const info = await quotePublicRepository.findNotifyInfo(quoteId);
      const { ownerClientId, quotePhrase, link } = describeNotifyTarget(quoteId, info);
      const isOwner = !ownerClientId || ownerClientId === viewerClientId;
      const who = viewerName || "A client";
      const message = isOwner
        ? `${who} viewed their ${quotePhrase} via the portal`
        : `${who} viewed the ${quotePhrase} via the portal`;
      await quotePublicRepository.notifyAgent(quoteId, "Quote Viewed", message, link, "quote_viewed");
    } catch (err) {
      console.error("Portal view notification failed:", err);
    }
  },

  /**
   * Notify the owning agent that someone opened the quote through the shared
   * public link. Best-effort: never throws.
   */
  async notifyLinkView(quoteId: string, viewData: Omit<InsertQuoteView, "quoteId">) {
    try {
      const info = await quotePublicRepository.findNotifyInfo(quoteId);
      const { label, quotePhrase, link } = describeNotifyTarget(quoteId, info);
      // One bell per quote per hour: later opens are still recorded as views, they just do not ring again.
      if (await quotePublicRepository.hasRecentLinkViewNotification(quoteId, link, LINK_VIEW_NOTIFY_WINDOW_MINUTES)) return;
      const clientName = info?.clientName?.trim() || "";
      const subject = clientName
        ? `${clientName}'s ${quotePhrase}`
        : label
          ? `The ${quotePhrase}`
          : "A quote";
      const device = viewData.deviceType ? ` (${viewData.deviceType})` : "";
      await quotePublicRepository.notifyAgent(
        quoteId,
        "Quote Viewed",
        `${subject} was opened via the shared link${device}`,
        link,
        "quote_viewed",
      );
    } catch (err) {
      console.error("Shared link view notification failed:", err);
    }
  },

  /** Tells the agent the quote was shared. The method must be one of the fixed share buttons; a blocked quote tells nobody. */
  async logShare(token: string, method: PublicShareMethod) {
    if (!(PUBLIC_SHARE_METHODS as readonly string[]).includes(method)) throw new AppError("Unknown share method", 400);
    const quoteId = await this.resolveToken(token);
    await this.assertOpen(quoteId);

    const info = await quotePublicRepository.findNotifyInfo(quoteId);
    const dest = info?.destinationName || "their holiday";
    const name = info?.clientName || "A customer";

    await quotePublicRepository.notifyAgent(
      quoteId,
      "Quote Shared!",
      `${name} shared their ${dest} quote via ${method}`,
      undefined,
      "quote_shared",
    );
  },
};
