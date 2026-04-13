import axiosClient from "../client/axios-client";

export interface AdminReferralPayout {
  id: string;
  referral_id: string;
  client_id: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  amount: string;
  status: "requested" | "approved" | "rejected";
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  referredName: string | null;
  referredEmail: string | null;
  travelDate: string | null;
  referralStatus: string | null;
}

export const referralPayoutApi = {
  getAll: async (): Promise<AdminReferralPayout[]> => {
    const { data } = await axiosClient.get<{ data: AdminReferralPayout[] }>("/api/referral-payouts");
    return data.data;
  },

  getById: async (id: string): Promise<AdminReferralPayout> => {
    const { data } = await axiosClient.get<{ data: AdminReferralPayout }>(`/api/referral-payouts/${id}`);
    return data.data;
  },

  approve: async (id: string, notes?: string): Promise<AdminReferralPayout> => {
    const { data } = await axiosClient.patch<{ data: AdminReferralPayout }>(`/api/referral-payouts/${id}/approve`, { notes });
    return data.data;
  },

  reject: async (id: string, notes?: string): Promise<AdminReferralPayout> => {
    const { data } = await axiosClient.patch<{ data: AdminReferralPayout }>(`/api/referral-payouts/${id}/reject`, { notes });
    return data.data;
  },
};
