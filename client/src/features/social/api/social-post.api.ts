import axiosClient from "@/api/client/axios-client";

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
  quoteType?: string;
  lodgeName?: string;
  parkName?: string;
  parkLocation?: string;
  tourOperator?: string;
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

export interface AutoUpscaleSize {
  w: number;
  h: number;
}

export interface AutoUpscaledImage {
  /** Quote image url, or the uploaded file's name. */
  originalUrl: string;
  resultUrl: string;
  from: AutoUpscaleSize | null;
  to: AutoUpscaleSize | null;
  /** False when the image was only cropped (already large enough). */
  upscaled: boolean;
}

export type AutoUpscaleSkipReason = "already_formatted" | "reused_previous" | "failed" | "cap_reached" | "timeout";

export interface AutoUpscaleSkipped {
  originalUrl: string;
  reason: AutoUpscaleSkipReason;
  message?: string;
}

/** What the server's automatic 1080×1080 formatting did while scheduling. */
export interface AutoUpscaleSummary {
  upscaled: AutoUpscaledImage[];
  skipped: AutoUpscaleSkipped[];
}

/** Schedule/reschedule responses: the deal plus any quote-image URLs that
 * failed to upload to OnlySocials (the post is still scheduled without them). */
export interface SchedulePostResult extends TravelDeal {
  failedImageUrls?: string[];
  autoUpscale?: AutoUpscaleSummary;
}

/** Upscaling runs inside the request, so scheduling can take minutes. */
const SCHEDULE_TIMEOUT_MS = 240_000;

export interface QuoteImageSource {
  url: string;
  name: string;
  source: "accommodation" | "lodge" | "park" | "cottage" | "quote";
  isPrimary: boolean;
}

export const socialPostApi = {
  generate: async (data: GeneratePostParams): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.post<TravelDeal>("/api/v2/social-posts/generate", data);
    return res;
  },

  getByQuoteId: async (quoteId: string): Promise<TravelDeal | null> => {
    const { data: res } = await axiosClient.get<TravelDeal | null>(
      `/api/v2/social-posts/quote/${quoteId}`
    );
    return res;
  },

  update: async (id: string, data: Partial<TravelDeal>): Promise<TravelDeal> => {
    const { data: res } = await axiosClient.patch<TravelDeal>(`/api/v2/social-posts/${id}`, data);
    return res;
  },

  scheduleOnOnlySocials: async (id: string, formData: FormData): Promise<SchedulePostResult> => {
    const { data: res } = await axiosClient.post<SchedulePostResult>(
      `/api/v2/social-posts/${id}/schedule`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: SCHEDULE_TIMEOUT_MS }
    );
    return res;
  },

  rescheduleOnOnlySocials: async (id: string, formData: FormData): Promise<SchedulePostResult> => {
    const { data: res } = await axiosClient.put<SchedulePostResult>(
      `/api/v2/social-posts/${id}/reschedule`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" }, timeout: SCHEDULE_TIMEOUT_MS }
    );
    return res;
  },

  uploadMedia: async (files: File[]): Promise<UploadedMedia[]> => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    const { data: res } = await axiosClient.post<UploadedMedia[]>("/api/v2/social-posts/media/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return res;
  },

  getMedia: async (id: string): Promise<{ media: UploadedMedia[]; postContent: string }> => {
    const { data: res } = await axiosClient.get<{ media: UploadedMedia[]; postContent: string }>(`/api/v2/social-posts/${id}/media`);
    return res;
  },

  getQuoteImages: async (quoteId: string): Promise<QuoteImageSource[]> => {
    const { data: res } = await axiosClient.get<QuoteImageSource[]>(`/api/v2/social-posts/quote/${quoteId}/images`);
    return res;
  },
};
