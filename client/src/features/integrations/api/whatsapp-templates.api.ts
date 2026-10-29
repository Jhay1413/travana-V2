import axiosClient from "@/api/client/axios-client";
import type {
  CreateWaTemplateInput,
  CreateWaTemplateResult,
  QuoteTemplateSettings,
  UpdateTemplateSettings,
  WaTemplateList,
  WaTemplateSyncResult,
} from "../types";

const BASE = "/api/v2/whatsapp-templates";
const SETTINGS = "/api/v2/quote-share/whatsapp-template-settings";
const UPDATE_SETTINGS = "/api/v2/whatsapp-updates/settings";

export const whatsappTemplatesApi = {
  list: async (channelId: string): Promise<WaTemplateList> => {
    const { data } = await axiosClient.get<WaTemplateList>(BASE, { params: { channel_id: channelId } });
    return data;
  },
  sync: async (channelId: string): Promise<WaTemplateSyncResult> => {
    const { data } = await axiosClient.post<WaTemplateSyncResult>(`${BASE}/sync`, { channel_id: channelId });
    return data;
  },
  create: async (input: CreateWaTemplateInput): Promise<CreateWaTemplateResult> => {
    const { data } = await axiosClient.post<CreateWaTemplateResult>(BASE, input);
    return data;
  },
  remove: async (id: string): Promise<{ removed: boolean }> => {
    const { data } = await axiosClient.delete<{ removed: boolean }>(`${BASE}/${id}`);
    return data;
  },
  getSettings: async (): Promise<QuoteTemplateSettings> => {
    const { data } = await axiosClient.get<QuoteTemplateSettings>(SETTINGS);
    return data;
  },
  saveSettings: async (input: QuoteTemplateSettings): Promise<QuoteTemplateSettings> => {
    const { data } = await axiosClient.put<QuoteTemplateSettings>(SETTINGS, input);
    return data;
  },
  getUpdateSettings: async (): Promise<UpdateTemplateSettings> => {
    const { data } = await axiosClient.get<UpdateTemplateSettings>(UPDATE_SETTINGS);
    return data;
  },
  saveUpdateSettings: async (input: UpdateTemplateSettings): Promise<UpdateTemplateSettings> => {
    const { data } = await axiosClient.put<UpdateTemplateSettings>(UPDATE_SETTINGS, input);
    return data;
  },
};
