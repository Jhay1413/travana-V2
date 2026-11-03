import axiosClient from "@/api/client/axios-client";
import type { CreateUpscaleJobParams, UpscaleJob } from "../types";

const BASE = "/api/v2/image-upscale/jobs";

export const imageUpscaleApi = {
  /** Queues a server-side job; resolves immediately with the queued job. */
  createJob: async (params: CreateUpscaleJobParams): Promise<UpscaleJob> => {
    const formData = new FormData();
    if (params.quoteId) formData.append("quoteId", params.quoteId);
    if ("file" in params) formData.append("file", params.file);
    else formData.append("imageUrl", params.imageUrl);
    const { data: res } = await axiosClient.post<UpscaleJob>(BASE, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60_000,
    });
    return res;
  },

  listJobs: async (quoteId: string): Promise<UpscaleJob[]> => {
    const { data: res } = await axiosClient.get<UpscaleJob[]>(BASE, { params: { quoteId } });
    return res;
  },

  listMine: async (): Promise<UpscaleJob[]> => {
    const { data: res } = await axiosClient.get<UpscaleJob[]>(`${BASE}/mine`);
    return res;
  },

  getJob: async (id: string): Promise<UpscaleJob> => {
    const { data: res } = await axiosClient.get<UpscaleJob>(`${BASE}/${id}`);
    return res;
  },

  revertJob: async (id: string): Promise<{ reverted: boolean; job: UpscaleJob }> => {
    const { data: res } = await axiosClient.post<{ reverted: boolean; job: UpscaleJob }>(`${BASE}/${id}/revert`);
    return res;
  },
};
