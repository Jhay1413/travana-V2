import { newQuoteRepository } from "./quote.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { quoteImageRepository } from "./quote-image.repository";
import { quoteImageService } from "./quote-image.service";
import { tagService } from "../tag/tag.service";
import { taskService } from "../task/task.service";
import { enquiryTableRepository } from "../enquiry/enquiry.repository";
import { destinationGuruService } from "../destination-guru/destination-guru.service";
import { aiEmbeddingsService } from "../ai-embeddings/ai-embeddings.service";
import { buildQuoteEmbeddingText, buildQuoteEmbeddingMetadata } from "./quote-embedding";
import { AppError } from "../../utils/error-handler";
import type { Scope } from "../../utils/scope";
import type {
  Quote,
  InsertQuote,
  InsertTransaction,
  Transaction,
  InsertQuoteFlight,
  InsertQuoteAccomodation,
  InsertQuoteTransfer,
  InsertQuoteCarHire,
  InsertQuoteAttractionTicket,
  InsertQuoteLoungePass,
  InsertQuoteAirportParking,
  InsertPassenger,
} from "@shared/schema";
import type { PortalStatus } from "./quote.types";

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

interface CruisePayloadData {
  cruiseTitle?: string;
  cruiseLine?: string;
  shipName?: string;
  cruiseDate?: string;
  cabinType?: string;
  cabinNumber?: string;
  embarkation?: string;
  debarkation?: string;
  cruiseExtras?: string;
  cruiseOnly?: boolean;
  preCruiseStay?: number;
  postCruiseStay?: number;
  cruiseItinerary?: Array<Record<string, unknown>>;
}

interface QuoteRelationData extends CruisePayloadData {
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
  childAges?: any[];
}

// Build the cruise persistence payload from a form payload, or null when no
// cruise data is present (so non-cruise quotes never touch quote_cruise).
function buildCruiseData(src: CruisePayloadData & { main_tour_operator_id?: unknown }): Record<string, unknown> | null {
  const { cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType, cabinNumber, embarkation, debarkation, cruiseExtras, cruiseItinerary, preCruiseStay, postCruiseStay } = src;
  const hasCruise = !!(cruiseLine || shipName || cruiseTitle || cruiseDate || cabinType || cabinNumber || embarkation || debarkation || cruiseExtras || (Array.isArray(cruiseItinerary) && cruiseItinerary.length));
  if (!hasCruise) return null;
  return { cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType, cabinNumber, embarkation, debarkation, cruiseExtras, cruiseItinerary, preCruiseStay, postCruiseStay, tourOperatorId: src.main_tour_operator_id ?? null };
}

type CreateQuotePayload = InsertQuote & QuoteRelationData;

type UpdateQuotePayload = Partial<InsertQuote> & QuoteRelationData & {
  lead_source?: string;
  images?: string[];
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
  // Image ids (from quote_images, accommodation_images, lodge_images or
  // deal_images — see quote-image.repository getImageUrl) to remove as part
  // of this same update, processed before the new images are added.
  deletedImageIds?: string[];
};

// Total price the customer pays = sales price − discount + service charge.
function calcTotalPrice(salesPrice: unknown, discount: unknown = 0, serviceCharge: unknown = 0): number {
  const price = parseFloat(String(salesPrice ?? 0)) || 0;
  const disc = parseFloat(String(discount ?? 0)) || 0;
  const sc = parseFloat(String(serviceCharge ?? 0)) || 0;
  return price - disc + sc;
}

// Price per person splits the total price (sales − discount + service charge) across all passengers.
function calcPricePerPerson(salesPrice: unknown, adult: unknown, child: unknown, discount: unknown = 0, serviceCharge: unknown = 0): string {
  const adults = parseInt(String(adult ?? 0), 10) || 0;
  const children = parseInt(String(child ?? 0), 10) || 0;
  const total = adults + children;
  const netPrice = calcTotalPrice(salesPrice, discount, serviceCharge);
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

// Keep the AI vector store in step with a FREE quote's readable details.
// Best-effort and non-blocking: `syncSource`/`removeSource` are fired without
// awaiting completion, and any failure (fetching details or the embedding call
// itself) is swallowed — a quote create/update/delete must never fail because
// of this. Callers resolve orgId via the quote's transaction (transactionRepository)
// before calling in — a free quote's copy transaction may have no org yet, in
// which case we simply skip (no-op).
function syncFreeQuoteEmbedding(quoteId: string, orgId: string | null | undefined): void {
  if (!orgId) return;
  void (async () => {
    try {
      const details = await newQuoteRepository.findWithDetails(quoteId);
      if (!details || !details.isFreeQuote) return;
      await aiEmbeddingsService.syncSource({
        orgId,
        sourceType: "quote",
        sourceId: quoteId,
        content: buildQuoteEmbeddingText(details),
        metadata: buildQuoteEmbeddingMetadata(details),
      });
    } catch (err) {
      console.warn(`[quote-embedding] sync failed (quote=${quoteId}):`, err instanceof Error ? err.message : err);
    }
  })();
}

// Delete keyed on the quote id alone (globally unique), so an embedding is
// always cleaned up on delete even when the org can't be resolved (e.g. a free
// copy whose transaction has no org) — otherwise a deleted quote could linger
// as an internal AI reference.
function removeFreeQuoteEmbedding(quoteId: string): void {
  void aiEmbeddingsService.removeSourceById("quote", quoteId);
}

interface QuoteSectionsInput {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  outboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  inboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  transfers?: Record<string, unknown>[];
  carHires?: Record<string, unknown>[];
  attractionTickets?: Record<string, unknown>[];
  loungePasses?: Record<string, unknown>[];
  airportParkings?: Record<string, unknown>[];
  extraAccommodations?: Record<string, unknown>[];
  cruiseData: Record<string, unknown> | null;
  childAges?: number[];
  normalizedImages: string[];
  lodgeId?: string | null;
  // Skip linking the quote's images back to the accommodation/lodge inventory records.
  // The free social copy only needs the images on the quote itself. Defaults to true.
  linkImagesToInventory?: boolean;
}

// Writes every quote-section row (flights, accommodation, transfers, cruise, images…) for a
// single quote id. Sections write to distinct tables/rows and run concurrently.
//
// The one exception is quote_flights: upsertFlightByType (leg_order = 0) and
// replaceConnectingLegs (leg_order > 0) both target that table for a given flight_type. Their
// row predicates never overlap, but upsertFlightByType isn't transactional (select-then-insert),
// so each direction's own leg-0 upsert is kept ordered before that same direction's leg replace.
// Outbound and inbound never touch each other's rows, so the two chains — and every other
// section below — all run concurrently.
async function writeQuoteSections(quoteId: string, parts: QuoteSectionsInput): Promise<void> {
  const {
    outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs,
    primaryAccommodation, transfers, carHires, attractionTickets, loungePasses,
    airportParkings, extraAccommodations, cruiseData, childAges,
    normalizedImages, lodgeId, linkImagesToInventory,
  } = parts;

  const outboundFlightChain = (async () => {
    if (outboundFlight) await newQuoteRepository.upsertFlightByType(quoteId, "outbound", outboundFlight, 0);
    if (outboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(quoteId, "outbound", outboundConnectingLegs);
  })();

  const inboundFlightChain = (async () => {
    if (inboundFlight) await newQuoteRepository.upsertFlightByType(quoteId, "inbound", inboundFlight, 0);
    if (inboundConnectingLegs?.length) await newQuoteRepository.replaceConnectingLegs(quoteId, "inbound", inboundConnectingLegs);
  })();

  const writes: Promise<unknown>[] = [outboundFlightChain, inboundFlightChain];

  if (primaryAccommodation) writes.push(newQuoteRepository.upsertPrimaryAccommodation(quoteId, primaryAccommodation));
  if (transfers !== undefined) writes.push(newQuoteRepository.replaceTransfers(quoteId, transfers));
  if (carHires !== undefined) writes.push(newQuoteRepository.replaceCarHires(quoteId, carHires));
  if (attractionTickets !== undefined) writes.push(newQuoteRepository.replaceAttractionTickets(quoteId, attractionTickets));
  if (loungePasses !== undefined) writes.push(newQuoteRepository.replaceLoungePasses(quoteId, loungePasses));
  if (airportParkings !== undefined) writes.push(newQuoteRepository.replaceAirportParkings(quoteId, airportParkings));
  if (extraAccommodations !== undefined) writes.push(newQuoteRepository.replaceExtraAccommodations(quoteId, extraAccommodations));
  if (cruiseData) writes.push(newQuoteRepository.upsertCruise(quoteId, cruiseData));
  if (childAges !== undefined) writes.push(newQuoteRepository.replaceChildPassengers(quoteId, "quote", childAges));

  if (normalizedImages.length > 0) {
    writes.push(quoteImageRepository.addImages(quoteId, normalizedImages));
    if (linkImagesToInventory !== false) {
      if (primaryAccommodation?.accomodation_id) {
        writes.push(newQuoteRepository.saveImagesToAccommodation(primaryAccommodation.accomodation_id as string, normalizedImages));
      }
      if (lodgeId) {
        writes.push(newQuoteRepository.saveImagesToLodge(lodgeId, normalizedImages));
      }
    }
  }

  await Promise.all(writes);
}

// The subset of a create payload passed straight through to newQuoteRepository.create —
// everything in CreateQuotePayload except the section/relation fields handled separately.
type QuoteBaseFields = Omit<CreateQuotePayload,
  | 'outboundFlight' | 'inboundFlight' | 'outboundConnectingLegs' | 'inboundConnectingLegs'
  | 'primaryAccommodation' | 'images' | 'transfers' | 'carHires' | 'attractionTickets'
  | 'loungePasses' | 'airportParkings' | 'extraAccommodations' | 'childAges'
  | 'cruiseTitle' | 'cruiseLine' | 'shipName' | 'cruiseDate' | 'cabinType' | 'cabinNumber'
  | 'embarkation' | 'debarkation' | 'cruiseExtras' | 'cruiseOnly' | 'preCruiseStay'
  | 'postCruiseStay' | 'cruiseItinerary'
>;

interface FreeSocialCopyRelations extends QuoteSectionsInput {
  tags?: string[];
}

// Duplicates a newly-created quote into its own "free quote" transaction for social posting.
// This mirrors createQuote's own section writes but on a separate transaction/quote row.
// Best-effort and never awaited by the caller — see the fire-and-forget call site below.
async function createFreeSocialCopy(
  quoteFields: QuoteBaseFields,
  relations: FreeSocialCopyRelations,
  txn: Pick<Transaction, 'user_id' | 'is_test' | 'org_id'>,
): Promise<void> {
  const { tags, ...sections } = relations;
  const freeTxn = await transactionRepository.create({ status: 'on_quote', user_id: txn.user_id, is_test: txn.is_test ?? false } as InsertTransaction);
  const freeQ = await newQuoteRepository.create({ ...quoteFields, transaction_id: freeTxn.id, isFreeQuote: true, isQuoteCopy: false });
  await writeQuoteSections(freeQ.id, { ...sections, linkImagesToInventory: false });
  if (tags && Array.isArray(tags) && tags.length > 0) await tagService.addQuoteTags(freeQ.id, tags);
  // Tag the auto-generated free copy with the ORIGINAL transaction's org —
  // freeTxn itself is created without a scope and so has no org of its own.
  syncFreeQuoteEmbedding(freeQ.id, txn.org_id);
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

  async listFreeQuotesPaginated(page: number = 0, pageSize: number = 12, scheduledOnly = false, scheduleFilter = "none", search = "", rangeStart = "", rangeEnd = "", scope: ScopeOrTrusted, unscheduledOnly = false, showOnPortal = false, portalStatus: PortalStatus = "all") {
    return newQuoteRepository.findFreeQuotesPaginated(page, pageSize, scheduledOnly, scheduleFilter, search, rangeStart, rangeEnd, scope, unscheduledOnly, showOnPortal, portalStatus);
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
    // Surface the customer-facing total (sales − discount + service charge) and a per-person
    // figure derived from it, so the detail page displays consistent values regardless of any
    // previously-stored price_per_person.
    return {
      ...q,
      total_price: calcTotalPrice(q.sales_price, q.discounts, q.service_charge).toFixed(2),
      price_per_person: calcPricePerPerson(q.sales_price, q.adult, q.child, q.discounts, q.service_charge),
    };
  },

  async createQuote(data: CreateQuotePayload, scope: ScopeOrTrusted) {
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations,
      childAges,
      cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType, cabinNumber, embarkation, debarkation, cruiseExtras, cruiseOnly, preCruiseStay, postCruiseStay, cruiseItinerary,
      ...quoteFields
    } = data;

    const cruiseData = buildCruiseData(data);

    await assertTransactionInScope(quoteFields.transaction_id, scope);

    const txn = await transactionRepository.findById(quoteFields.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);
    if (scope.orgId && txn.org_id !== scope.orgId) {
      throw new AppError("Transaction not found", 404);
    }

    if (!quoteFields.price_per_person || quoteFields.price_per_person === "0.00" || quoteFields.price_per_person === "0") {
      quoteFields.price_per_person = calcPricePerPerson(quoteFields.sales_price, quoteFields.adult, quoteFields.child, quoteFields.discounts, quoteFields.service_charge);
    }

    // A new quote always starts as 'quoted' unless the caller explicitly set a valid status.
    if (!quoteFields.quote_status) {
      quoteFields.quote_status = 'quoted';
    }

    const q = await newQuoteRepository.create(quoteFields);

    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      await tagService.addQuoteTags(q.id, data.tags);
    }

    if (txn.status !== 'on_quote' && txn.status !== 'on_booking') {
      await transactionRepository.update(txn.id, { status: 'on_quote' });

      // Converting an enquiry into a quote: close out the enquiry's open tasks.
      // Best-effort — must never block quote creation.
      try {
        const enquiry = await enquiryTableRepository.findByTransactionId(txn.id);
        if (enquiry) {
          await taskService.completeByEntity("enquiry", enquiry.id);
        }
      } catch (err) {
        console.error('COMPLETE ENQUIRY TASKS (quote.service) - error:', err);
      }
    }

    const normalizedImages = normalizeUniqueImageUrls(images);

    await writeQuoteSections(q.id, {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs,
      primaryAccommodation, transfers, carHires, attractionTickets, loungePasses,
      airportParkings, extraAccommodations, cruiseData, childAges,
      normalizedImages, lodgeId: quoteFields.lodge_id,
    });

    if (quoteFields.isFreeQuote) {
      syncFreeQuoteEmbedding(q.id, txn.org_id);
    }

    if (!quoteFields.isFreeQuote && !txn.is_test && !quoteFields.not_for_social) {
      // Duplicating into a free social copy is best-effort and its result is never used by
      // the caller — run it off the request path instead of doubling create-quote latency.
      createFreeSocialCopy(
        quoteFields,
        {
          outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs,
          primaryAccommodation, transfers, carHires, attractionTickets, loungePasses,
          airportParkings, extraAccommodations, cruiseData, childAges,
          normalizedImages, tags: data.tags,
        },
        { user_id: txn.user_id, is_test: txn.is_test, org_id: txn.org_id },
      ).catch((err) => {
        console.error('FREE QUOTE (quote.service) - error:', err);
      });
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

    const txn = await transactionRepository.create(
      { status: 'on_quote', user_id: userId } as InsertTransaction,
      scope.orgId !== null ? scope : undefined,
    );
    return newQuoteService.createQuote({ ...data, transaction_id: txn.id, isFreeQuote: true } as CreateQuotePayload, { orgId: null });
  },

  async duplicateQuote(sourceQuoteId: string, data: Partial<CreateQuotePayload>, scope: ScopeOrTrusted) {
    await assertQuoteInScope(sourceQuoteId, scope);

    const sourceQuote = await newQuoteRepository.findById(sourceQuoteId);
    if (!sourceQuote) throw new AppError("Quote not found", 404);

    // The duplicate dialog seeds its form with the source's image URLs, so a
    // submitted `images` array is already the user's final gallery — kept
    // source images included, removed ones absent. Merging the source's images
    // back in would resurrect every removal, so the source gallery is only
    // cloned when the caller sent no `images` field at all.
    const sourceImages = await quoteImageRepository.getByQuoteId(sourceQuoteId);
    const sourceImageUrls = sourceImages.map((image) => image.url).filter((url): url is string => typeof url === "string" && url.length > 0);
    const images = Array.isArray(data.images)
      ? data.images.filter((url): url is string => typeof url === "string" && url.length > 0)
      : sourceImageUrls;

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
      // A duplicate is never primary and always starts as quoted.
      parent_quote_id: sourceQuoteId,
      quote_status: 'quoted',
      images,
      // Caller-supplied tags win, so a copy made through the quote dialog keeps
      // whatever the user edited there; otherwise inherit the source's.
      tags: data.tags ?? sourceDetails?.tags ?? [],
    };

    const newQuote = await newQuoteService.createQuote(payload, scope);

    // The child count comes across via the quote columns, but the individual
    // child ages live in the passengers table — copy them from the source so
    // the duplicate keeps the same children.
    const childAges = (sourceDetails?.passengers || [])
      .filter((p: Record<string, unknown>) => p.type === "child")
      .map((p: Record<string, unknown>) => Number(p.age) || 0);
    if (childAges.length > 0) {
      await newQuoteRepository.replaceChildPassengers(newQuote.id, "quote", childAges);
    }

    return newQuote;
  },

  async updateQuote(id: string, data: UpdateQuotePayload, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);

    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation,
      cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType, cabinNumber,
      embarkation, debarkation, cruiseExtras, cruiseOnly, preCruiseStay, postCruiseStay, cruiseItinerary, lead_source, images, tags, childAges,
      transfers, carHires, attractionTickets, loungePasses, airportParkings, extraAccommodations, deletedImageIds,
      ...quoteFields
    } = data;

    const cruiseData = buildCruiseData(data);

    const quoteData: Partial<InsertQuote> = {};
    const directFields: (keyof InsertQuote)[] = ['holiday_type_id', 'sales_price', 'package_commission', 'travel_date', 'discounts', 'service_charge', 'num_of_nights', 'pets', 'cottage_id', 'lodge_id', 'quote_type', 'deal_type', 'pre_booked_seats', 'flight_meals', 'infant', 'child', 'adult', 'title', 'price_per_person', 'lodge_type', 'transfer_type', 'quote_status', 'main_tour_operator_id', 'quote_ref', 'date_expiry', 'not_for_social'];
    for (const key of directFields) {
      if (key in quoteFields) (quoteData[key] as InsertQuote[typeof key]) = (quoteFields as Record<string, unknown>)[key] as InsertQuote[typeof key];
    }

    if ('date_expiry' in quoteData && quoteData.date_expiry) quoteData.date_expiry = new Date(quoteData.date_expiry as unknown as string);
    else if ('date_expiry' in quoteData && !quoteData.date_expiry) quoteData.date_expiry = null;

    // Defensively reject out-of-enum quote_status values before hitting the DB.
    const VALID_QUOTE_STATUSES = ['quoted', 'in_play', 'lost', 'archived'] as const;
    if ('quote_status' in quoteData && quoteData.quote_status !== undefined) {
      if (!VALID_QUOTE_STATUSES.includes(quoteData.quote_status as typeof VALID_QUOTE_STATUSES[number])) {
        throw new AppError(`Invalid quote_status '${quoteData.quote_status}'. Must be one of: ${VALID_QUOTE_STATUSES.join(', ')}`, 400);
      }
    }

    // Fetch the current row when needed for price calculation or to capture the
    // previous status (lost → active transitions) BEFORE writing.
    const isSettingLost = 'quote_status' in quoteData && quoteData.quote_status === 'lost';
    const needsPrevStatus = 'quote_status' in quoteData && !isSettingLost;
    const needsPriceCalc = 'sales_price' in quoteData || 'adult' in quoteData || 'child' in quoteData || 'discounts' in quoteData || 'service_charge' in quoteData;

    let preUpdateRow: Quote | undefined;
    if (needsPriceCalc || needsPrevStatus) {
      preUpdateRow = await newQuoteRepository.findById(id);
    }

    if (needsPriceCalc && preUpdateRow) {
      quoteData.price_per_person = calcPricePerPerson(quoteData.sales_price ?? preUpdateRow.sales_price, quoteData.adult ?? preUpdateRow.adult, quoteData.child ?? preUpdateRow.child, quoteData.discounts ?? preUpdateRow.discounts, quoteData.service_charge ?? preUpdateRow.service_charge);
    }

    // Marking a quote lost always succeeds — even the primary quote with active
    // sibling quotes. We simply set this quote to 'lost' (no sibling check).
    const prevStatus = preUpdateRow?.quote_status ?? null;

    let q;
    if (Object.keys(quoteData).length > 0) {
      q = await newQuoteRepository.update(id, quoteData);
      if (!q) throw new AppError("Quote not found", 404);
    } else {
      q = preUpdateRow ?? await newQuoteRepository.findById(id);
      if (!q) throw new AppError("Quote not found", 404);
    }

    if (quoteData.quote_status === 'lost' && q.transaction_id) {
      // NOTE(Phase 3): board visibility will derive from status; is_active toggling is kept for now.
      await newQuoteRepository.update(id, { is_active: false });
      await transactionRepository.update(q.transaction_id, { is_active: false });
    } else if (prevStatus === 'lost' && 'quote_status' in quoteData && quoteData.quote_status !== 'lost' && q.transaction_id) {
      // Quote is moving off lost — reactivate it.
      // Note: date_expiry is display-only; no forced bump needed here.
      await newQuoteRepository.update(id, { is_active: true });
      // Reactivate the transaction only when no other sibling quote is still lost.
      const lostSiblings = await newQuoteRepository.findLostSiblings(q.transaction_id, id);
      if (lostSiblings.length === 0) {
        await transactionRepository.update(q.transaction_id, { is_active: true });
      }
    }

    if (lead_source !== undefined && q.transaction_id) {
      await transactionRepository.update(q.transaction_id, { lead_source: lead_source as any });
    }

    // Deletions must finish BEFORE the images-add write below: quoteImageRepository.addImages
    // decides the new primary flag from the current "does this quote already have a primary
    // image" state, so removing an existing primary has to land first or the two writes can
    // race into either two primaries or zero. The deletions themselves are independent rows,
    // so they run concurrently among each other; reuse quoteImageService.deleteImage so the
    // reference-counted S3 cleanup (quote_images/accommodation_images/lodge_images/deal_images)
    // still applies.
    if (deletedImageIds && deletedImageIds.length > 0) {
      await Promise.all(deletedImageIds.map((imageId) => quoteImageService.deleteImage(id, imageId)));
    }

    // Section writes below target distinct tables/rows and run concurrently — same
    // pattern as writeQuoteSections() above. The one ordering dependency kept is
    // per-direction: upsertFlightByType (leg_order = 0) isn't transactional
    // (select-then-insert), so each direction's leg-0 upsert stays ordered before
    // that same direction's connecting-leg replace. Outbound/inbound and every
    // other section never touch each other's rows, so they all run together.
    const outboundFlightChain = (async () => {
      if (outboundFlight) await newQuoteRepository.upsertFlightByType(id, "outbound", outboundFlight, 0);
      if (outboundConnectingLegs !== undefined) await newQuoteRepository.replaceConnectingLegs(id, "outbound", outboundConnectingLegs || []);
    })();

    const inboundFlightChain = (async () => {
      if (inboundFlight) await newQuoteRepository.upsertFlightByType(id, "inbound", inboundFlight, 0);
      if (inboundConnectingLegs !== undefined) await newQuoteRepository.replaceConnectingLegs(id, "inbound", inboundConnectingLegs || []);
    })();

    const writes: Promise<unknown>[] = [outboundFlightChain, inboundFlightChain];

    if (primaryAccommodation) writes.push(newQuoteRepository.upsertPrimaryAccommodation(id, primaryAccommodation));
    if (transfers !== undefined) writes.push(newQuoteRepository.replaceTransfers(id, transfers));
    if (carHires !== undefined) writes.push(newQuoteRepository.replaceCarHires(id, carHires));
    if (attractionTickets !== undefined) writes.push(newQuoteRepository.replaceAttractionTickets(id, attractionTickets));
    if (loungePasses !== undefined) writes.push(newQuoteRepository.replaceLoungePasses(id, loungePasses));
    if (airportParkings !== undefined) writes.push(newQuoteRepository.replaceAirportParkings(id, airportParkings));
    if (extraAccommodations !== undefined) writes.push(newQuoteRepository.replaceExtraAccommodations(id, extraAccommodations));
    if (cruiseData) writes.push(newQuoteRepository.upsertCruise(id, cruiseData));
    if (childAges !== undefined) writes.push(newQuoteRepository.replaceChildPassengers(id, "quote", childAges));
    if (tags !== undefined) writes.push(tagService.updateQuoteTags(id, tags));

    if (images && images.length > 0) {
      const normalizedUpdateImages = normalizeUniqueImageUrls(images);
      writes.push(quoteImageRepository.addImages(id, normalizedUpdateImages));
      if (primaryAccommodation?.accomodation_id) writes.push(newQuoteRepository.saveImagesToAccommodation(primaryAccommodation.accomodation_id as string, normalizedUpdateImages));
      // q is already resolved above (either from the update or the pre-fetch), so
      // reading q.lodge_id here is safe even though it now runs inside Promise.all.
      const lodgeId = (quoteData.lodge_id as string | undefined) || (q?.lodge_id as string | undefined);
      if (lodgeId) writes.push(newQuoteRepository.saveImagesToLodge(lodgeId, normalizedUpdateImages));
    }

    await Promise.all(writes);

    if (q.isFreeQuote) {
      const txn = await transactionRepository.findById(q.transaction_id);
      syncFreeQuoteEmbedding(id, txn?.org_id);
    }

    // Skip the expensive multi-join findWithDetails() here — the controller just
    // forwards this return value in the response, and the only client consumer
    // (the quote edit dialog's update mutation) ignores the resolved data and
    // relies on its own query invalidation/refetch instead. Re-fetch the bare
    // row so the response still reflects the is_active/status writes above,
    // without paying for the full detail joins.
    return (await newQuoteRepository.findById(id)) ?? q;
  },

  async deleteQuote(id: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(id, scope);
    const existing = await newQuoteRepository.findById(id);
    if (!existing) throw new AppError("Quote not found", 404);
    await newQuoteRepository.remove(id);
    if (existing.isFreeQuote) {
      removeFreeQuoteEmbedding(id);
    }
    // Deleting a quote: close out its open tasks so they don't linger pointing
    // at a deleted quote. Best-effort — must never block the delete.
    try {
      await taskService.completeByEntity("quote", id);
    } catch (err) {
      console.error('COMPLETE QUOTE TASKS (quote.service delete) - error:', err);
    }
  },

  /** Reassign the primary quote for a transaction.
   *
   * The chosen quote (quoteId) becomes isQuoteCopy=false (primary) and the
   * previous primary becomes isQuoteCopy=true. The flip is done atomically in a
   * single DB transaction to preserve the "exactly one false per transaction" invariant.
   *
   * Throws AppError(404) if the quote is not found or not in scope.
   * Throws AppError(400) if the chosen quote is lost or deleted (cannot be primary).
   */
  async setPrimaryQuote(quoteId: string, scope: ScopeOrTrusted) {
    await assertQuoteInScope(quoteId, scope);

    const chosenQuote = await newQuoteRepository.findById(quoteId);
    if (!chosenQuote) throw new AppError("Quote not found", 404);

    if (chosenQuote.quote_status === 'lost' || chosenQuote.quote_status === 'archived') {
      throw new AppError("A lost or archived quote cannot be made primary", 400);
    }
    if (chosenQuote.deleted_at) {
      throw new AppError("A deleted quote cannot be made primary", 400);
    }

    // If this quote is already primary there is nothing to do.
    if (chosenQuote.isQuoteCopy === false) {
      return chosenQuote;
    }

    // A freshly promoted primary gets a fresh 6-day expiry window.
    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
    const newExpiry = new Date(Date.now() + SIX_DAYS_MS);

    // Find the current primary to flip.
    const currentPrimary = await newQuoteRepository.findCurrentPrimary(chosenQuote.transaction_id, quoteId);
    if (!currentPrimary) {
      // No existing primary — just set the chosen quote directly.
      await newQuoteRepository.update(quoteId, { isQuoteCopy: false, date_expiry: newExpiry });
      return newQuoteRepository.findById(quoteId);
    }

    // Atomic flip: old primary → isQuoteCopy=true, chosen → isQuoteCopy=false (with a refreshed expiry).
    await newQuoteRepository.flipPrimary(quoteId, currentPrimary.id, newExpiry);
    return newQuoteRepository.findById(quoteId);
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

