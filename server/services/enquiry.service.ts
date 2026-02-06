import { enquiryRepository } from "../repositories/enquiry.repository";
import { AppError } from "../utils/error-handler";
import type { Enquiry, InsertEnquiry } from "@shared/schema";

export const enquiryService = {
  async listEnquiries() {
    return await enquiryRepository.findAll();
  },

  async listEnquiriesByClient(clientId: string) {
    return await enquiryRepository.findByClientId(clientId);
  },

  async getEnquiryById(id: string): Promise<Enquiry> {
    const enquiry = await enquiryRepository.findById(id);
    if (!enquiry) {
      throw new AppError("Enquiry not found", 404);
    }
    return enquiry;
  },

  async createEnquiry(data: InsertEnquiry): Promise<Enquiry> {
    return await enquiryRepository.create(data);
  },

  async updateEnquiry(id: string, data: Partial<InsertEnquiry>): Promise<Enquiry> {
    const enquiry = await enquiryRepository.update(id, data);
    if (!enquiry) {
      throw new AppError("Enquiry not found", 404);
    }
    return enquiry;
  },

  async deleteEnquiry(id: string): Promise<void> {
    await enquiryRepository.remove(id);
  },
};
