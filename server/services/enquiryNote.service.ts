import { enquiryNoteRepository } from "../repositories/enquiryNote.repository";
import { AppError } from "../utils/error-handler";
import type { EnquiryNote, InsertEnquiryNote } from "@shared/schema";

export const enquiryNoteService = {
  async listByEnquiryId(enquiryId: string): Promise<EnquiryNote[]> {
    return await enquiryNoteRepository.findByEnquiryId(enquiryId);
  },

  async createNote(data: InsertEnquiryNote): Promise<EnquiryNote> {
    return await enquiryNoteRepository.create(data);
  },

  async updateNote(id: string, content: string): Promise<EnquiryNote> {
    const note = await enquiryNoteRepository.update(id, content);
    if (!note) throw new AppError("Enquiry note not found", 404);
    return note;
  },

  async deleteNote(id: string): Promise<void> {
    await enquiryNoteRepository.remove(id);
  },
};
