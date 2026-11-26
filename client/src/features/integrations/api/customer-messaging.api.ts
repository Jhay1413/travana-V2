import axiosClient from "@/api/client/axios-client";
import type { AutoChannel, AutoMessagePurpose, CustomerMessagingReadiness, TemplateSettings } from "../types";

const BASE = "/api/v2/customer-messaging";

export const customerMessagingApi = {
  getSettings: async (): Promise<{ autoChannel: AutoChannel }> => {
    const { data } = await axiosClient.get<{ autoChannel: AutoChannel }>(`${BASE}/settings`);
    return data;
  },
  saveSettings: async (autoChannel: AutoChannel): Promise<{ autoChannel: AutoChannel }> => {
    const { data } = await axiosClient.put<{ autoChannel: AutoChannel }>(`${BASE}/settings`, { autoChannel });
    return data;
  },
  getReadiness: async (): Promise<CustomerMessagingReadiness> => {
    const { data } = await axiosClient.get<CustomerMessagingReadiness>(`${BASE}/readiness`);
    return data;
  },
  setSwitch: async (purpose: AutoMessagePurpose, active: boolean): Promise<{ purpose: AutoMessagePurpose; active: boolean }> => {
    const { data } = await axiosClient.put<{ purpose: AutoMessagePurpose; active: boolean }>(`${BASE}/switch/${purpose}`, { active });
    return data;
  },
  getTemplate: async (purpose: AutoMessagePurpose): Promise<TemplateSettings> => {
    const { data } = await axiosClient.get<TemplateSettings>(`${BASE}/templates/${purpose}`);
    return data;
  },
  saveTemplate: async (purpose: AutoMessagePurpose, input: TemplateSettings): Promise<TemplateSettings> => {
    const { data } = await axiosClient.put<TemplateSettings>(`${BASE}/templates/${purpose}`, input);
    return data;
  },
};
