import { newQuoteRepository } from "../repositories/newQuote.repository";
import { transactionRepository } from "../repositories/transaction.repository";
import { quoteImageRepository } from "../repositories/quote-image.repository";
import { AppError } from "../utils/error-handler";
import type {
  Quote,
  InsertQuote,
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
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  images?: string[];
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

  async getQuoteById(id: string) {
    const q = await newQuoteRepository.findById(id);
    if (!q) throw new AppError("Quote not found", 404);
    return q;
  },

  async getQuoteWithDetails(id: string) {
    const q = await newQuoteRepository.findWithDetails(id);
    if (!q) throw new AppError("Quote not found", 404);
    console.log('🔍 SERVICE - Quote details includes images:', q.images?.length || 0);
    return q;
  },

  async createQuote(data: CreateQuotePayload) {
    const {
      outboundFlight, inboundFlight, primaryAccommodation, images,
      ...quoteFields
    } = data;

    const txn = await transactionRepository.findById(quoteFields.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

    const q = await newQuoteRepository.create(quoteFields);

    if (txn.status !== 'on_quote' && txn.status !== 'on_booking') {
      await transactionRepository.update(txn.id, { status: 'on_quote' });
    }

    if (outboundFlight) {
      await newQuoteRepository.upsertFlightByType(q.id, "outbound", outboundFlight);
    }
    if (inboundFlight) {
      await newQuoteRepository.upsertFlightByType(q.id, "inbound", inboundFlight);
    }
    if (primaryAccommodation) {
      await newQuoteRepository.upsertPrimaryAccommodation(q.id, primaryAccommodation);
    }

    // Add images if provided
    if (images && images.length > 0) {
      console.log(`📸 Adding ${images.length} images to new quote ${q.id}`);
      await quoteImageRepository.addImages(q.id, images);
    }

    return q;
  },

  async updateQuote(id: string, data: UpdateQuotePayload) {
    console.log('🔍 QUOTE UPDATE - ID:', id);
    console.log('🔍 QUOTE UPDATE - Received data:', JSON.stringify(data, null, 2));
    console.log('📸 QUOTE UPDATE - Images in payload:', data.images, 'Length:', data.images?.length || 0);
    
    const {
      outboundFlight, inboundFlight, primaryAccommodation,
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

    const q = await newQuoteRepository.update(id, quoteData);
    if (!q) throw new AppError("Quote not found", 404);

    // Update lead_source on the transaction table
    if (lead_source !== undefined && q.transaction_id) {
      await transactionRepository.update(q.transaction_id, { lead_source: lead_source as any });
    }

    if (outboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "outbound", outboundFlight);
    }
    if (inboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "inbound", inboundFlight);
    }
    if (primaryAccommodation) {
      await newQuoteRepository.upsertPrimaryAccommodation(id, primaryAccommodation);
    }

    // Add images if provided
    if (images && images.length > 0) {
      console.log(`📸 Adding ${images.length} images to quote ${id}`);
      await quoteImageRepository.addImages(id, images);
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
};
