import axiosClient from "../client/axios-client";

export interface UploadedMedia {
  id: number;
  url: string;
  thumb_url: string;
  name: string;
}

export interface GeneratePostParams {
  quoteId: string;
  title: string;
  destination: string;
  nights: number;
  boardBasis?: string;
  departureAirport?: string;
  transferType?: string;
  salesPrice?: string;
  pricePerPerson?: string;
  travelDate: string;
}

export interface TravelDeal {
  id: string;
  title: string;
  subtitle: string | null;
  post: string;
  resortSummary: string | null;
  hashtags: string[];
  travelDate: string | null;
  nights: number;
  boardBasis: string | null;
  departureAirport: string | null;
  postSchedule: string | null;
  onlySocialsId: string | null;
  luggageTransfers: string | null;
  price: string | null;
  quote_id: string;
  created_at: string;
}

export const socialPostApi = {
  generate: async (data: GeneratePostParams): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.post<TravelDeal>("/api/social-posts/generate", data);
    return res;
  },

  getByQuoteId: async (quoteId: string): Promise<TravelDeal | null> => {
    const { data: res } = await axiosClient.get<TravelDeal | null>(
      `/api/social-posts/quote/${quoteId}`
    );
    return res;
  },

  update: async (id: string, data: Partial<TravelDeal>): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.patch<TravelDeal>(`/api/social-posts/${id}`, data);
    return res;
  },

  scheduleOnOnlySocials: async (id: string, postSchedule: string, images: number[] = []): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.post<TravelDeal>(`/api/social-posts/${id}/schedule`, {
      postSchedule,
      images,
    });
    return res;
  },

  rescheduleOnOnlySocials: async (id: string, postSchedule: string): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.put<TravelDeal>(`/api/social-posts/${id}/reschedule`, {
      postSchedule,
    });
    return res;
  },

  uploadMedia: async (files: File[]): Promise<UploadedMedia[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const { data: res } = await axiosClient.post<UploadedMedia[]>("/api/social-posts/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res;
  },

  getMedia: async (id: string): Promise<UploadedMedia[]> => {
    const { data: res } = await axiosClient.get<UploadedMedia[]>(`/api/social-posts/${id}/media`);
    return res;
  },
};
