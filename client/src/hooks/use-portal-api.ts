import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { normalizeOrgSlug } from "@/lib/portal-org-slug";
import type { PortalQuoteOwnership } from "@shared/portal-quotes";
import {
  authenticationToJSON,
  registrationToJSON,
  toCreationOptions,
  toRequestOptions,
  type CreationOptionsJSON,
  type RequestOptionsJSON,
} from "@/lib/webauthn-base64url";

const PORTAL_TOKEN_KEY = "portal_token";
/** Remembered agency slug (from ?org= on the login page). It is sent as `preferOrg` at PIN sign-in — which only
 *  breaks ties between accounts whose PIN matches and never filters — and as `org` for deal filters before sign-in. */
const PORTAL_ORG_KEY = "portal_org";

/** The remembered slug, or null (a junk stored value is treated as none). */
export function getPortalOrgSlug(): string | null {
  return normalizeOrgSlug(localStorage.getItem(PORTAL_ORG_KEY));
}

/** Stores a slug only if it is a valid one; returns whether it was stored. */
export function setPortalOrgSlug(slug: string): boolean {
  const valid = normalizeOrgSlug(slug);
  if (!valid) return false;
  localStorage.setItem(PORTAL_ORG_KEY, valid);
  return true;
}

/** Per-login flag: whether the user dismissed/handled the "get notified" banner.
 *  Stored in sessionStorage so it survives tab navigation but resets on a new login. */
export const PORTAL_PUSH_BANNER_DISMISSED_KEY = "portal_push_banner_dismissed";

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
  // Reset the notification banner so it shows again on the next login.
  sessionStorage.removeItem(PORTAL_PUSH_BANNER_DISMISSED_KEY);
}

/** A failed portal API call: the server's customer-readable message plus its HTTP status and optional machine code (e.g. REAUTH_REQUIRED). */
export class PortalApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "PortalApiError";
  }
}

export async function portalFetch(url: string, options: RequestInit = {}) {
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
    throw new PortalApiError(body.error || `Portal API error: ${res.status}`, res.status, typeof body.code === "string" ? body.code : undefined);
  }
  return res.json();
}

export interface PortalUser {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  /** True when the client is still on a system-seeded default PIN. */
  mustChangePin?: boolean;
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
  /** When the deal was added to the portal (ISO). Present on "Latest Deals"; drives
   *  the "Expiring soon" banner as it nears the 6-day recency cutoff. */
  portal_added_at?: string | null;
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
  walletBalance: string;
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
  commissionRate?: string | null;
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
  deals: (country?: string, tag?: string, matchInterests?: boolean) =>
    ["portal", "deals", country ?? "", tag ?? "", matchInterests ? "interests" : "all"] as const,
  latestDeals: ["portal", "latestDeals"] as const,
  forYouDeals: ["portal", "forYouDeals"] as const,
  dealFilters: (org?: string | null) => ["portal", "dealFilters", org ?? ""] as const,
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
    queryFn: () => portalFetch("/api/v2/portal/user"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function useLogPortalQuoteView() {
  return useMutation({
    mutationFn: (token: string) =>
      portalFetch(`/api/v2/portal/quote/${token}/view`, { method: "POST" }),
  });
}

/** Whether the logged-in client owns the quote behind this share token. */
export function usePortalQuoteOwnership(token: string) {
  return useQuery<PortalQuoteOwnership>({
    queryKey: ["portal", "quote-owns", token],
    queryFn: () => portalFetch(`/api/v2/portal/quote/${token}/owns`),
    retry: false,
    enabled: !!token && !!getPortalToken(),
  });
}

/** Browse Deals page ("Latest Deals" tab). v2 route with recent=1: shows every
 *  deal still inside the portal window, so expired free quotes are excluded
 *  here exactly as they are from the home "Latest Deals" strip. `matchInterests`
 *  restricts to deals sharing a tag with the client's saved Travel Interests —
 *  it's the tab's default (server-side) but removable via a chip in the UI.
 *  `enabled` lets the caller hold the fetch off (e.g. until it knows whether the
 *  client has saved interests) so the query key doesn't flip from "all" to
 *  "interests" after an unfiltered list has already rendered. */
export function usePortalDeals(country?: string, tag?: string, matchInterests?: boolean, enabled = true) {
  const params = new URLSearchParams({ recent: "1" });
  if (country) params.set("country", country);
  if (tag) params.set("tag", tag);
  if (matchInterests) params.set("interests", "1");
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.deals(country, tag, matchInterests),
    queryFn: () => portalFetch(`/api/v2/portal/deals?${params.toString()}`),
    retry: false,
    enabled: !!getPortalToken() && enabled,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

/** Home "Latest Deals" — v2 route, limited to deals added to the portal in the last
 *  7 days and (server-side) to ones matching the client's saved Travel Interests.
 *  Distinct from usePortalDeals (browse page), which shows all portal deals. */
export function usePortalLatestDeals() {
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.latestDeals,
    queryFn: () => portalFetch("/api/v2/portal/deals?recent=1&interests=1"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

/** Personalised deals matching the client's saved tags. v2 route with recent=1 so
 *  it honours the same portal window as every other deal list. */
export function usePortalForYouDeals() {
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.forYouDeals,
    queryFn: () => portalFetch("/api/v2/portal/deals/for-you?recent=1"),
    retry: false,
    enabled: !!getPortalToken(),
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export function usePortalDealFilters() {
  // A signed-in client's agency comes from the session, so no slug is sent then.
  const org = getPortalToken() ? null : getPortalOrgSlug();
  return useQuery<PortalDealFilters>({
    queryKey: portalKeys.dealFilters(org),
    queryFn: () => portalFetch(`/api/v2/portal/deals/filters${org ? `?org=${encodeURIComponent(org)}` : ""}`),
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

/** Exchange a short single-use code (from an SMS quote link) for a session. */
export async function portalMagicLogin(
  code: string,
): Promise<{ token: string; clientId: string; firstName: string; mustChangePin?: boolean }> {
  const res = await fetch("/api/v2/portal/magic-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Login error: ${res.status}`);
  }
  const data = await res.json();
  if (data?.token) setPortalToken(data.token);
  return data;
}

export function useChangePortalPin() {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean; token?: string }, Error, { newPin: string }>({
    mutationFn: ({ newPin }) =>
      portalFetch("/api/v2/portal/change-pin", { method: "POST", body: JSON.stringify({ newPin }) }),
    onSuccess: (data) => {
      // After a magic-link sign-in the server reissues a PIN-method session once the customer has chosen their PIN.
      if (data?.token) setPortalToken(data.token);
      queryClient.invalidateQueries({ queryKey: portalKeys.user });
    },
  });
}

export function usePortalLogin() {
  return useMutation<
    {
      token: string;
      clientId: string;
      firstName: string;
      hasBiometric: boolean;
      /** True when the server could not check for existing Face ID credentials: do not offer set-up. */
      biometricCheckFailed?: boolean;
      mustChangePin?: boolean;
    },
    Error,
    { email: string; pin: string; org?: string; preferOrg?: string }
  >({
    mutationFn: async ({ email, pin, org, preferOrg }) => {
      const res = await fetch("/api/v2/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, pin, ...(org ? { org } : {}), ...(preferOrg ? { preferOrg } : {}) }),
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
      // Write the fresh value synchronously so PortalLayout's hasTags redirect
      // effect doesn't bounce back to /portal/tags on the stale cached `false`.
      queryClient.setQueryData(portalKeys.hasTags, { hasTags: true });
      queryClient.invalidateQueries({ queryKey: portalKeys.myTags });
      queryClient.invalidateQueries({ queryKey: portalKeys.hasTags });
      // Interests changed → "For You" (personalized) and both "Latest Deals"
      // surfaces (home widget + browse page tab, both now interest-filtered
      // server-side) must refresh.
      queryClient.invalidateQueries({ queryKey: portalKeys.forYouDeals });
      queryClient.invalidateQueries({ queryKey: portalKeys.latestDeals });
      queryClient.invalidateQueries({ queryKey: ["portal", "deals"] });
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
  return useQuery<PortalWalletTransaction[]>({
    queryKey: portalKeys.walletTransactions,
    queryFn: () => portalFetch("/api/portal/wallet/transactions") as Promise<PortalWalletTransaction[]>,
    retry: false,
    enabled: !!getPortalToken(),
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

/** Whether this device remembers a Face ID / Touch ID set-up. Purely local — the server is never asked who has biometrics. */
export function hasLocalBiometric(): boolean {
  return !!localStorage.getItem("portal_credential_id") && !!window.PublicKeyCredential;
}

/**
 * Two-step Face ID / Touch ID set-up for the signed-in customer: the server issues
 * the challenge, the device signs it, the server verifies the attestation.
 * Resolves quietly (no throw) when the device has no platform authenticator.
 */
export async function registerPortalBiometric(): Promise<void> {
  if (!window.PublicKeyCredential) return;
  const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  if (!available) return;

  const { options, challengeToken } = (await portalFetch("/api/v2/portal/webauthn/register/options", {
    method: "POST",
    body: JSON.stringify({}),
  })) as { options: CreationOptionsJSON; challengeToken: string };

  const credential = (await navigator.credentials.create({ publicKey: toCreationOptions(options) })) as PublicKeyCredential | null;
  if (!credential) return;

  await portalFetch("/api/v2/portal/webauthn/register", {
    method: "POST",
    body: JSON.stringify({
      challengeToken,
      response: registrationToJSON(credential),
      deviceName: navigator.userAgent.includes("iPhone") ? "iPhone" :
                  navigator.userAgent.includes("Android") ? "Android" : "Device",
    }),
  });
  localStorage.setItem("portal_credential_id", credential.id);
}

/** Forget this device's remembered Face ID (used when a sign-in with it was rejected, so a dead button does not return). */
export function clearLocalBiometric() {
  localStorage.removeItem("portal_credential_id");
}

/** Two-step Face ID / Touch ID sign-in: fetch a challenge, have the device sign it, send the assertion back. */
export function usePortalBiometricLogin() {
  return useMutation<
    { token: string; clientId: string; firstName: string; mustChangePin?: boolean },
    Error,
    void
  >({
    mutationFn: async () => {
      const optRes = await fetch("/api/v2/portal/webauthn/login/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!optRes.ok) throw new Error("Biometric login failed");
      const { options, challengeToken } = (await optRes.json()) as { options: RequestOptionsJSON; challengeToken: string };

      const credential = (await navigator.credentials.get({ publicKey: toRequestOptions(options) })) as PublicKeyCredential | null;
      if (!credential) throw new Error("Biometric login failed");

      const res = await fetch("/api/v2/portal/webauthn/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeToken, response: authenticationToJSON(credential) }),
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
