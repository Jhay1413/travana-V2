import { quoteRepository } from "../repositories/quote.repository";
import { accommodationRepository } from "../repositories/accommodation.repository";
import { flightRepository } from "../repositories/flight.repository";
import { commissionRepository } from "../repositories/commission.repository";
import { quoteImageRepository } from "../repositories/quoteImage.repository";
import { noteRepository } from "../repositories/note.repository";
import { clientRepository } from "../repositories/client.repository";
import { userRepository } from "../repositories/user.repository";
import { AppError } from "../utils/error-handler";
import type { Quote, InsertQuote, QuoteFullDetails } from "../types/quote";

export const quoteService = {
  async listQuotes() {
    const quotes = await quoteRepository.findAll();
    return await this._attachImages(quotes);
  },

  async listQuotesByClient(clientId: string) {
    const quotes = await quoteRepository.findByClientId(clientId);
    return await this._attachImages(quotes);
  },

  async listQuotesByStatus(status: string) {
    const quotes = await quoteRepository.findByStatus(status);
    return await this._attachImages(quotes);
  },

  async _attachImages(quotes: Quote[]) {
    if (quotes.length === 0) return quotes;
    const allImages = await Promise.all(
      quotes.map((q) => quoteImageRepository.findByQuoteId(q.id))
    );
    return quotes.map((q, i) => ({
      ...q,
      images: allImages[i] || [],
    }));
  },

  async getQuoteById(id: string): Promise<Quote> {
    const quote = await quoteRepository.findById(id);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }
    return quote;
  },

  async getQuoteFullDetails(id: string): Promise<QuoteFullDetails> {
    const quote = await quoteRepository.findById(id);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }

    const [accommodation, flights, commission, images, notes, client, owner] =
      await Promise.all([
        accommodationRepository.findByQuoteId(id),
        flightRepository.findByQuoteId(id),
        commissionRepository.findByQuoteId(id),
        quoteImageRepository.findByQuoteId(id),
        noteRepository.findByQuoteId(id),
        clientRepository.findById(quote.clientId),
        userRepository.findById(quote.userId),
      ]);

    return {
      ...quote,
      accommodation,
      flights,
      commission,
      images,
      notes,
      client,
      owner,
    };
  },

  async createQuote(data: InsertQuote): Promise<Quote> {
    const quote = await quoteRepository.create(data);
    return quote;
  },

  async updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote> {
    const quote = await quoteRepository.update(id, data);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }
    return quote;
  },

  async deleteQuote(id: string): Promise<void> {
    await quoteRepository.remove(id);
  },
};
