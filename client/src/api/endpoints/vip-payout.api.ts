import axiosClient from "../client/axios-client";

export interface AdminVipPayout {
  id: string;
  referralId: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  amount: string;
  method: "bank_transfer" | "booking_credit";
  status: "pending" | "processed";
  notes: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface CreateVipPayoutData {
  referralId: string;
  method: "bank_transfer" | "booking_credit";
  notes?: string;
}

export const vipPayoutApi = {
  getAll: async (): Promise<AdminVipPayout[]> => {
    const { data } = await axiosClient.get<AdminVipPayout[]>("/api/vip-payouts");
    return data;
  },

  getById: async (id: string): Promise<AdminVipPayout> => {
    const { data } = await axiosClient.get<AdminVipPayout>(`/api/vip-payouts/${id}`);
    return data;
  },

  create: async (payload: CreateVipPayoutData): Promise<AdminVipPayout> => {
    const { data } = await axiosClient.post<AdminVipPayout>("/api/vip-payouts", payload);
    return data;
  },

  process: async (id: string, notes?: string): Promise<AdminVipPayout> => {
    const { data } = await axiosClient.patch<AdminVipPayout>(`/api/vip-payouts/${id}/process`, { notes });
    return data;
  },
};
