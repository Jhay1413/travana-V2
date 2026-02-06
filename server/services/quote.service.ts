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
    return await this._attachImagesAndCommissions(quotes);
  },

  async listQuotesByClient(clientId: string) {
    const quotes = await quoteRepository.findByClientId(clientId);
    return await this._attachImagesAndCommissions(quotes);
  },

  async listQuotesByStatus(status: string) {
    const quotes = await quoteRepository.findByStatus(status);
    return await this._attachImagesAndCommissions(quotes);
  },

  async _attachImagesAndCommissions(quotes: Quote[]) {
    if (quotes.length === 0) return quotes;
    const [allImages, allCommissions] = await Promise.all([
      Promise.all(quotes.map((q) => quoteImageRepository.findByQuoteId(q.id))),
      Promise.all(quotes.map((q) => commissionRepository.findByQuoteId(q.id))),
    ]);
    return quotes.map((q, i) => ({
      ...q,
      images: allImages[i] || [],
      commission: allCommissions[i] || null,
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

  async createQuote(data: any): Promise<Quote> {
    const { tourOperator, sales, price, commission, discount, serviceCharge, pricePerPerson, ...quoteData } = data;
    const quote = await quoteRepository.create(quoteData);

    if (price) {
      const priceNum = parseFloat(price) || 0;
      const commissionPercent = parseFloat(commission) || 0;
      const commissionValue = priceNum * (commissionPercent / 100);
      const agentSplitPercent = parseFloat(sales) || 50;
      const agentSplitValue = commissionValue * (agentSplitPercent / 100);
      const netToAgency = commissionValue - agentSplitValue;

      await commissionRepository.create({
        quoteId: quote.id,
        tourOperator,
        price: priceNum.toFixed(2),
        commissionPercent: commissionPercent.toFixed(2),
        commissionValue: commissionValue.toFixed(2),
        agentSplitPercent: agentSplitPercent.toFixed(2),
        agentSplitValue: agentSplitValue.toFixed(2),
        netToAgency: netToAgency.toFixed(2),
      });
    }

    return quote;
  },

  async updateQuote(id: string, data: any): Promise<Quote> {
    const { tourOperator, sales, price, commission, discount, serviceCharge, pricePerPerson, ...quoteData } = data;
    const quote = await quoteRepository.update(id, quoteData);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }

    if (price) {
      const priceNum = parseFloat(price) || 0;
      const commissionPercent = parseFloat(commission) || 0;
      const commissionValue = priceNum * (commissionPercent / 100);
      const agentSplitPercent = parseFloat(sales) || 50;
      const agentSplitValue = commissionValue * (agentSplitPercent / 100);
      const netToAgency = commissionValue - agentSplitValue;

      const existing = await commissionRepository.findByQuoteId(id);
      if (existing) {
        await commissionRepository.update(existing.id, {
          tourOperator: tourOperator || existing.tourOperator,
          price: priceNum.toFixed(2),
          commissionPercent: commissionPercent.toFixed(2),
          commissionValue: commissionValue.toFixed(2),
          agentSplitPercent: agentSplitPercent.toFixed(2),
          agentSplitValue: agentSplitValue.toFixed(2),
          netToAgency: netToAgency.toFixed(2),
        });
      } else {
        await commissionRepository.create({
          quoteId: id,
          tourOperator: tourOperator || "Unknown",
          price: priceNum.toFixed(2),
          commissionPercent: commissionPercent.toFixed(2),
          commissionValue: commissionValue.toFixed(2),
          agentSplitPercent: agentSplitPercent.toFixed(2),
          agentSplitValue: agentSplitValue.toFixed(2),
          netToAgency: netToAgency.toFixed(2),
        });
      }
    }

    return quote;
  },

  async deleteQuote(id: string): Promise<void> {
    await quoteRepository.remove(id);
  },
};
