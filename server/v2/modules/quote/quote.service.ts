import { newQuoteRepository } from "./quote.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { quoteImageRepository } from "./quote-image.repository";
import { tagService } from "../tag/tag.service";
import { destinationGuruService } from "../destination-guru/destination-guru.service";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type {
  Quote,
  InsertQuote,
  InsertTransaction,
  InsertQuoteFlight,
  InsertQuoteAccomodation,
  InsertQuoteTransfer,
  InsertQuoteCarHire,
  InsertQuoteAttractionTicket,
  InsertQuoteLoungePass,
  InsertQuoteAirportParking,
  InsertPassenger,
} from "@shared/schema";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

async function assertQuoteInScope(id: string, scope: ScopeOrTrusted) {
  const ok = await newQuoteRepository.quoteInScope(id, scope);
  if (!ok) throw new AppError("Quote not found", 404);
}

async function assertTransactionInScope(transactionId: string, scope: ScopeOrTrusted) {
  const ok = await newQuoteRepository.transactionInScope(transactionId, scope);
  if (!ok) throw new AppError("Quote not found", 404);
}

async function assertFlightInScope(flightId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await newQuoteRepository.flightBelongsToOrg(flightId, orgId);
  if (!ok) throw new AppError("Flight not found", 404);
}

async function assertAccommodationInScope(accommodationId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await newQuoteRepository.accommodationBelongsToOrg(accommodationId, orgId);
  if (!ok) throw new AppError("Accommodation not found", 404);
}

async function assertTransferInScope(transferId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await newQuoteRepository.transferBelongsToOrg(transferId, orgId);
  if (!ok) throw new AppError("Transfer not found", 404);
}

async function assertPassengerInScope(passengerId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await newQuoteRepository.passengerBelongsToOrg(passengerId, orgId);
  if (!ok) throw new AppError("Passenger not found", 404);
}

interface QuoteRelationData {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  outboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  inboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  images?: string[];
  tags?: string[];
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
}

type CreateQuotePayload = InsertQuote & QuoteRelationData;

type UpdateQuotePayload = Partial<InsertQuote> & QuoteRelationData & {
  cruiseTitle?: string;
  cruiseLine?: string;
  shipName?: string;
  cruiseDate?: string;
  cabinType?: string;
  embarkation?: string;
  debarkation?: string;
  cruiseExtras?: string;
  cruiseOnly?: boolean;
  lead_source?: string;
  images?: string[];
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
  childAges?: any[];
};

function calcPricePerPerson(salesPrice: unknown, adult: unknown, child: unknown, discount: unknown = 0, serviceCharge: unknown = 0): string {
  const price = parseFloat(String(salesPrice ?? 0)) || 0;
  const disc = parseFloat(String(discount ?? 0)) || 0;
  const sc = parseFloat(String(serviceCharge ?? 0)) || 0;
  const adults = parseInt(String(adult ?? 0), 10) || 0;
  const children = parseInt(String(child ?? 0), 10) || 0;
  const total = adults + children;
  const netPrice = price - disc + sc;
  return total > 0 ? (netPrice / total).toFixed(2) : "0.00";
}

function normalizeUniqueImageUrls(images: string[] | undefined): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0)
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

async function resolveAndGenerateGuru(accommodationId: string, userId?: string) {
  const destName = await newQuoteRepository.findDestinationNameByAccommodationId(accommodationId);
  if (destName && destName.trim().length > 0) {
    console.log(`DESTINATION GURU - auto-generating for: ${destName}`);
    await destinationGuruService.generate(destName.trim(), userId);
  }
}

export const newQuoteService = {
  async listQuotes(scope: ScopeOrTrusted) {
    return newQuoteRepository.findAll(scope);
  },

  async listQuotesByTransaction(transactionId: string, scope: ScopeOrTrusted) {
    await assertTransactionInScope(transactionId, scope);
    return newQuoteRepository.findByTransactionId(transactionId, scope);
  },

  async listQuotesByStatus(status: Quote['quote_status'], scope: ScopeOrTrusted) {
    return newQuoteRepository.findByStatus(status, scope);
  },

  async listFreeQuotesPaginated(page: number = 0, pageSize: number = 12, scheduledOnly = false, scheduleFilter = "none", search = "", rangeStart = "", rangeEnd = "", scope: ScopeOrTrusted) {
    return newQuoteRepository.findFreeQuotesPaginated(page, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd, scope);
  },

  async getQuoteById(id: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    const q = await newQuoteRepository.findById(id);
    if (!q) throw new AppError("Quote not found", 404);
    return q;
  },

  async getQuoteWithDetails(id: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    const q = await newQuoteRepository.findWithDetails(id);
    if (!q) throw new AppError("Quote not found", 404);
    return q;
  },

  async createQuote(data: CreateQuotePayload, scope: ScopeOrTrusted) {
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations,
      ...quoteFields
    } = data;

    await assertTransactionInScope(quoteFields.transaction_id, scope);

    const txn = await transactionRepository.findById(quoteFields.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);
    if (scope.orgId && txn.org_id !== scope.orgId) {
      throw new AppError("Transaction not found", 404);
    }

    if (!quoteFields.price_per_person || quoteFields.price_per_person === "0.00" || quoteFields.price_per_person === "0") {
      quoteFields.price_per_person = calcPricePerPerson(quoteFields.sales_price, quoteFields.adult, quoteFields.child, quoteFields.discounts, quoteFields.service_charge);
    }

    const q = await newQuoteRepository.create(quoteFields);

    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      await tagService.addQuoteTags(q.id, data.tags);
    }

    if (txn.status !== 'on_quote' && txn.status !== 'on_booking') {
      await transactionRepository.update(txn.id, { status: 'on_quote' });
    }

    if (outboundFlight) await newQuoteRepository.upsertFlightByType(q.id, "outbound", outboundFlight, 0);
    if (inboundFlight) await newQuoteRepository.upsertFlightByType(q.id, "inbound", inboundFlight, 0);
    if (outboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(q.id, "outbound", outboundConnectingLegs);
    if (inboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(q.id, "inbound", inboundConnectingLegs);
    if (primaryAccommodation) await newQuoteRepository.upsertPrimaryAccommodation(q.id, primaryAccommodation);
    if (transfers !== undefined) await newQuoteRepository.replaceTransfers(q.id, transfers);
    if (carHires !== undefined) await newQuoteRepository.replaceCarHires(q.id, carHires);
    if (attractionTickets !== undefined) await newQuoteRepository.replaceAttractionTickets(q.id, attractionTickets);
    if (loungePasses !== undefined) await newQuoteRepository.replaceLoungePasses(q.id, loungePasses);
    if (airportParkings !== undefined) await newQuoteRepository.replaceAirportParkings(q.id, airportParkings);
    if (extraAccommodations !== undefined) await newQuoteRepository.replaceExtraAccommodations(q.id, extraAccommodations);

    const normalizedImages = normalizeUniqueImageUrls(images);
    if (normalizedImages.length > 0) {
      await quoteImageRepository.addImages(q.id, normalizedImages);
      if (primaryAccommodation?.accomodation_id) {
        await newQuoteRepository.saveImagesToAccommodation(primaryAccommodation.accomodation_id as string, normalizedImages);
      }
      if (quoteFields.lodge_id) {
        await newQuoteRepository.saveImagesToLodge(quoteFields.lodge_id, normalizedImages);
      }
    }

    if (!quoteFields.isFreeQuote && !txn.is_test && !quoteFields.not_for_social) {
      try {
        const freeTxn = await transactionRepository.create({ status: 'on_quote', user_id: txn.user_id, is_test: txn.is_test ?? false } as InsertTransaction);
        const freeQ = await newQuoteRepository.create({ ...quoteFields, transaction_id: freeTxn.id, isFreeQuote: true, isQuoteCopy: false });
        if (outboundFlight) await newQuoteRepository.upsertFlightByType(freeQ.id, "outbound", outboundFlight, 0);
        if (inboundFlight) await newQuoteRepository.upsertFlightByType(freeQ.id, "inbound", inboundFlight, 0);
        if (outboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(freeQ.id, "outbound", outboundConnectingLegs);
        if (inboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(freeQ.id, "inbound", inboundConnectingLegs);
        if (primaryAccommodation) await newQuoteRepository.upsertPrimaryAccommodation(freeQ.id, primaryAccommodation);
        if (transfers !== undefined) await newQuoteRepository.replaceTransfers(freeQ.id, transfers);
        if (carHires !== undefined) await newQuoteRepository.replaceCarHires(freeQ.id, carHires);
        if (attractionTickets !== undefined) await newQuoteRepository.replaceAttractionTickets(freeQ.id, attractionTickets);
        if (loungePasses !== undefined) await newQuoteRepository.replaceLoungePasses(freeQ.id, loungePasses);
        if (airportParkings !== undefined) await newQuoteRepository.replaceAirportParkings(freeQ.id, airportParkings);
        if (extraAccommodations !== undefined) await newQuoteRepository.replaceExtraAccommodations(freeQ.id, extraAccommodations);
        if (normalizedImages.length > 0) await quoteImageRepository.addImages(freeQ.id, normalizedImages);
        if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) await tagService.addQuoteTags(freeQ.id, data.tags);
      } catch (err) {
        console.error('FREE QUOTE (quote.service) - error:', err);
      }
    }

    if (primaryAccommodation?.accomodation_id) {
      resolveAndGenerateGuru(primaryAccommodation.accomodation_id as string, txn.user_id).catch((err) => {
        console.error('DESTINATION GURU auto-generate error:', err);
      });
    }

    return q;
  },

  async createSocialQuote(userId: string, data: Omit<CreateQuotePayload, 'transaction_id' | 'isFreeQuote'>, scope: ScopeOrTrusted) {
    if ((data as any).not_for_social) {
      throw new AppError("Cannot create social post for a quote marked as not for social", 400);
    }

    const txn = await transactionRepository.create({ status: 'on_quote', user_id: userId } as InsertTransaction);
    return newQuoteService.createQuote({ ...data, transaction_id: txn.id, isFreeQuote: true } as CreateQuotePayload, { orgId: null });
  },

  async duplicateQuote(sourceQuoteId: string, data: Partial<CreateQuotePayload>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(sourceQuoteId, scope);

    const sourceQuote = await newQuoteRepository.findById(sourceQuoteId);
    if (!sourceQuote) throw new AppError("Quote not found", 404);

    const sourceImages = await quoteImageRepository.getByQuoteId(sourceQuoteId);
    const sourceImageUrls = sourceImages.map((image) => image.url).filter((url): url is string => typeof url === "string" && url.length > 0);
    const requestedImageUrls = Array.isArray(data.images) ? data.images.filter((url): url is string => typeof url === "string" && url.length > 0) : [];
    const mergedImages = [...sourceImageUrls, ...requestedImageUrls].filter((url, index, arr) => arr.indexOf(url) === index);

    const { id: _sourceId, date_created: _sourceCreatedAt, transaction_id: _ignoredTransactionId, quote_token: _ignoreToken, ...sourceInsertData } = sourceQuote;
    const sourceDetails = await newQuoteRepository.findWithDetails(sourceQuoteId);
    const sourceExtras = sourceDetails ? {
      transfers: (sourceDetails.transfers || []).map((t: Record<string, unknown>) => ({ booking_ref: t.booking_ref, tour_operator_id: t.tour_operator_id, pick_up_location: t.pick_up_location, drop_off_location: t.drop_off_location, pick_up_time: t.pick_up_time, drop_off_time: t.drop_off_time, note: t.note, cost: t.cost, commission: t.commission, is_included_in_package: t.is_included_in_package })),
      carHires: (sourceDetails.carHires || []).map((c: Record<string, unknown>) => ({ booking_ref: c.booking_ref, tour_operator_id: c.tour_operator_id, pick_up_location: c.pick_up_location, drop_off_location: c.drop_off_location, pick_up_time: c.pick_up_time, drop_off_time: c.drop_off_time, no_of_days: c.no_of_days, driver_age: c.driver_age, cost: c.cost, commission: c.commission, is_included_in_package: c.is_included_in_package })),
      attractionTickets: (sourceDetails.attractionTickets || []).map((t: Record<string, unknown>) => ({ booking_ref: t.booking_ref, tour_operator_id: t.tour_operator_id, ticket_type: t.ticket_type, date_of_visit: t.date_of_visit, number_of_tickets: t.number_of_tickets, cost: t.cost, commission: t.commission, is_included_in_package: t.is_included_in_package })),
      loungePasses: (sourceDetails.loungePasses || []).map((p: Record<string, unknown>) => ({ booking_ref: p.booking_ref, tour_operator_id: p.tour_operator_id, airport_id: p.airport_id, terminal: p.terminal, date_of_usage: p.date_of_usage, note: p.note, cost: p.cost, commission: p.commission, is_included_in_package: p.is_included_in_package })),
      airportParkings: (sourceDetails.airportParkings || []).map((p: Record<string, unknown>) => ({ booking_ref: p.booking_ref, tour_operator_id: p.tour_operator_id, airport_id: p.airport_id, parking_type: p.parking_type, parking_date: p.parking_date, car_make: p.car_make, car_model: p.car_model, colour: p.colour, car_reg_number: p.car_reg_number, duration: p.duration, cost: p.cost, commission: p.commission, is_included_in_package: p.is_included_in_package })),
      extraAccommodations: (sourceDetails.accommodations || []).filter((a: Record<string, unknown>) => !a.is_primary).map((a: Record<string, unknown>) => ({ booking_ref: a.booking_ref, tour_operator_id: a.tour_operator_id, accomodation_id: a.accomodation_id, board_basis_id: a.board_basis_id, room_type: a.room_type, check_in_date_time: a.check_in_date_time, no_of_nights: a.no_of_nights, cost: a.cost, commission: a.commission, is_included_in_package: a.is_included_in_package })),
    } : {};

    const payload: CreateQuotePayload = {
      ...(sourceInsertData as InsertQuote),
      ...(data as Partial<InsertQuote>),
      ...sourceExtras,
      transaction_id: sourceQuote.transaction_id,
      isQuoteCopy: true,
      images: mergedImages,
      tags: sourceDetails?.tags ?? [],
    };

    return newQuoteService.createQuote(payload, scope);
  },

  async updateQuote(id: string, data: UpdateQuotePayload, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);

    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation,
      cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType,
      embarkation, debarkation, cruiseExtras, cruiseOnly, lead_source, images, tags, childAges,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations,
      ...quoteFields
    } = data;

    const quoteData: Partial<InsertQuote> = {};
    const directFields: (keyof InsertQuote)[] = ['holiday_type_id', 'sales_price', 'package_commission', 'travel_date', 'discounts', 'service_charge', 'num_of_nights', 'pets', 'cottage_id', 'lodge_id', 'quote_type', 'deal_type', 'pre_booked_seats', 'flight_meals', 'infant', 'child', 'adult', 'title', 'price_per_person', 'lodge_type', 'transfer_type', 'quote_status', 'main_tour_operator_id', 'quote_ref', 'date_expiry', 'not_for_social'];
    for (const key of directFields) {
      if (key in quoteFields) (quoteData[key] as InsertQuote[typeof key]) = (quoteFields as Record<string, unknown>)[key] as InsertQuote[typeof key];
    }

    if ('date_expiry' in quoteData && quoteData.date_expiry) quoteData.date_expiry = new Date(quoteData.date_expiry as unknown as string);
    else if ('date_expiry' in quoteData && !quoteData.date_expiry) quoteData.date_expiry = null;
    if ('date_expiry' in quoteData) quoteData.is_expired = false;

    if ('sales_price' in quoteData || 'adult' in quoteData || 'child' in quoteData || 'discounts' in quoteData || 'service_charge' in quoteData) {
      const current = await newQuoteRepository.findById(id);
      if (current) {
        quoteData.price_per_person = calcPricePerPerson(quoteData.sales_price ?? current.sales_price, quoteData.adult ?? current.adult, quoteData.child ?? current.child, quoteData.discounts ?? current.discounts, quoteData.service_charge ?? current.service_charge);
      }
    }

    let q;
    if (Object.keys(quoteData).length > 0) {
      q = await newQuoteRepository.update(id, quoteData);
      if (!q) throw new AppError("Quote not found", 404);
    } else {
      q = await newQuoteRepository.findById(id);
      if (!q) throw new AppError("Quote not found", 404);
    }

    if (quoteData.quote_status === 'LOST' && q.transaction_id) {
      await newQuoteRepository.update(id, { is_active: false });
      await transactionRepository.update(q.transaction_id, { is_active: false });
    }

    if (lead_source !== undefined && q.transaction_id) {
      await transactionRepository.update(q.transaction_id, { lead_source: lead_source as any });
    }

    if (outboundFlight) await newQuoteRepository.upsertFlightByType(id, "outbound", outboundFlight, 0);
    if (inboundFlight) await newQuoteRepository.upsertFlightByType(id, "inbound", inboundFlight, 0);
    if (outboundConnectingLegs !== undefined) await newQuoteRepository.replaceConnectingLegs(id, "outbound", outboundConnectingLegs || []);
    if (inboundConnectingLegs !== undefined) await newQuoteRepository.replaceConnectingLegs(id, "inbound", inboundConnectingLegs || []);
    if (primaryAccommodation) await newQuoteRepository.upsertPrimaryAccommodation(id, primaryAccommodation);
    if (transfers !== undefined) await newQuoteRepository.replaceTransfers(id, transfers);
    if (carHires !== undefined) await newQuoteRepository.replaceCarHires(id, carHires);
    if (attractionTickets !== undefined) await newQuoteRepository.replaceAttractionTickets(id, attractionTickets);
    if (loungePasses !== undefined) await newQuoteRepository.replaceLoungePasses(id, loungePasses);
    if (airportParkings !== undefined) await newQuoteRepository.replaceAirportParkings(id, airportParkings);
    if (extraAccommodations !== undefined) await newQuoteRepository.replaceExtraAccommodations(id, extraAccommodations);
    if (childAges !== undefined) await newQuoteRepository.replaceChildPassengers(id, "quote", childAges);
    if (tags !== undefined) await tagService.updateQuoteTags(id, tags);

    if (images && images.length > 0) {
      const normalizedUpdateImages = normalizeUniqueImageUrls(images);
      await quoteImageRepository.addImages(id, normalizedUpdateImages);
      if (primaryAccommodation?.accomodation_id) await newQuoteRepository.saveImagesToAccommodation(primaryAccommodation.accomodation_id as string, normalizedUpdateImages);
      const lodgeId = (quoteData.lodge_id as string | undefined) || (q?.lodge_id as string | undefined);
      if (lodgeId) await newQuoteRepository.saveImagesToLodge(lodgeId, normalizedUpdateImages);
    }

    return newQuoteRepository.findWithDetails(id);
  },

  async deleteQuote(id: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    const existing = await newQuoteRepository.findById(id);
    if (!existing) throw new AppError("Quote not found", 404);
    await newQuoteRepository.remove(id);
  },

  async addFlight(quoteId: string, data: Omit<InsertQuoteFlight, 'quote_id'>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    return newQuoteRepository.addFlight({ ...data, quote_id: quoteId });
  },

  async updateFlight(flightId: string, data: Partial<InsertQuoteFlight>, scope: ScopeOrTrusted) {
    await assertFlightInScope(flightId, scope);
    return newQuoteRepository.updateFlight(flightId, data);
  },

  async removeFlight(flightId: string, scope: ScopeOrTrusted) {
    await assertFlightInScope(flightId, scope);
    await newQuoteRepository.removeFlight(flightId);
  },

  async addAccommodation(quoteId: string, data: Omit<InsertQuoteAccomodation, 'quote_id'>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    return newQuoteRepository.addAccommodation({ ...data, quote_id: quoteId });
  },

  async updateAccommodation(accommodationId: string, data: Partial<InsertQuoteAccomodation>, scope: ScopeOrTrusted) {
    await assertAccommodationInScope(accommodationId, scope);
    return newQuoteRepository.updateAccommodation(accommodationId, data);
  },

  async removeAccommodation(accommodationId: string, scope: ScopeOrTrusted) {
    await assertAccommodationInScope(accommodationId, scope);
    await newQuoteRepository.removeAccommodation(accommodationId);
  },

  async addTransfer(quoteId: string, data: Omit<InsertQuoteTransfer, 'quote_id'>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    return newQuoteRepository.addTransfer({ ...data, quote_id: quoteId });
  },

  async removeTransfer(transferId: string, scope: ScopeOrTrusted) {
    await assertTransferInScope(transferId, scope);
    await newQuoteRepository.removeTransfer(transferId);
  },

  async addPassenger(quoteId: string, data: Omit<InsertPassenger, 'quote_id'>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    return newQuoteRepository.addPassenger({ ...data, quote_id: quoteId });
  },

  async removePassenger(passengerId: string, scope: ScopeOrTrusted) {
    await assertPassengerInScope(passengerId, scope);
    await newQuoteRepository.removePassenger(passengerId);
  },

  async updateQuoteTags(quoteId: string, tagNames: string[], scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    await tagService.updateQuoteTags(quoteId, tagNames);
  },

  async getQuoteTags(quoteId: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);
    return tagService.getQuoteTags(quoteId);
  },

  async setPortalVisibility(id: string, showOnPortal: boolean, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    let token: string | undefined;
    if (showOnPortal) {
      const existing = await newQuoteRepository.findTokenById(id);
      if (!existing?.token) {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        token = "";
        for (let i = 0; i < 8; i++) token += chars[Math.floor(Math.random() * chars.length)];
      }
    }
    await newQuoteRepository.setPortalVisibility(id, showOnPortal, token);
  },

  async setFeatured(id: string, isFeatured: boolean, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    await newQuoteRepository.setFeatured(id, isFeatured);
  },

  /** Used by the portal-push endpoint to fetch the title before broadcasting. */
  async getTitleForPortalPush(id: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    const row = await newQuoteRepository.findTitleAndPortalVisibilityById(id);
    if (!row) throw new AppError("Quote not found", 404);
    return row;
  },

  async getRecentClientEngagement(scope: ScopeOrTrusted, limit = 10) {
    const orgId = effectiveOrgId(scope);
    const role = (scope as Scope).orgRole;
    const isManagerLevel = role === "platform_admin" || role === "org_admin" || role === "branch_manager";
    const userId = isManagerLevel ? null : (scope as Scope).userId;
    return newQuoteRepository.findRecentClientEngagement({ orgId, userId, limit });
  },
};

