import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const PORTAL_TOKEN_KEY = "portal_token";

export function getPortalToken(): string | null {
  return localStorage.getItem(PORTAL_TOKEN_KEY);
}

export function setPortalToken(token: string) {
  localStorage.setItem(PORTAL_TOKEN_KEY, token);
}

export function clearPortalToken() {
  localStorage.removeItem(PORTAL_TOKEN_KEY);
  localStorage.removeItem("portal_client_id");
  localStorage.removeItem("portal_email");
  localStorage.removeItem("portal_credential_id");
}

async function portalFetch(url: string, options: RequestInit = {}) {
  const token = getPortalToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    clearPortalToken();
    window.location.href = "/portal/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Portal API error: ${res.status}`);
  }
  return res.json();
}

export interface PortalUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
}

export interface PortalQuote {
  id: string;
  title: string;
  destination: string;
  hotel: string;
  price: number;
  price_per_person: number;
  travel_date: string;
  return_date: string;
  expiry_date: string;
  image_url: string;
  quote_url: string;
}

export interface PortalBooking {
  id: string;
  destination: string;
  hotel: string;
  travel_date: string;
  return_date: string;
  booking_reference: string;
  image_url: string;
  documents_url: string;
}

export interface PortalDeal {
  id: string;
  token: string;
  title: string;
  destination: string;
  country: string | null;
  hotel: string;
  price: number;
  original_price?: number;
  travel_date: string | null;
  num_nights: number | null;
  image_url: string;
  quote_url: string | null;
  tags: string[];
}

export interface PortalMessage {
  id: string;
  sender: "agent" | "client";
  agent_name?: string;
  text: string;
  timestamp: string;
}

export interface PortalTag {
  id: string;
  name: string;
}

export interface PortalDealFilters {
  countries: string[];
  popularTags: { tag: string; count: number }[];
}

export interface PortalVipStatus {
  vipTier: "standard" | "gold" | "elite" | "not_enrolled";
  vipEnrolledAt: string | null;
  totalReferrals: number;
  totalEarnings: string;
}

export interface PortalReferral {
  id: string;
  referredName: string;
  referredEmail?: string | null;
  referredPhone?: string | null;
  referralStatus: "PENDING" | "IN_WALLET" | "PAID" | "VOIDED";
  travelDate?: string | null;
  payoutTriggerDate?: string | null;
  payoutAmount?: string | null;
  paidAt?: string | null;
  isDue: boolean;
  createdAt: string;
}

export interface PortalPayoutRequest {
  id: string;
  referral_id: string;
  amount: string;
  status: "requested" | "approved" | "rejected";
  notes: string | null;
  requested_at: string;
  approved_at: string | null;
  rejected_at: string | null;
}

export interface PortalWithdrawal {
  id: string;
  referral_id: string;
  amount: string;
  method: "bank_transfer" | "booking_credit";
  status: "pending" | "processed" | "rejected";
  account_name: string | null;
  account_number: string | null;
  sort_code: string | null;
  transfer_reference: string | null;
  booking_id: string | null;
  credit_note: string | null;
  requested_at: string;
  processed_at: string | null;
}

export const portalKeys = {
  user: ["portal", "user"] as const,
  quotes: ["portal", "quotes"] as const,
  bookings: ["portal", "bookings"] as const,
  deals: (country?: string, tag?: string) => ["portal", "deals", country ?? "", tag ?? ""] as const,
  forYouDeals: ["portal", "forYouDeals"] as const,
  dealFilters: ["portal", "dealFilters"] as const,
  messages: ["portal", "messages"] as const,
  allTags: ["portal", "allTags"] as const,
  myTags: ["portal", "myTags"] as const,
  hasTags: ["portal", "hasTags"] as const,
  vip: ["portal", "vip"] as const,
  referrals: ["portal", "referrals"] as const,
  payoutRequests: ["portal", "payoutRequests"] as const,
  withdrawals: ["portal", "withdrawals"] as const,
  walletBalance: ["portal", "walletBalance"] as const,
  walletTransactions: ["portal", "walletTransactions"] as const,
};

export function usePortalUser() {
  return useQuery<PortalUser>({
    queryKey: portalKeys.user,
    queryFn: () => portalFetch("/api/portal/user"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function useLogPortalQuoteView() {
  return useMutation({
    mutationFn: (token: string) =>
      portalFetch(`/api/portal/quote/${token}/view`, { method: "POST" }),
  });
}

/** Whether the logged-in client owns the quote behind this share token. */
export function usePortalQuoteOwnership(token: string) {
  return useQuery<{ found: boolean; owns: boolean }>({
    queryKey: ["portal", "quote-owns", token],
    queryFn: () => portalFetch(`/api/portal/quote/${token}/owns`),
    retry: false,
    enabled: !!token && !!getPortalToken(),
  });
}

export function usePortalQuotes() {
  return useQuery<PortalQuote[]>({
    queryKey: portalKeys.quotes,
    queryFn: () => portalFetch("/api/portal/quotes"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function usePortalBookings() {
  return useQuery<PortalBooking[]>({
    queryKey: portalKeys.bookings,
    queryFn: () => portalFetch("/api/portal/bookings"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function usePortalDeals(country?: string, tag?: string) {
  const params = new URLSearchParams();
  if (country) params.set("country", country);
  if (tag) params.set("tag", tag);
  const qs = params.toString();
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.deals(country, tag),
    queryFn: () => portalFetch(`/api/portal/deals${qs ? `?${qs}` : ""}`),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function usePortalForYouDeals() {
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.forYouDeals,
    queryFn: () => portalFetch("/api/portal/deals/for-you"),
    retry: false,
    enabled: !!getPortalToken(),
    staleTime: 0,
  });
}

export function usePortalDealFilters() {
  return useQuery<PortalDealFilters>({
    queryKey: portalKeys.dealFilters,
    queryFn: () => portalFetch("/api/portal/deals/filters"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortalMessages() {
  return useQuery<PortalMessage[]>({
    queryKey: portalKeys.messages,
    queryFn: () => portalFetch("/api/portal/messages"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchInterval: 5000,
  });
}

export function useSubmitQuoteRequest() {
  return useMutation({
    mutationFn: (data: { destination: string; dates: string; travellers: string; notes: string }) =>
      portalFetch("/api/portal/quote-request", { method: "POST", body: JSON.stringify(data) }),
  });
}

export function useSubmitInterest() {
  return useMutation({
    mutationFn: (dealId: string) =>
      portalFetch("/api/portal/interest", { method: "POST", body: JSON.stringify({ dealId }) }),
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (text: string) =>
      portalFetch("/api/portal/message", { method: "POST", body: JSON.stringify({ text }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.messages });
    },
  });
}

export function usePortalLogin() {
  return useMutation<
    { token: string; clientId: string; firstName: string; hasBiometric: boolean },
    Error,
    { email: string; pin: string }
  >({
    mutationFn: async ({ email, pin }) => {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Login error: ${res.status}`);
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.token) {
        setPortalToken(data.token);
      }
    },
  });
}

export function usePortalAllTags() {
  return useQuery<PortalTag[]>({
    queryKey: portalKeys.allTags,
    queryFn: () => portalFetch("/api/portal/tags"),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function usePortalMyTags() {
  return useQuery<PortalTag[]>({
    queryKey: portalKeys.myTags,
    queryFn: () => portalFetch("/api/portal/my-tags"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function usePortalHasTags() {
  return useQuery<{ hasTags: boolean }>({
    queryKey: portalKeys.hasTags,
    queryFn: () => portalFetch("/api/portal/has-tags"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function useSavePortalTags() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tagIds: string[]) =>
      portalFetch("/api/portal/my-tags", { method: "POST", body: JSON.stringify({ tagIds }) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.myTags });
      queryClient.invalidateQueries({ queryKey: portalKeys.hasTags });
    },
  });
}

export function usePortalVipStatus() {
  return useQuery<PortalVipStatus>({
    queryKey: portalKeys.vip,
    queryFn: () => portalFetch("/api/portal/vip"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });
}

export function usePortalReferrals() {
  return useQuery<PortalReferral[]>({
    queryKey: portalKeys.referrals,
    queryFn: () => portalFetch("/api/portal/vip/referrals"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function usePortalPayoutRequests() {
  return useQuery<PortalPayoutRequest[]>({
    queryKey: portalKeys.payoutRequests,
    queryFn: () => portalFetch("/api/portal/vip/payout-requests"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function usePortalWithdrawals() {
  return useQuery<PortalWithdrawal[]>({
    queryKey: portalKeys.withdrawals,
    queryFn: () => portalFetch("/api/portal/vip/withdrawals"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export function usePortalWalletBalance() {
  return useQuery<string>({
    queryKey: portalKeys.walletBalance,
    queryFn: async () => {
      const data = await portalFetch("/api/portal/wallet/balance");
      return (data as { balance: string }).balance;
    },
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export interface PortalWalletTransaction {
  id: string;
  type: "credit" | "debit";
  amount: string;
  source: "referral_commission" | "booking_credit" | "bank_transfer";
  referral_id: string | null;
  booking_id: string | null;
  status: "pending" | "processed" | "rejected";
  created_at: string;
  processed_at: string | null;
}

export function usePortalWalletTransactions() {
  const clientId = localStorage.getItem("portal_client_id");
  return useQuery<PortalWalletTransaction[]>({
    queryKey: [...portalKeys.walletTransactions, clientId],
    queryFn: async () => {
      if (!clientId) return [];
      const { data } = await import("../api/client/axios-client").then((m) =>
        m.default.get<PortalWalletTransaction[]>(`/api/wallet/client/${clientId}/transactions`)
      );
      return data;
    },
    retry: false,
    enabled: !!getPortalToken() && !!clientId,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
    staleTime: 0,
  });
}

export interface WalletPayoutResult {
  success: boolean;
  count: number;
  totalAmount: string;
}

export interface WalletWithdrawResult {
  success: boolean;
  referralCount: number;
  totalAmount: string;
  method: "bank_transfer" | "booking_credit";
}

/** Client requests payout for eligible (PENDING + isDue) referrals → moves them to RELEASED for admin approval */
export function useRequestWalletPayout() {
  const queryClient = useQueryClient();
  return useMutation<WalletPayoutResult, Error, void>({
    mutationFn: () =>
      portalFetch("/api/portal/wallet/request-payout", { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.referrals });
      queryClient.invalidateQueries({ queryKey: portalKeys.payoutRequests });
    },
  });
}

export interface WithdrawRequestData {
  method: "bank_transfer" | "booking_credit";
  amount: string;
  account_name?: string;
  account_number?: string;
  sort_code?: string;
  booking_id?: string;
}

/** Client requests withdrawal of their IN_WALLET balance via chosen method */
export function useRequestWalletWithdraw() {
  const queryClient = useQueryClient();
  return useMutation<WalletWithdrawResult, Error, WithdrawRequestData>({
    mutationFn: (data) =>
      portalFetch("/api/portal/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: portalKeys.referrals });
      queryClient.invalidateQueries({ queryKey: portalKeys.withdrawals });
      queryClient.invalidateQueries({ queryKey: portalKeys.vip });
      queryClient.invalidateQueries({ queryKey: portalKeys.walletBalance });
      queryClient.invalidateQueries({ queryKey: portalKeys.walletTransactions });
    },
  });
}

export function usePortalBiometricLogin() {
  return useMutation<
    { token: string; clientId: string; firstName: string },
    Error,
    { clientId: string; credentialId: string }
  >({
    mutationFn: async ({ clientId, credentialId }) => {
      const res = await fetch("/api/portal/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, credentialId }),
      });
      if (!res.ok) {
        throw new Error("Biometric login failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data?.token) {
        setPortalToken(data.token);
      }
    },
  });
}
