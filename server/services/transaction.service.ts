import { transactionRepository } from "../repositories/transaction.repository";
import { enquiryTableRepository } from "../repositories/enquiryTable.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { bookingRepository } from "../repositories/booking.repository";
import { AppError } from "../utils/error-handler";
import type { InsertTransaction } from "@shared/schema";
import { db } from "../config/database";
import { transaction, enquiry_table, quote, booking, quote_flights, quote_accomodation, booking_flights, booking_accomodation } from "@shared/schema";
import { eq } from "drizzle-orm";

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

  async createTransactionWithEnquiry(transactionData: InsertTransaction, enquiryData: any) {
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
        await enquiryTableRepository.addPassenger(enquiry.id, p.type, p.age);
      }
    }

    return { transaction: txn, enquiry };
  },

  async createTransactionWithQuote(transactionData: InsertTransaction, quoteData: any) {
    const { outboundFlight, inboundFlight, primaryAccommodation, ...quoteFields } = quoteData;

    return await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_quote',
      }).returning();

      const [q] = await tx.insert(quote).values({
        ...quoteFields,
        transaction_id: txn.id,
      }).returning();

      if (outboundFlight && (outboundFlight.departing_airport_id || outboundFlight.arrival_airport_id)) {
        await tx.insert(quote_flights).values({
          ...outboundFlight,
          quote_id: q.id,
          flight_type: 'outbound',
        });
      }
      if (inboundFlight && (inboundFlight.departing_airport_id || inboundFlight.arrival_airport_id)) {
        await tx.insert(quote_flights).values({
          ...inboundFlight,
          quote_id: q.id,
          flight_type: 'inbound',
        });
      }
      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        await tx.insert(quote_accomodation).values({
          ...primaryAccommodation,
          quote_id: q.id,
          is_primary: true,
        });
      }

      return { transaction: txn, quote: q };
    });
  },

  async createTransactionWithBooking(transactionData: InsertTransaction, bookingData: any) {
    const { outboundFlight, inboundFlight, primaryAccommodation, ...bookingFields } = bookingData;

    return await db.transaction(async (tx) => {
      const [txn] = await tx.insert(transaction).values({
        ...transactionData,
        status: 'on_booking',
      }).returning();

      const [b] = await tx.insert(booking).values({
        ...bookingFields,
        transaction_id: txn.id,
        booking_status: 'BOOKED',
      }).returning();

      if (outboundFlight && (outboundFlight.departing_airport_id || outboundFlight.arrival_airport_id)) {
        await tx.insert(booking_flights).values({
          ...outboundFlight,
          booking_id: b.id,
          flight_type: 'outbound',
        });
      }
      if (inboundFlight && (inboundFlight.departing_airport_id || inboundFlight.arrival_airport_id)) {
        await tx.insert(booking_flights).values({
          ...inboundFlight,
          booking_id: b.id,
          flight_type: 'inbound',
        });
      }
      if (primaryAccommodation && primaryAccommodation.accomodation_id) {
        await tx.insert(booking_accomodation).values({
          ...primaryAccommodation,
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
