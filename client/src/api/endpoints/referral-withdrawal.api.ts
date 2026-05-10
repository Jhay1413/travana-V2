import axiosClient from "../client/axios-client";

export interface AdminReferralWithdrawal {
  id: string;
  referral_id: string;
  client_id: string | null;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
  amount: string;
  method: "bank_transfer" | "booking_credit";
  status: "pending" | "processed" | "rejected";
  // Bank transfer
  account_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  transfer_reference: string | null;
  // Booking credit
  booking_id: string | null;
  bookingRef: string | null;
  credit_note: string | null;
  // General
  notes: string | null;
  requested_at: string;
  processed_at: string | null;
  referredName: string | null;
  referredEmail: string | null;
  travelDate: string | null;
  referralStatus: string | null;
  invoice_url: string | null;
}

export interface ProcessWithdrawalData {
  transfer_reference?: string;
  booking_id?: string;
  credit_note?: string;
  notes?: string;
}

export const referralWithdrawalApi = {
  getAll: async (): Promise<AdminReferralWithdrawal[]> => {
    const { data } = await axiosClient.get("/api/v2/referral-withdrawals");
    return data.data;
  },

  getById: async (id: string): Promise<AdminReferralWithdrawal> => {
    const { data } = await axiosClient.get(`/api/v2/referral-withdrawals/${id}`);
    return data.data;
  },

  process: async (id: string, payload: ProcessWithdrawalData): Promise<AdminReferralWithdrawal> => {
    const { data } = await axiosClient.patch(`/api/v2/referral-withdrawals/${id}/process`, payload);
    return data.data;
  },

  reject: async (id: string, notes?: string): Promise<AdminReferralWithdrawal> => {
    const { data } = await axiosClient.patch(`/api/v2/referral-withdrawals/${id}/reject`, { notes });
    return data.data;
  },

  getInvoiceUrl: async (id: string): Promise<string> => {
    const { data } = await axiosClient.get(`/api/v2/referral-withdrawals/${id}/invoice`);
    return data.data.url;
  },
};
