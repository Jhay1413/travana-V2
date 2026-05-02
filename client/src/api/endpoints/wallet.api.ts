import axiosClient from "../client/axios-client";

export interface WalletTransaction {
  id: string;
  client_id: string;
  type: "credit" | "debit";
  amount: string;
  source: "referral_commission" | "booking_credit" | "bank_transfer";
  referral_id: string | null;
  booking_id: string | null;
  account_name: string | null;
  transfer_reference: string | null;
  notes: string | null;
  status: "pending" | "processed" | "rejected";
  created_at: string;
  processed_at: string | null;
}

// Extended type returned by the admin listAll endpoint (includes joined client + booking data)
export interface AdminWalletTransaction extends WalletTransaction {
  clientFirstName: string | null;
  clientSurname: string | null;
  clientEmail: string | null;
  bookingRef: string | null;
}

export const walletApi = {
  listAll: async (): Promise<AdminWalletTransaction[]> => {
    const { data } = await axiosClient.get("/api/wallet/");
    return data;
  },

  getBalance: async (clientId: string): Promise<string> => {
    const { data } = await axiosClient.get(`/api/wallet/client/${clientId}/balance`);
    return data?.balance ?? "0";
  },

  getTransactions: async (clientId: string): Promise<WalletTransaction[]> => {
    const { data } = await axiosClient.get(`/api/wallet/client/${clientId}/transactions`);
    return data;
  },

  applyBookingCredit: async (
    clientId: string,
    bookingId: string,
    amount: number
  ): Promise<WalletTransaction> => {
    const { data } = await axiosClient.post(
      `/api/wallet/client/${clientId}/apply-booking-credit`,
      { booking_id: bookingId, amount }
    );
    return data;
  },

  processDebit: async (
    id: string,
    payload: { transfer_reference?: string; notes?: string }
  ): Promise<WalletTransaction> => {
    const { data } = await axiosClient.patch(
      `/api/wallet/transactions/${id}/process`,
      payload
    );
    return data;
  },

  rejectDebit: async (id: string, notes?: string): Promise<WalletTransaction> => {
    const { data } = await axiosClient.patch(
      `/api/wallet/transactions/${id}/reject`,
      { notes }
    );
    return data;
  },
};
