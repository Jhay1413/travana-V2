import { newQuoteRepository } from "../repositories/newQuote.repository";
import { transactionRepository } from "../repositories/transaction.repository";
import { AppError } from "../utils/error-handler";
import type { InsertQuote } from "@shared/schema";

export const newQuoteService = {
  async listQuotes() {
    return await newQuoteRepository.findAll();
  },

  async listQuotesByTransaction(transactionId: string) {
    return await newQuoteRepository.findByTransactionId(transactionId);
  },

  async listQuotesByStatus(status: string) {
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
    return q;
  },

  async createQuote(data: any) {
    const {
      outboundFlight, inboundFlight, primaryAccommodation,
      ...quoteFields
    } = data;

    const txn = await transactionRepository.findById(quoteFields.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

    const q = await newQuoteRepository.create(quoteFields as InsertQuote);

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

    return q;
  },

  async updateQuote(id: string, data: any) {
    const {
      outboundFlight, inboundFlight, primaryAccommodation,
      cruiseTitle, cruiseLine, shipName, cruiseDate, cabinType,
      embarkation, debarkation, cruiseExtras, cruiseOnly,
      ...quoteFields
    } = data;

    const quoteData: Partial<InsertQuote> = {};
    const directFields = [
      'holiday_type_id', 'sales_price', 'package_commission', 'travel_date',
      'discounts', 'service_charge', 'num_of_nights', 'pets', 'cottage_id',
      'lodge_id', 'quote_type', 'deal_type', 'pre_booked_seats', 'flight_meals',
      'infant', 'child', 'adult', 'title', 'price_per_person', 'lodge_type',
      'transfer_type', 'quote_status', 'main_tour_operator_id', 'quote_ref',
    ];
    for (const key of directFields) {
      if (key in quoteFields) {
        (quoteData as any)[key] = quoteFields[key];
      }
    }

    const q = await newQuoteRepository.update(id, quoteData);
    if (!q) throw new AppError("Quote not found", 404);

    if (outboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "outbound", outboundFlight);
    }
    if (inboundFlight) {
      await newQuoteRepository.upsertFlightByType(id, "inbound", inboundFlight);
    }
    if (primaryAccommodation) {
      await newQuoteRepository.upsertPrimaryAccommodation(id, primaryAccommodation);
    }

    return await newQuoteRepository.findWithDetails(id);
  },

  async deleteQuote(id: string) {
    await newQuoteRepository.remove(id);
  },

  async addFlight(quoteId: string, data: any) {
    return await newQuoteRepository.addFlight({ ...data, quote_id: quoteId });
  },

  async updateFlight(flightId: string, data: any) {
    return await newQuoteRepository.updateFlight(flightId, data);
  },

  async removeFlight(flightId: string) {
    await newQuoteRepository.removeFlight(flightId);
  },

  async addAccommodation(quoteId: string, data: any) {
    return await newQuoteRepository.addAccommodation({ ...data, quote_id: quoteId });
  },

  async updateAccommodation(accommodationId: string, data: any) {
    return await newQuoteRepository.updateAccommodation(accommodationId, data);
  },

  async removeAccommodation(accommodationId: string) {
    await newQuoteRepository.removeAccommodation(accommodationId);
  },

  async addTransfer(quoteId: string, data: any) {
    return await newQuoteRepository.addTransfer({ ...data, quote_id: quoteId });
  },

  async removeTransfer(transferId: string) {
    await newQuoteRepository.removeTransfer(transferId);
  },

  async addCarHire(quoteId: string, data: any) {
    return await newQuoteRepository.addCarHire({ ...data, quote_id: quoteId });
  },

  async removeCarHire(carHireId: string) {
    await newQuoteRepository.removeCarHire(carHireId);
  },

  async addAttractionTicket(quoteId: string, data: any) {
    return await newQuoteRepository.addAttractionTicket({ ...data, quote_id: quoteId });
  },

  async removeAttractionTicket(ticketId: string) {
    await newQuoteRepository.removeAttractionTicket(ticketId);
  },

  async addLoungePass(quoteId: string, data: any) {
    return await newQuoteRepository.addLoungePass({ ...data, quote_id: quoteId });
  },

  async removeLoungePass(loungePassId: string) {
    await newQuoteRepository.removeLoungePass(loungePassId);
  },

  async addAirportParking(quoteId: string, data: any) {
    return await newQuoteRepository.addAirportParking({ ...data, quote_id: quoteId });
  },

  async removeAirportParking(parkingId: string) {
    await newQuoteRepository.removeAirportParking(parkingId);
  },

  async addPassenger(quoteId: string, data: any) {
    return await newQuoteRepository.addPassenger({ ...data, quote_id: quoteId });
  },

  async removePassenger(passengerId: string) {
    await newQuoteRepository.removePassenger(passengerId);
  },
};
