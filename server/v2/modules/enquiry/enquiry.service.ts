import { enquiryTableRepository } from "./enquiry.repository";
import { transactionRepository } from "../transaction/transaction.repository";
import { AppError } from "../../utils/error-handler";
import type { InsertEnquiryTable } from "@shared/schema";
import type { Scope } from "../../utils/scope";

type ScopeOrTrusted = Scope | { orgId: null };

function effectiveOrgId(scope: ScopeOrTrusted): string | null {
  if (scope.orgId === null) return null;
  if ((scope as Scope).orgRole === "platform_admin") return null;
  return (scope as Scope).orgId || null;
}

async function assertEnquiryInScope(id: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const row = await enquiryTableRepository.findByIdWithOrg(id);
  if (!row || row.clientOrgId !== orgId) {
    throw new AppError("Enquiry not found", 404);
  }
}

async function assertTransactionInScope(transactionId: string, scope: ScopeOrTrusted) {
  const orgId = effectiveOrgId(scope);
  if (!orgId) return;
  const ok = await enquiryTableRepository.transactionBelongsToOrg(transactionId, orgId);
  if (!ok) throw new AppError("Enquiry not found", 404);
}

export const newEnquiryService = {
  async listEnquiries(scope: ScopeOrTrusted) {
    return enquiryTableRepository.findAll(effectiveOrgId(scope));
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

  async deleteEnquiry(id: string, scope: ScopeOrTrusted) {
    await assertEnquiryInScope(id, scope);
    await enquiryTableRepository.remove(id);
  },
};
