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
    const quoteIds = quotes.map((q) => q.id);
    const [allImages, allCommissions] = await Promise.all([
      quoteImageRepository.findByQuoteIds(quoteIds),
      commissionRepository.findByQuoteIds(quoteIds),
    ]);
    return quotes.map((q) => ({
      ...q,
      images: allImages.filter((img) => img.quoteId === q.id),
      commission: allCommissions.find((c) => c.quoteId === q.id) || null,
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
    if (quoteData.status === "Booked" && !quoteData.bookedAt) {
      quoteData.bookedAt = new Date();
    }
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
    const {
      tourOperator, sales, price, commission, discount, serviceCharge, pricePerPerson,
      accommodationProperty, accommodationBoard, accommodationRoomType, accommodationNotes,
      accommodation: accommodationField,
      boardBasis, roomType,
      outboundFromAirport, outboundToAirport, outboundCarrier, outboundFlightNo, outboundDepart, outboundArrive,
      outboundDepartAirport, outboundDepartDate, outboundDepartTime, outboundArriveAirport, outboundArriveDate, outboundArriveTime,
      inboundFromAirport, inboundToAirport, inboundCarrier, inboundFlightNo, inboundDepart, inboundArrive,
      inboundDepartAirport, inboundDepartDate, inboundDepartTime, inboundArriveAirport, inboundArriveDate, inboundArriveTime,
      ...quoteData
    } = data;

    let quote: Quote | undefined;
    if (Object.keys(quoteData).length > 0) {
      quote = await quoteRepository.update(id, quoteData);
    } else {
      quote = await quoteRepository.findById(id);
    }
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }

    const resolvedAccProperty = accommodationProperty ?? accommodationField;
    const resolvedBoard = accommodationBoard ?? boardBasis;
    const resolvedRoomType = accommodationRoomType ?? roomType;

    const existingAccommodation = await accommodationRepository.findByQuoteId(id);
    if (resolvedAccProperty !== undefined || resolvedBoard !== undefined || resolvedRoomType !== undefined) {
      const accData: any = {};
      if (resolvedAccProperty !== undefined) accData.property = resolvedAccProperty;
      if (resolvedBoard !== undefined) accData.board = resolvedBoard;
      if (resolvedRoomType !== undefined) accData.roomType = resolvedRoomType;
      if (accommodationNotes !== undefined) accData.notes = accommodationNotes;
      if (existingAccommodation) {
        await accommodationRepository.update(existingAccommodation.id, accData);
      } else {
        await accommodationRepository.create({
          quoteId: id,
          property: resolvedAccProperty || "",
          board: resolvedBoard || "",
          roomType: resolvedRoomType || "",
          notes: accommodationNotes || "",
        });
      }
    }

    const resolvedOutFrom = outboundFromAirport ?? outboundDepartAirport;
    const resolvedOutTo = outboundToAirport ?? outboundArriveAirport;
    const resolvedOutDepart = outboundDepart ?? (outboundDepartDate ? new Date(`${outboundDepartDate}T${outboundDepartTime || "00:00"}`) : undefined);
    const resolvedOutArrive = outboundArrive ?? (outboundArriveDate ? new Date(`${outboundArriveDate}T${outboundArriveTime || "00:00"}`) : undefined);
    const resolvedInFrom = inboundFromAirport ?? inboundDepartAirport;
    const resolvedInTo = inboundToAirport ?? inboundArriveAirport;
    const resolvedInDepart = inboundDepart ?? (inboundDepartDate ? new Date(`${inboundDepartDate}T${inboundDepartTime || "00:00"}`) : undefined);
    const resolvedInArrive = inboundArrive ?? (inboundArriveDate ? new Date(`${inboundArriveDate}T${inboundArriveTime || "00:00"}`) : undefined);

    const existingFlights = await flightRepository.findByQuoteId(id);
    const outbound = existingFlights.find(f => f.direction === "outbound");
    const inbound = existingFlights.find(f => f.direction === "inbound");
    if (resolvedOutFrom !== undefined || resolvedOutTo !== undefined || outboundCarrier !== undefined || resolvedOutDepart !== undefined) {
      const flData: any = {};
      if (resolvedOutFrom !== undefined) flData.fromAirport = resolvedOutFrom;
      if (resolvedOutTo !== undefined) flData.toAirport = resolvedOutTo;
      if (outboundCarrier !== undefined) flData.carrier = outboundCarrier;
      if (outboundFlightNo !== undefined) flData.flightNo = outboundFlightNo;
      if (resolvedOutDepart !== undefined) flData.depart = resolvedOutDepart;
      if (resolvedOutArrive !== undefined) flData.arrive = resolvedOutArrive;
      if (outbound) {
        await flightRepository.update(outbound.id, flData);
      } else {
        await flightRepository.create({
          quoteId: id, direction: "outbound",
          fromAirport: resolvedOutFrom || "", toAirport: resolvedOutTo || "",
          carrier: outboundCarrier || "", flightNo: outboundFlightNo || "",
          depart: resolvedOutDepart || new Date(), arrive: resolvedOutArrive || new Date(),
        });
      }
    }
    if (resolvedInFrom !== undefined || resolvedInTo !== undefined || inboundCarrier !== undefined || resolvedInDepart !== undefined) {
      const flData: any = {};
      if (resolvedInFrom !== undefined) flData.fromAirport = resolvedInFrom;
      if (resolvedInTo !== undefined) flData.toAirport = resolvedInTo;
      if (inboundCarrier !== undefined) flData.carrier = inboundCarrier;
      if (inboundFlightNo !== undefined) flData.flightNo = inboundFlightNo;
      if (resolvedInDepart !== undefined) flData.depart = resolvedInDepart;
      if (resolvedInArrive !== undefined) flData.arrive = resolvedInArrive;
      if (inbound) {
        await flightRepository.update(inbound.id, flData);
      } else {
        await flightRepository.create({
          quoteId: id, direction: "inbound",
          fromAirport: resolvedInFrom || "", toAirport: resolvedInTo || "",
          carrier: inboundCarrier || "", flightNo: inboundFlightNo || "",
          depart: resolvedInDepart || new Date(), arrive: resolvedInArrive || new Date(),
        });
      }
    }

    const hasCommissionData = price !== undefined || commission !== undefined || tourOperator !== undefined || sales !== undefined || discount !== undefined || serviceCharge !== undefined || pricePerPerson !== undefined;
    if (hasCommissionData) {
      const existing = await commissionRepository.findByQuoteId(id);
      const priceNum = parseFloat(price ?? existing?.price ?? "0") || 0;
      const commissionPercent = parseFloat(commission ?? existing?.commissionPercent ?? "0") || 0;
      const commissionValue = priceNum * (commissionPercent / 100);
      const agentSplitPercent = parseFloat(sales ?? existing?.agentSplitPercent ?? "50") || 50;
      const agentSplitValue = commissionValue * (agentSplitPercent / 100);
      const netToAgency = commissionValue - agentSplitValue;

      const commData = {
        tourOperator: tourOperator ?? existing?.tourOperator ?? "Unknown",
        price: priceNum.toFixed(2),
        commissionPercent: commissionPercent.toFixed(2),
        commissionValue: commissionValue.toFixed(2),
        agentSplitPercent: agentSplitPercent.toFixed(2),
        agentSplitValue: agentSplitValue.toFixed(2),
        netToAgency: netToAgency.toFixed(2),
      };

      if (existing) {
        await commissionRepository.update(existing.id, commData);
      } else {
        await commissionRepository.create({ quoteId: id, ...commData });
      }
    }

    return quote;
  },

  async convertToBooking(id: string, haysReference?: string, tourReference?: string): Promise<Quote> {
    const quote = await quoteRepository.findById(id);
    if (!quote) {
      throw new AppError("Quote not found", 404);
    }
    if (quote.status === "Booked") {
      throw new AppError("Quote is already booked", 400);
    }
    const updated = await quoteRepository.update(id, {
      status: "Booked",
      haysReference: haysReference || null,
      tourReference: tourReference || null,
    });
    if (!updated) {
      throw new AppError("Failed to convert quote to booking", 500);
    }
    return updated;
  },

  async deleteQuote(id: string): Promise<void> {
    await quoteRepository.remove(id);
  },

  async getAllTags(): Promise<string[]> {
    return quoteRepository.findAllUniqueTags();
  },
};
