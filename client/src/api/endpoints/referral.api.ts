import axiosClient from "../client/axios-client";

export interface AdminReferral {
  id: string;
  referrerClientId: string | null;
  referrerName: string | null;
  referrerPhone: string | null;
  referredClientId: string | null;
  referredName: string;
  referredEmail: string | null;
  referredPhone: string | null;
  transactionId: string | null;
  travelDate: string | null;
  commission: string | null;
  payoutAmount: string | null;
  referralStatus: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED";
  payoutTriggerDate: string | null;
  isDue: boolean;
  createdAt: string;
}

export interface CreateReferralData {
  referrerClientId: string;
  referredClientId?: string;
  referredName: string;
  referredEmail?: string;
  referredPhone?: string;
  transactionId?: string;
  travelDate?: string;
  commission?: string;
}

export const referralApi = {
  getAll: async (): Promise<AdminReferral[]> => {
    const { data } = await axiosClient.get<AdminReferral[]>("/api/referrals");
    return data;
  },

  getById: async (id: string): Promise<AdminReferral> => {
    const { data } = await axiosClient.get<AdminReferral>(`/api/referrals/${id}`);
    return data;
  },

  getByClient: async (clientId: string): Promise<AdminReferral[]> => {
    const { data } = await axiosClient.get<AdminReferral[]>(`/api/referrals/client/${clientId}`);
    return data;
  },

  create: async (payload: CreateReferralData): Promise<AdminReferral> => {
    const { data } = await axiosClient.post<AdminReferral>("/api/referrals", payload);
    return data;
  },

  updateStatus: async (id: string, status: AdminReferral["referralStatus"]): Promise<AdminReferral> => {
    const { data } = await axiosClient.patch<AdminReferral>(`/api/referrals/${id}/status`, { referralStatus: status });
    return data;
  },

  update: async (id: string, payload: Partial<CreateReferralData>): Promise<AdminReferral> => {
    const { data } = await axiosClient.patch<AdminReferral>(`/api/referrals/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/referrals/${id}`);
  },
};
