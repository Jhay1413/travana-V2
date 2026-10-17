import axiosClient from "@/api/client/axios-client";
import { NEON_CLIENT_ENDPOINTS } from "@/api/endpoints";

export interface PortalPinStatus {
  hasPin: boolean;
  mustChangePin: boolean;
}

export const portalPinApi = {
  get: async (clientId: string): Promise<PortalPinStatus> => {
    const { data } = await axiosClient.get<PortalPinStatus>(NEON_CLIENT_ENDPOINTS.portalPin(clientId));
    return data;
  },

  set: async (clientId: string, pin: string): Promise<void> => {
    await axiosClient.put(NEON_CLIENT_ENDPOINTS.portalPin(clientId), { pin });
  },

  remove: async (clientId: string): Promise<void> => {
    await axiosClient.delete(NEON_CLIENT_ENDPOINTS.portalPin(clientId));
  },
};
