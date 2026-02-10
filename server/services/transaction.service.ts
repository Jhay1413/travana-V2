import { transactionRepository } from "../repositories/transaction.repository";
import { enquiryTableRepository } from "../repositories/enquiryTable.repository";
import { newQuoteRepository } from "../repositories/newQuote.repository";
import { bookingRepository } from "../repositories/booking.repository";
import { AppError } from "../utils/error-handler";
import type { InsertTransaction } from "@shared/schema";
import { db } from "../config/database";
import { transaction, enquiry_table } from "@shared/schema";

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
    const txn = await transactionRepository.create({
      ...transactionData,
      status: 'on_enquiry',
    });

    const enquiry = await enquiryTableRepository.create({
      ...enquiryData,
      transaction_id: txn.id,
      holiday_type_id: transactionData.holiday_type_id,
    });

    if (enquiryData.destinations?.length) {
      for (const destId of enquiryData.destinations) {
        await enquiryTableRepository.addDestination(enquiry.id, destId);
      }
    }
    if (enquiryData.resorts?.length) {
      for (const resortId of enquiryData.resorts) {
        await enquiryTableRepository.addResort(enquiry.id, resortId);
      }
    }
    if (enquiryData.boardBases?.length) {
      for (const bbId of enquiryData.boardBases) {
        await enquiryTableRepository.addBoardBasis(enquiry.id, bbId);
      }
    }
    if (enquiryData.departureAirports?.length) {
      for (const airportId of enquiryData.departureAirports) {
        await enquiryTableRepository.addDepartureAirport(enquiry.id, airportId);
      }
    }
    if (enquiryData.passengers?.length) {
      for (const p of enquiryData.passengers) {
        await enquiryTableRepository.addPassenger(enquiry.id, p.type, p.age);
      }
    }

    return { transaction: txn, enquiry };
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
