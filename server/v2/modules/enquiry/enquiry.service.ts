import { enquiryTableRepository } from "./enquiry.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { AppError } from "../../utils/error-handler";
import type { InsertEnquiryTable } from "@shared/schema";
import type { ScopeOrTrusted } from "../../utils/scope-conditions";

async function assertEnquiryInScope(id: string, scope: ScopeOrTrusted) {
  const ok = await enquiryTableRepository.enquiryInScope(id, scope);
  if (!ok) throw new AppError("Enquiry not found", 404);
}

async function assertTransactionInScope(transactionId: string, scope: ScopeOrTrusted) {
  const ok = await enquiryTableRepository.transactionInScope(transactionId, scope);
  if (!ok) throw new AppError("Enquiry not found", 404);
}

export const newEnquiryService = {
  async listEnquiries(scope: ScopeOrTrusted) {
    return enquiryTableRepository.findAll(scope);
  },

  async getEnquiryById(id: string, scope: ScopeOrTrusted) {
    await assertEnquiryInScope(id, scope);
    const enquiry = await enquiryTableRepository.findById(id);
    if (!enquiry) throw new AppError("Enquiry not found", 404);
    return enquiry;
  },

  async getEnquiryByTransactionId(transactionId: string, scope: ScopeOrTrusted) {
    await assertTransactionInScope(transactionId, scope);
    const enquiry = await enquiryTableRepository.findByTransactionId(transactionId);
    if (!enquiry) throw new AppError("Enquiry not found for this transaction", 404);
    return enquiry;
  },

  async getEnquiryWithRelations(id: string, scope: ScopeOrTrusted) {
    await assertEnquiryInScope(id, scope);
    const enquiry = await enquiryTableRepository.findWithRelations(id);
    if (!enquiry) throw new AppError("Enquiry not found", 404);
    return enquiry;
  },

  async createEnquiry(data: InsertEnquiryTable, scope: ScopeOrTrusted) {
    if (data.transaction_id) {
      await assertTransactionInScope(data.transaction_id, scope);
    }
    return enquiryTableRepository.create(data);
  },

  async updateEnquiry(id: string, data: Partial<InsertEnquiryTable>, relations: any, scope: ScopeOrTrusted) {
    await assertEnquiryInScope(id, scope);
    const enquiry = await enquiryTableRepository.update(id, data);
    if (!enquiry) throw new AppError("Enquiry not found", 404);

    if (data.status === 'LOST' && enquiry.transaction_id) {
      await transactionRepository.update(enquiry.transaction_id, { is_active: false });
    }

    if (relations) {
      await enquiryTableRepository.clearRelations(id);
      if (relations.destinations?.length) {
        for (const destId of relations.destinations) {
          await enquiryTableRepository.addDestination(id, destId);
        }
      }
      if (relations.resorts?.length) {
        for (const resortId of relations.resorts) {
          await enquiryTableRepository.addResort(id, resortId);
        }
      }
      if (relations.accommodations?.length) {
        for (const accommodationId of relations.accommodations) {
          await enquiryTableRepository.addAccommodation(id, accommodationId);
        }
      }
      if (relations.boardBases?.length) {
        for (const bbId of relations.boardBases) {
          await enquiryTableRepository.addBoardBasis(id, bbId);
        }
      }
      if (relations.departureAirports?.length) {
        for (const airportId of relations.departureAirports) {
          await enquiryTableRepository.addDepartureAirport(id, airportId);
        }
      }
      if (relations.passengers?.length) {
        for (const p of relations.passengers) {
          await enquiryTableRepository.addPassenger(id, p.type, p.age);
        }
      }
    }

    return enquiryTableRepository.findWithRelations(id);
  },

  /**
   * Soft delete: stamps deleted_at (every enquiry read filters it out). If the
   * deal is still at the enquiry stage, its transaction is deactivated so the
   * pipeline doesn't keep an enquiry-less card — same as marking LOST. A
   * transaction that has already moved on to a quote/booking is left alone.
   */
  async deleteEnquiry(id: string, scope: ScopeOrTrusted) {
    await assertEnquiryInScope(id, scope);
    const enquiry = await enquiryTableRepository.findById(id);
    if (!enquiry) throw new AppError("Enquiry not found", 404);

    const deletedBy = "userId" in scope ? scope.userId : null;
    await enquiryTableRepository.softDelete(id, deletedBy);

    if (enquiry.transaction_id) {
      const txn = await transactionRepository.findById(enquiry.transaction_id);
      if (txn?.status === "on_enquiry") {
        await transactionRepository.update(txn.id, { is_active: false });
      }
    }
  },
};
