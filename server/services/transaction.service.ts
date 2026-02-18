import { transactionRepository } from "../repositories/transaction.repository";
import { enquiryTableRepository } from "../repositories/enquiryTable.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { bookingRepository } from "../repositories/booking.repository";
import { AppError } from "../utils/error-handler";
import type {
  InsertTransaction,
  InsertEnquiryTable,
  InsertQuote,
  InsertQuoteFlight,
  InsertQuoteAccomodation,
  InsertBooking,
  InsertBookingFlight,
  InsertBookingAccomodation,
} from "@shared/schema";
import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, quote_flights, quote_accomodation, booking_flights, booking_accomodation, quoteImages } from "@shared/schema";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

interface EnquiryPassenger {
  type: string;
  age?: number;
}

interface CreateEnquiryPayload extends InsertEnquiryTable {
  destinations?: string[];
  resorts?: string[];
  boardBases?: string[];
  departureAirports?: string[];
  passengers?: EnquiryPassenger[];
  notes?: string[];
}

interface QuoteRelationPayload extends InsertQuote {
  outboundFlight?: Partial<InsertQuoteFlight>;
  inboundFlight?: Partial<InsertQuoteFlight>;
  primaryAccommodation?: Partial<InsertQuoteAccomodation>;
  images?: string[];
}

interface BookingRelationPayload extends InsertBooking {
  outboundFlight?: Partial<InsertBookingFlight>;
  inboundFlight?: Partial<InsertBookingFlight>;
  primaryAccommodation?: Partial<InsertBookingAccomodation>;
}

function toDateOrNull(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function convertFlightDates(flight: Record<string, unknown>): Record<string, unknown> {
  return {
    ...flight,
    departure_date_time: toDateOrNull(flight.departure_date_time),
    arrival_date_time: toDateOrNull(flight.arrival_date_time),
  };
}

function convertAccommodationDates(accom: Record<string, unknown>): Record<string, unknown> {
  return {
    ...accom,
    check_in_date_time: toDateOrNull(accom.check_in_date_time),
  };
}

export const transactionService = {
  async listTransactions() {
    return await transactionRepository.findAll();
  },

  async listTransactionsByClient(clientId: string) {
    return await transactionRepository.findByClientId(clientId);
  },

  async listTransactionsByAgent(agentId: string) {
    return await transactionRepository.findByAgentId(agentId);
  },

  async getTransactionById(id: string) {
    const txn = await transactionRepository.findById(id);
    if (!txn) throw new AppError("Transaction not found", 404);
    return txn;
  },

  async getTransactionWithDetails(id: string) {
    const txn = await transactionRepository.findWithDetails(id);
    if (!txn) throw new AppError("Transaction not found", 404);
    return txn;
  },

  async createTransaction(data: InsertTransaction) {
    return await transactionRepository.create(data);
  },

  async createTransactionWithEnquiry(transactionData: InsertTransaction, enquiryData: CreateEnquiryPayload) {
    const { destinations, resorts, boardBases, departureAirports, passengers, notes, ...enquiryFields } = enquiryData;

    const txn = await transactionRepository.create({
      ...transactionData,
      status: 'on_enquiry',
    });

    const enquiry = await enquiryTableRepository.create({
      ...enquiryFields,
      transaction_id: txn.id,
    });

    if (destinations?.length) {
      for (const destId of destinations) {
        await enquiryTableRepository.addDestination(enquiry.id, destId);
      }
    }
    if (resorts?.length) {
      for (const resortId of resorts) {
        await enquiryTableRepository.addResort(enquiry.id, resortId);
      }
    }
    if (boardBases?.length) {
      for (const bbId of boardBases) {
        await enquiryTableRepository.addBoardBasis(enquiry.id, bbId);
      }
    }
    if (departureAirports?.length) {
      for (const airportId of departureAirports) {
        await enquiryTableRepository.addDepartureAirport(enquiry.id, airportId);
      }
    }
    if (passengers?.length) {
      for (const p of passengers) {
        await enquiryTableRepository.addPassenger(enquiry.id, p.type, p.age ?? 0);
      }
    }

    return { transaction: txn, enquiry };
  },

  async createTransactionWithQuote(transactionData: InsertTransaction, quoteData: QuoteRelationPayload) {
    const { outboundFlight, inboundFlight, primaryAccommodation, images, ...quoteFields } = quoteData;

    return await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_quote',
      }).returning();

      const quoteValues: Record<string, unknown> = {
        ...quoteFields,
        transaction_id: txn.id,
      };
      if (quoteValues.date_expiry) quoteValues.date_expiry = toDateOrNull(quoteValues.date_expiry);
      if (quoteValues.deleted_at) quoteValues.deleted_at = toDateOrNull(quoteValues.deleted_at);
      const [q] = await tx.insert(quote).values(quoteValues as InsertQuote).returning();

      if (outboundFlight && (outboundFlight.departing_airport_id || outboundFlight.arrival_airport_id)) {
        const converted = convertFlightDates(outboundFlight);
        await tx.insert(quote_flights).values({
          ...converted,
          quote_id: q.id,
          flight_type: 'outbound',
        });
      }
      if (inboundFlight && (inboundFlight.departing_airport_id || inboundFlight.arrival_airport_id)) {
        const converted = convertFlightDates(inboundFlight);
        await tx.insert(quote_flights).values({
          ...converted,
          quote_id: q.id,
          flight_type: 'inbound',
        });
      }
      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        const converted = convertAccommodationDates(primaryAccommodation);
        await tx.insert(quote_accomodation).values({
          ...converted,
          quote_id: q.id,
          is_primary: true,
        });
      }

      if (images && images.length > 0) {
        await tx.insert(quoteImages).values(
          images.map((url, index) => ({
            id: randomUUID(),
            quoteId: q.id,
            url,
            isPrimary: index === 0,
          }))
        );
      }

      return { transaction: txn, quote: q };
    });
  },

  async createTransactionWithBooking(transactionData: InsertTransaction, bookingData: BookingRelationPayload) {
    const { outboundFlight, inboundFlight, primaryAccommodation, ...bookingFields } = bookingData;

    return await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_booking',
      }).returning();

      const bookingValues: Record<string, unknown> = {
        ...bookingFields,
        transaction_id: txn.id,
        booking_status: 'BOOKED',
      };
      if (bookingValues.deleted_at) bookingValues.deleted_at = toDateOrNull(bookingValues.deleted_at);
      const [b] = await tx.insert(booking).values(bookingValues as InsertBooking).returning();

      if (outboundFlight && (outboundFlight.departing_airport_id || outboundFlight.arrival_airport_id)) {
        const converted = convertFlightDates(outboundFlight);
        await tx.insert(booking_flights).values({
          ...converted,
          booking_id: b.id,
          flight_type: 'outbound',
        });
      }
      if (inboundFlight && (inboundFlight.departing_airport_id || inboundFlight.arrival_airport_id)) {
        const converted = convertFlightDates(inboundFlight);
        await tx.insert(booking_flights).values({
          ...converted,
          booking_id: b.id,
          flight_type: 'inbound',
        });
      }
      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        const converted = convertAccommodationDates(primaryAccommodation);
        await tx.insert(booking_accomodation).values({
          ...converted,
          booking_id: b.id,
          is_primary: true,
        });
      }

      return { transaction: txn, booking: b };
    });
  },

  async updateTransaction(id: string, data: Partial<InsertTransaction>) {
    const txn = await transactionRepository.update(id, data);
    if (!txn) throw new AppError("Transaction not found", 404);
    return txn;
  },

  async deleteTransaction(id: string) {
    await transactionRepository.remove(id);
  },

  async getStats() {
    return await transactionRepository.getStats();
  },
};
