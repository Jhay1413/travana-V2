import { newQuoteRepository } from "../repositories/newQuote.repository";
import { transactionRepository } from "../repositories/transaction.repository";
import { quoteImageRepository } from "../repositories/quote-image.repository";
import { tagService } from "./tag.service";
import { AppError } from "../utils/error-handler";
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

interface QuoteRelationData {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  outboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  inboundConnectingLegs?: Partial<InsertQuoteFlight>[];
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  images?: string[];
  tags?: string[];
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
};

function normalizeUniqueImageUrls(images: string[] | undefined): string[] {
  if (!Array.isArray(images)) return [];
  return images
    .map((url) => (typeof url === "string" ? url.trim() : ""))
    .filter((url) => url.length > 0)
    .filter((url, index, arr) => arr.indexOf(url) === index);
}

export const newQuoteService = {
  async listQuotes() {
    return await newQuoteRepository.findAll();
  },

  async listQuotesByTransaction(transactionId: string) {
    return await newQuoteRepository.findByTransactionId(transactionId);
  },

  async listQuotesByStatus(status: Quote['quote_status']) {
    return await newQuoteRepository.findByStatus(status);
  },

  async listFreeQuotesPaginated(page: number = 0, pageSize: number = 12) {
    return await newQuoteRepository.findFreeQuotesPaginated(page, pageSize);
  },

  async getQuoteById(id: string) {
    const q = await newQuoteRepository.findById(id);
    if (!q) throw new AppError("Quote not found", 404);
    return q;
  },

  async getQuoteWithDetails(id: string) {
    const q = await newQuoteRepository.findWithDetails(id);
    console.log(q)
    if (!q) throw new AppError("Quote not found", 404);
    console.log('🔍 SERVICE - Quote details includes images:', q.images?.length || 0);
    return q;
  },

  async createQuote(data: CreateQuotePayload) {
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation, images,
      ...quoteFields
    } = data;

    console.log('🔍 CREATE QUOTE - outboundConnectingLegs:', JSON.stringify(outboundConnectingLegs));
    console.log('🔍 CREATE QUOTE - inboundConnectingLegs:', JSON.stringify(inboundConnectingLegs));

    const txn = await transactionRepository.findById(quoteFields.transaction_id);
    if (!txn)  throw new AppError("Transaction not found", 404);

    const q = await newQuoteRepository.create(quoteFields);

    // Process tags if provided
    if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
      await tagService.addQuoteTags(q.id, data.tags);
    }

    if (txn.status !== 'on_quote' && txn.status !== 'on_booking') {
      await transactionRepository.update(txn.id, { status: 'on_quote' });
    }

    if (outboundFlight) {
      await newQuoteRepository.upsertFlightByType(q.id, "outbound", outboundFlight, 0);
    }
    if (inboundFlight) {
      await newQuoteRepository.upsertFlightByType(q.id, "inbound", inboundFlight, 0);
    }
    if (outboundConnectingLegs?.length) {
      await newQuoteRepository.replaceConnectingLegs(q.id, "outbound", outboundConnectingLegs);
    }
    if (inboundConnectingLegs?.length) {
      await newQuoteRepository.replaceConnectingLegs(q.id, "inbound", inboundConnectingLegs);
    }
    if (primaryAccommodation) {
      await newQuoteRepository.upsertPrimaryAccommodation(q.id, primaryAccommodation);
    }

    const normalizedImages = normalizeUniqueImageUrls(images);

    if (normalizedImages.length > 0) {
      console.log(`📸 Adding ${normalizedImages.length} images to new quote ${q.id}`);
      await quoteImageRepository.addImages(q.id, normalizedImages);

      // Persist images to accommodation_images table for default image lookup
      if (primaryAccommodation?.accomodation_id) {
        await newQuoteRepository.saveImagesToAccommodation(
          primaryAccommodation.accomodation_id as string,
          normalizedImages
        );
      }

      // Persist images to lodge_images table for default image lookup
      if (quoteFields.lodge_id) {
        await newQuoteRepository.saveImagesToLodge(quoteFields.lodge_id, normalizedImages);
      }
    }

    // Automatically create a free quote copy (no client, no agent) for every new quote
    if (!quoteFields.isFreeQuote) {
      try {
        const freeTxn = await transactionRepository.create({
          status: 'on_quote',
          user_id: txn.user_id,
        } as InsertTransaction);

        const freeQ = await newQuoteRepository.create({
          ...quoteFields,
          transaction_id: freeTxn.id,
          isFreeQuote: true,
          isQuoteCopy: false,
        });

        if (outboundFlight) {
          await newQuoteRepository.upsertFlightByType(freeQ.id, "outbound", outboundFlight, 0);
        }
        if (inboundFlight) {
          await newQuoteRepository.upsertFlightByType(freeQ.id, "inbound", inboundFlight, 0);
        }
        if (outboundConnectingLegs?.length) {
          await newQuoteRepository.replaceConnectingLegs(freeQ.id, "outbound", outboundConnectingLegs);
        }
        if (inboundConnectingLegs?.length) {
          await newQuoteRepository.replaceConnectingLegs(freeQ.id, "inbound", inboundConnectingLegs);
        }
        if (primaryAccommodation) {
          await newQuoteRepository.upsertPrimaryAccommodation(freeQ.id, primaryAccommodation);
        }
        if (normalizedImages.length > 0) {
          await quoteImageRepository.addImages(freeQ.id, normalizedImages);
        }
        if (data.tags && Array.isArray(data.tags) && data.tags.length > 0) {
          await tagService.addQuoteTags(freeQ.id, data.tags);
        }
      } catch (err) {
        console.error('🆓 FREE QUOTE (newQuote.service) - error:', err);
      }
    }

    return q;
  },

  async duplicateQuote(sourceQuoteId: string, data: Partial<CreateQuotePayload>) {
    const sourceQuote = await newQuoteRepository.findById(sourceQuoteId);
    if (!sourceQuote) {
      throw new AppError("Quote not found", 404);
    }

    const sourceImages = await quoteImageRepository.getByQuoteId(sourceQuoteId);
    const sourceImageUrls = sourceImages
      .map((image) => image.url)
      .filter((url): url is string => typeof url === "string" && url.length > 0);

    const requestedImageUrls = Array.isArray(data.images)
      ? data.images.filter((url): url is string => typeof url === "string" && url.length > 0)
      : [];

    const mergedImages = [...sourceImageUrls, ...requestedImageUrls].filter(
      (url, index, arr) => arr.indexOf(url) === index,
    );

    const {
      id: _sourceId,
      date_created: _sourceCreatedAt,
      transaction_id: _ignoredTransactionId,
      ...sourceInsertData
    } = sourceQuote;

    const payload: CreateQuotePayload = {
      ...(sourceInsertData as InsertQuote),
      ...(data as Partial<InsertQuote>),
      transaction_id: sourceQuote.transaction_id,
      isQuoteCopy: true,
      images: mergedImages,
    };

    return await newQuoteService.createQuote(payload);
  },

  async updateQuote(id: string, data: UpdateQuotePayload) {
    console.log('🔍 QUOTE UPDATE - ID:', id);
    console.log('🔍 QUOTE UPDATE - Received data:', JSON.stringify(data, null, 2));
    console.log('📸 QUOTE UPDATE - Images in payload:', data.images, 'Length:', data.images?.length || 0);
    
    const {
      outboundFlight, inboundFlight, outboundConnectingLegs, inboundConnectingLegs, primaryAccommodation,
      cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType,
      embarkation, debarkation, cruiseExtras, cruiseOnly,
      lead_source,
      images,
      ...quoteFields
    } = data;

    const quoteData: Partial<InsertQuote> = {};
    const directFields: (keyof InsertQuote)[] = [
      'holiday_type_id', 'sales_price', 'package_commission', 'travel_date',
      'discounts', 'service_charge', 'num_of_nights', 'pets', 'cottage_id',
      'lodge_id', 'quote_type', 'deal_type', 'pre_booked_seats', 'flight_meals',
      'infant', 'child', 'adult', 'title', 'price_per_person', 'lodge_type',
      'transfer_type', 'quote_status', 'main_tour_operator_id', 'quote_ref',
    ];
    for (const key of directFields) {
      if (key in quoteFields) {
        (quoteData[key] as InsertQuote[typeof key]) = (quoteFields as Record<string, unknown>)[key] as InsertQuote[typeof key];
      }
    }

    console.log('🔍 QUOTE UPDATE - Quote data to update:', quoteData);
    console.log('🔍 QUOTE UPDATE - Flight updates:', { outboundFlight, inboundFlight });
    console.log('🔍 QUOTE UPDATE - Accommodation update:', primaryAccommodation);

    // Only update quote table if there are fields to update
    let q;
    if (Object.keys(quoteData).length > 0) {
      q = await newQuoteRepository.update(id, quoteData);
      if (!q) throw new AppError("Quote not found", 404);
    } else {
      // If no quote fields to update, just verify quote exists
      q = await newQuoteRepository.findById(id);
      if (!q) throw new AppError("Quote not found", 404);
    }

    // Update lead_source on the transaction table
    if (lead_source !== undefined && q.transaction_id) {
      await transactionRepository.update(q.transaction_id, { lead_source: lead_source as any });
    }

    if (outboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "outbound", outboundFlight, 0);
    }
    if (inboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "inbound", inboundFlight, 0);
    }
    if (outboundConnectingLegs !== undefined) {
      await newQuoteRepository.replaceConnectingLegs(id, "outbound", outboundConnectingLegs || []);
    }
    if (inboundConnectingLegs !== undefined) {
      await newQuoteRepository.replaceConnectingLegs(id, "inbound", inboundConnectingLegs || []);
    }
    if (primaryAccommodation) {
      await newQuoteRepository.upsertPrimaryAccommodation(id, primaryAccommodation);
    }

    if (images && images.length > 0) {
      const normalizedUpdateImages = normalizeUniqueImageUrls(images);
      console.log(`📸 Adding ${normalizedUpdateImages.length} images to quote ${id}`);
      await quoteImageRepository.addImages(id, normalizedUpdateImages);

      // Persist images to accommodation_images if accommodation is known
      if (primaryAccommodation?.accomodation_id) {
        await newQuoteRepository.saveImagesToAccommodation(
          primaryAccommodation.accomodation_id as string,
          normalizedUpdateImages
        );
      }

      // Persist images to lodge_images using the quote's current lodge_id
      const lodgeId = (quoteData.lodge_id as string | undefined) || (q?.lodge_id as string | undefined);
      if (lodgeId) {
        await newQuoteRepository.saveImagesToLodge(lodgeId, normalizedUpdateImages);
      }
    }

    return await newQuoteRepository.findWithDetails(id);
  },

  async deleteQuote(id: string) {
    await newQuoteRepository.remove(id);
  },

  async addFlight(quoteId: string, data: Omit<InsertQuoteFlight, 'quote_id'>) {
    return await newQuoteRepository.addFlight({ ...data, quote_id: quoteId });
  },

  async updateFlight(flightId: string, data: Partial<InsertQuoteFlight>) {
    return await newQuoteRepository.updateFlight(flightId, data);
  },

  async removeFlight(flightId: string) {
    await newQuoteRepository.removeFlight(flightId);
  },

  async addAccommodation(quoteId: string, data: Omit<InsertQuoteAccomodation, 'quote_id'>) {
    return await newQuoteRepository.addAccommodation({ ...data, quote_id: quoteId });
  },

  async updateAccommodation(accommodationId: string, data: Partial<InsertQuoteAccomodation>) {
    return await newQuoteRepository.updateAccommodation(accommodationId, data);
  },

  async removeAccommodation(accommodationId: string) {
    await newQuoteRepository.removeAccommodation(accommodationId);
  },

  async addTransfer(quoteId: string, data: Omit<InsertQuoteTransfer, 'quote_id'>) {
    return await newQuoteRepository.addTransfer({ ...data, quote_id: quoteId });
  },

  async removeTransfer(transferId: string) {
    await newQuoteRepository.removeTransfer(transferId);
  },

  async addCarHire(quoteId: string, data: Omit<InsertQuoteCarHire, 'quote_id'>) {
    return await newQuoteRepository.addCarHire({ ...data, quote_id: quoteId });
  },

  async removeCarHire(carHireId: string) {
    await newQuoteRepository.removeCarHire(carHireId);
  },

  async addAttractionTicket(quoteId: string, data: Omit<InsertQuoteAttractionTicket, 'quote_id'>) {
    return await newQuoteRepository.addAttractionTicket({ ...data, quote_id: quoteId });
  },

  async removeAttractionTicket(ticketId: string) {
    await newQuoteRepository.removeAttractionTicket(ticketId);
  },

  async addLoungePass(quoteId: string, data: Omit<InsertQuoteLoungePass, 'quote_id'>) {
    return await newQuoteRepository.addLoungePass({ ...data, quote_id: quoteId });
  },

  async removeLoungePass(loungePassId: string) {
    await newQuoteRepository.removeLoungePass(loungePassId);
  },

  async addAirportParking(quoteId: string, data: Omit<InsertQuoteAirportParking, 'quote_id'>) {
    return await newQuoteRepository.addAirportParking({ ...data, quote_id: quoteId });
  },

  async removeAirportParking(parkingId: string) {
    await newQuoteRepository.removeAirportParking(parkingId);
  },

  async addPassenger(quoteId: string, data: Omit<InsertPassenger, 'quote_id'>) {
    return await newQuoteRepository.addPassenger({ ...data, quote_id: quoteId });
  },

  async removePassenger(passengerId: string) {
    await newQuoteRepository.removePassenger(passengerId);
  },

  // Tag management
  async updateQuoteTags(quoteId: string, tagNames: string[]) {
    await tagService.updateQuoteTags(quoteId, tagNames);
  },

  async getQuoteTags(quoteId: string) {
    return await tagService.getQuoteTags(quoteId);
  },
};
