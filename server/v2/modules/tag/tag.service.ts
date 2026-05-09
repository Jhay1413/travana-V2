import { tagRepository } from "./tag.repository";

export const tagService = {
  async getAllTags() {
    return await tagRepository.getAllTags();
  },

  async searchTags(query: string) {
    return await tagRepository.searchTags(query);
  },

  /**
   * Get tags for a specific quote
   */
  async getQuoteTags(quoteId: string) {
    return await tagRepository.getQuoteTags(quoteId);
  },

  /**
   * Update tags for a quote (replaces all existing tags)
   */
  async updateQuoteTags(quoteId: string, tagNames: string[]) {
    await tagRepository.replaceQuoteTags(quoteId, tagNames);
  },

  /**
   * Add tags to a new quote
   */
  async addQuoteTags(quoteId: string, tagNames: string[]) {
    await tagRepository.addTagsToQuote(quoteId, tagNames);
  },

  async getClientTags(clientId: string) {
    return await tagRepository.getClientTags(clientId);
  },

  async setClientTags(clientId: string, tagIds: string[]) {
    await tagRepository.setClientTags(clientId, tagIds);
  },

  async clientHasTags(clientId: string): Promise<boolean> {
    return await tagRepository.clientHasTags(clientId);
  },

  async getBookingTags(bookingId: string) {
    return await tagRepository.getBookingTags(bookingId);
  },

  async updateBookingTags(bookingId: string, tagNames: string[]) {
    await tagRepository.replaceBookingTags(bookingId, tagNames);
  },
};
