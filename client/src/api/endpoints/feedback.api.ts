import axiosClient from "../client/axios-client";

export type FeedbackRecord = {
  id: string;
  userId: string;
  userName: string | null;
  type: "suggestion" | "bug" | "general";
  subject: string;
  message: string;
  status: "open" | "in_review" | "resolved" | "closed";
  adminNotes: string | null;
  page: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateFeedbackData = {
  type: "suggestion" | "bug" | "general";
  subject: string;
  message: string;
  page?: string;
};

export const feedbackApi = {
  getAll: async (): Promise<FeedbackRecord[]> => {
    const { data } = await axiosClient.get("/api/feedback");
    return data;
  },

  getMine: async (): Promise<FeedbackRecord[]> => {
    const { data } = await axiosClient.get("/api/feedback/mine");
    return data;
  },

  create: async (payload: CreateFeedbackData): Promise<FeedbackRecord> => {
    const { data } = await axiosClient.post("/api/feedback", payload);
    return data;
  },

  updateStatus: async (id: string, status: string, adminNotes?: string): Promise<FeedbackRecord> => {
    const { data } = await axiosClient.patch(`/api/feedback/${id}/status`, { status, adminNotes });
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/feedback/${id}`);
  },
};
