import axiosClient from "../client/axios-client";
import type { Client, CreateClientData } from "@/types/client";

export const clientApi = {
  getAll: async (): Promise<Client[]> => {
    const { data } = await axiosClient.get<Client[]>("/api/v2/clients");
    return data;
  },

  getById: async (id: string): Promise<Client> => {
    const { data } = await axiosClient.get<Client>(`/api/v2/clients/${id}`);
    return data;
  },

  create: async (clientData: CreateClientData): Promise<Client> => {
    const { data } = await axiosClient.post<Client>("/api/v2/clients", {
      ...clientData,
      name: `${clientData.firstName} ${clientData.lastName}`.trim(),
    });
    return data;
  },

  update: async (id: string, clientData: Partial<Client>): Promise<Client> => {
    const { data } = await axiosClient.patch<Client>(`/api/v2/clients/${id}`, clientData);
    return data;
  },
};
