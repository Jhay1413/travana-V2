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

  async createQuote(data: InsertQuote) {
    const txn = await transactionRepository.findById(data.transaction_id);
    if (!txn) throw new AppError("Transaction not found", 404);

    const q = await newQuoteRepository.create(data);

    if (txn.status !== 'on_quote' && txn.status !== 'on_booking') {
      await transactionRepository.update(txn.id, { status: 'on_quote' });
    }

    return q;
  },

  async updateQuote(id: string, data: Partial<InsertQuote>) {
    const q = await newQuoteRepository.update(id, data);
    if (!q) throw new AppError("Quote not found", 404);
    return q;
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
