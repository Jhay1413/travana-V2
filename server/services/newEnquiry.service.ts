import { enquiryTableRepository } from "../repositories/enquiryTable.repository";
import { AppError } from "../utils/error-handler";
import type { InsertEnquiryTable } from "@shared/schema";

export const newEnquiryService = {
  async listEnquiries() {
    return await enquiryTableRepository.findAll();
  },

  async getEnquiryById(id: string) {
    const enquiry = await enquiryTableRepository.findById(id);
    if (!enquiry) throw new AppError("Enquiry not found", 404);
    return enquiry;
  },

  async getEnquiryByTransactionId(transactionId: string) {
    const enquiry = await enquiryTableRepository.findByTransactionId(transactionId);
    if (!enquiry) throw new AppError("Enquiry not found for this transaction", 404);
    return enquiry;
  },

  async getEnquiryWithRelations(id: string) {
    const enquiry = await enquiryTableRepository.findWithRelations(id);
    if (!enquiry) throw new AppError("Enquiry not found", 404);
    return enquiry;
  },

  async createEnquiry(data: InsertEnquiryTable) {
    return await enquiryTableRepository.create(data);
  },

  async updateEnquiry(id: string, data: Partial<InsertEnquiryTable>, relations?: any) {
    const enquiry = await enquiryTableRepository.update(id, data);
    if (!enquiry) throw new AppError("Enquiry not found", 404);

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

    return await enquiryTableRepository.findWithRelations(id);
  },

  async deleteEnquiry(id: string) {
    await enquiryTableRepository.remove(id);
  },
};
