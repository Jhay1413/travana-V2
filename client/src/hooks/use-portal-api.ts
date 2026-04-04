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
  if (!res.ok) {
    throw new Error(`Portal API error: ${res.status}`);
  }
  return res.json();
}

export interface PortalUser {
  firstName: string;
  lastName: string;
  email: string;
}

export interface PortalQuote {
  id: string;
  title: string;
  destination: string;
  hotel: string;
  price: number;
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
  hotel: string;
  price: number;
  original_price?: number;
  travel_date: string | null;
  num_nights: number | null;
  image_url: string;
  quote_url: string | null;
  tag?: string;
}

export interface PortalMessage {
  id: string;
  sender: "agent" | "client";
  agent_name?: string;
  text: string;
  timestamp: string;
}

export const portalKeys = {
  user: ["portal", "user"] as const,
  quotes: ["portal", "quotes"] as const,
  bookings: ["portal", "bookings"] as const,
  deals: ["portal", "deals"] as const,
  messages: ["portal", "messages"] as const,
};

export function usePortalUser() {
  return useQuery<PortalUser>({
    queryKey: portalKeys.user,
    queryFn: () => portalFetch("/api/portal/user"),
    retry: false,
    enabled: !!getPortalToken(),
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

export function usePortalDeals() {
  return useQuery<PortalDeal[]>({
    queryKey: portalKeys.deals,
    queryFn: () => portalFetch("/api/portal/deals"),
    retry: false,
    enabled: !!getPortalToken(),
  });
}

export function usePortalMessages() {
  return useQuery<PortalMessage[]>({
    queryKey: portalKeys.messages,
    queryFn: () => portalFetch("/api/portal/messages"),
    retry: false,
    enabled: !!getPortalToken(),
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
  return useMutation<{ token?: string }, Error, string>({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        throw new Error(`Login error: ${res.status}`);
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
