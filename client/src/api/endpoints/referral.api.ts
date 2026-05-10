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

export interface ReferralStats {
  total: number;
  pending: number;
  wallet: number;
  overall: number;
}

export interface VipReferredClient {
  id: string;
  firstName: string | null;
  surename: string | null;
  email: string | null;
  phoneNumber: string | null;
  createdAt: string | null;
}

export interface VipTransactionRow {
  id: string;
  referralStatus: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED";
  referredName: string;
  referredClientId: string | null;
  referredClientFirstName: string | null;
  referredClientSurname: string | null;
  commission: string | null;
  payoutAmount: string | null;
  travelDate: string | null;
  payoutTriggerDate: string | null;
  paidAt: string | null;
  createdAt: string | null;
  transactionId: string | null;
  bookingTitle: string | null;
  bookingTravelDate: string | null;
  bookingSalesPrice: string | null;
  bookingCommission: string | null;
  bookingStatus: string | null;
  bookingHaysRef: string | null;
  isDue: boolean;
}

export interface VipWalletLedgerEntry {
  id: string;
  type: "credit" | "debit";
  source: "referral_commission" | "booking_credit" | "bank_transfer";
  amount: string;
  status: "pending" | "processed" | "rejected";
  referral_id: string | null;
  booking_id: string | null;
  referral_referred_name: string | null;
  booking_hays_ref: string | null;
  notes: string | null;
  created_at: string | null;
  processed_at: string | null;
}

export interface VipOverview {
  vipTier: "standard" | "gold" | "elite" | null;
  vipEnrolledAt: string | null;
  dbTotalReferrals: number;
  stats: {
    total: number;
    pendingCount: number;
    inWalletCount: number;
    paidCount: number;
    voidedCount: number;
    pendingCommission: number;
    walletCommission: number;
    paidCommission: number;
    overallCommission: number;
    pendingPayout: number;
    walletPayout: number;
    paidPayout: number;
    overallPayout: number;
    availableBalance: number;
  };
  referredClients: VipReferredClient[];
  transactionHistory: VipTransactionRow[];
  walletLedger: VipWalletLedgerEntry[];
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
    const { data } = await axiosClient.get<AdminReferral[]>("/api/v2/referrals");
    return data;
  },

  getById: async (id: string): Promise<AdminReferral> => {
    const { data } = await axiosClient.get<AdminReferral>(`/api/v2/referrals/${id}`);
    return data;
  },

  getByClient: async (clientId: string): Promise<AdminReferral[]> => {
    const { data } = await axiosClient.get<AdminReferral[]>(`/api/v2/referrals/client/${clientId}`);
    return data;
  },

  getStatsByClient: async (clientId: string): Promise<ReferralStats> => {
    const { data } = await axiosClient.get<ReferralStats>(`/api/v2/referrals/client/${clientId}/stats`);
    return data;
  },

  getVipOverview: async (clientId: string): Promise<VipOverview> => {
    const { data } = await axiosClient.get<VipOverview>(`/api/v2/referrals/client/${clientId}/vip-overview`);
    return data;
  },

  create: async (payload: CreateReferralData): Promise<AdminReferral> => {
    const { data } = await axiosClient.post<AdminReferral>("/api/v2/referrals", payload);
    return data;
  },

  updateStatus: async (id: string, status: AdminReferral["referralStatus"]): Promise<AdminReferral> => {
    const { data } = await axiosClient.patch<AdminReferral>(`/api/v2/referrals/${id}/status`, { referralStatus: status });
    return data;
  },

  update: async (id: string, payload: Partial<CreateReferralData>): Promise<AdminReferral> => {
    const { data } = await axiosClient.patch<AdminReferral>(`/api/v2/referrals/${id}`, payload);
    return data;
  },

  remove: async (id: string): Promise<void> => {
    await axiosClient.delete(`/api/v2/referrals/${id}`);
  },

};
