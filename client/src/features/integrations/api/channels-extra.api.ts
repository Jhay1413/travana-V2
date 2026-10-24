import axiosClient from "@/api/client/axios-client";
import type { ChannelHealth, ChannelWorkspaceStatus, DelegateConnectInput, DelegateConnectResult } from "../types";

const BASE = "/api/v2/channels";

export const channelsExtraApi = {
  status: async (): Promise<ChannelWorkspaceStatus> => {
    const { data } = await axiosClient.get<ChannelWorkspaceStatus>(`${BASE}/status`);
    return { provisioned: data.provisioned === true };
  },
  health: async (): Promise<ChannelHealth> => {
    const { data } = await axiosClient.get<ChannelHealth>(`${BASE}/health`);
    return data;
  },
  delegate: async (input: DelegateConnectInput): Promise<DelegateConnectResult> => {
    const { data } = await axiosClient.post<DelegateConnectResult>(`${BASE}/connect-token/delegate`, input);
    return data;
  },
};
