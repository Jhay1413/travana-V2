import axiosClient from "../client/axios-client";

export interface QuoteImage {
  id: string;
  quoteId: string;
  url: string;
  isPrimary: boolean;
}

export const quoteImageApi = {
  listByQuoteId: async (quoteId: string): Promise<QuoteImage[]> => {
    const { data } = await axiosClient.get<QuoteImage[]>(`/api/quote-images/quote/${quoteId}`);
    return data;
  },

  createFromUrl: async (quoteId: string, url: string, isPrimary = false): Promise<QuoteImage> => {
    const { data } = await axiosClient.post<QuoteImage>("/api/quote-images", { quoteId, url, isPrimary });
    return data;
  },

  uploadImages: async (quoteId: string, files: File[]): Promise<QuoteImage[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("images", file));
    const { data } = await axiosClient.post<QuoteImage[]>(`/api/quote-images/upload/${quoteId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  },

  deleteImage: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/quote-images/${id}`);
  },
};
