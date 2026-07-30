import axiosClient from "@/api/client/axios-client";
import type { BotConfigResponse, BotConfigUpdatePayload, BotMode } from "../types";

export const botConfigApi = {
  get: async (): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.get<BotConfigResponse>("/api/v2/bot-config");
    return data;
  },

  update: async (payload: BotConfigUpdatePayload): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.put<BotConfigResponse>("/api/v2/bot-config", payload);
    return data;
  },

  enable: async (mode?: BotMode): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.post<BotConfigResponse>("/api/v2/bot-config/enable", mode ? { mode } : {});
    return data;
  },

  disable: async (): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.post<BotConfigResponse>("/api/v2/bot-config/disable");
    return data;
  },

  connectWebhook: async (): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.post<BotConfigResponse>("/api/v2/bot-config/webhook");
    return data;
  },

  disconnectWebhook: async (): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.delete<BotConfigResponse>("/api/v2/bot-config/webhook");
    return data;
  },

  setMode: async (mode: BotMode): Promise<BotConfigResponse> => {
    const { data } = await axiosClient.put<BotConfigResponse>("/api/v2/bot-config/mode", { mode });
    return data;
  },
};
