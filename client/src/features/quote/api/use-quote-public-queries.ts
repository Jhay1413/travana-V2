import { useQuery, useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";
import { QUOTE_PREVIEW_ENDPOINT } from "@/api/endpoints";

/** Exactly what the public API sends: no client or passenger names, ids or price breakdown. */
export interface PublicQuoteData {
  title: string;
  holidayType: string;
  travelDate: string | null;
  numNights: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  // Calculated customer total (the server works it out); per person is the same total over the travellers.
  totalPrice: string;
  pricePerPerson: string;
  transferType: string;
  flightMeals: boolean;
  preBookedSeats: string;
  destinationName: string;
  countryName: string;
  resortName: string;
  flights: Array<{
    flightType: string | null;
    flightNumber: string | null;
    departingAirport: string;
    arrivalAirport: string;
    departureDateTime: string | null;
    arrivalDateTime: string | null;
    legOrder: number | null;
  }>;
  accommodations: Array<{
    name: string;
    boardBasis: string;
    roomType: string;
    checkInDateTime: string | null;
    starRating: string | null;
  }>;
  transfers: Array<{
    from: string;
    to: string;
    note: string;
  }>;
  carHires: Array<{
    pickupLocation: string;
    dropoffLocation: string;
    numDays: number;
  }>;
  attractionTickets: Array<{
    type: string;
    dateOfVisit: string | null;
    numberOfTickets: number;
  }>;
  loungePasses: Array<{
    airportName: string;
    terminal: string;
    dateOfUsage: string | null;
  }>;
  airportParkings: Array<{
    airportName: string;
    parkingType: string;
    parkingDate: string | null;
  }>;
  cruises: Array<{
    cruiseLine: string;
    ship: string;
    cabinType: string;
    cruiseName: string;
    cruiseDate: string | null;
    itinerary: Array<{ day: number; description: string; subDescription: string }>;
  }>;
  images: Array<{
    image_url: string | null;
    isPrimary: boolean | null;
  }>;
  destinationGuru: {
    destination: string;
    country: string | null;
    data: unknown;
  } | null;
  agent: {
    name: string;
    avatar: string | null;
  };
  agency: AgencyContact;
  /** True when the quote's expiry date has passed: the page shows the "price was held until" banner. */
  expired: boolean;
  expiredOn: string | null;
}

/** The agency as the public page shows it. Every key is always sent; what the agency has not set is null. */
export interface AgencyContact {
  name: string | null;
  phone: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  email: string | null;
  address: string | null;
}

export type PublicQuoteBlockCode = "BOOKED" | "UNAVAILABLE";

/** The 410 the server answers for a quote the public link must not open: nothing about the quote itself. */
export interface PublicQuoteBlock {
  error: string;
  code: PublicQuoteBlockCode;
  agency: AgencyContact;
}

/** What the page shows for a token: the quote, or the reason it is closed. */
export type PublicQuoteResult =
  | {
      kind: "quote";
      quote: PublicQuoteData;
      /** True when the quote came from the staff preview endpoint (a signed-in staff member opened ?preview=1). */
      isStaffPreview: boolean;
      /** Staff preview only: why customers would be refused (null when the public link would open it). */
      previewBlock: PublicQuoteBlockCode | null;
    }
  | { kind: "blocked"; block: PublicQuoteBlock };

export const publicQuoteKeys = {
  all: ["public-quote"] as const,
  detail: (token: string, preview: boolean) => [...publicQuoteKeys.all, token, preview ? "preview" : "public"] as const,
};

type PreviewResponse = PublicQuoteData & { previewBlock: PublicQuoteBlockCode | null };

function isBlockBody(value: unknown): value is PublicQuoteBlock {
  if (typeof value !== "object" || value === null) return false;
  const { code } = value as { code?: unknown };
  return code === "BOOKED" || code === "UNAVAILABLE";
}

async function fetchPreview(token: string): Promise<PublicQuoteResult | null> {
  try {
    const { data } = await axiosClient.get<PreviewResponse>(QUOTE_PREVIEW_ENDPOINT(token));
    const { previewBlock, ...quote } = data;
    return { kind: "quote", quote, isStaffPreview: true, previewBlock };
  } catch {
    // Not signed in as staff, or not allowed to read this quote: the page behaves like it does for any visitor.
    return null;
  }
}

async function fetchPublic(token: string): Promise<PublicQuoteResult> {
  try {
    const { data } = await axiosClient.get<PublicQuoteData>(`/api/public/quote/${encodeURIComponent(token)}`);
    return { kind: "quote", quote: data, isStaffPreview: false, previewBlock: null };
  } catch (err) {
    const body = (err as { status?: number; data?: unknown }).data;
    if ((err as { status?: number }).status === 410 && isBlockBody(body)) return { kind: "blocked", block: body };
    throw err;
  }
}

/**
 * The quote behind a share token. With `preview` (the page was opened with ?preview=1) a staff session is tried first
 * on the staff preview endpoint; a refusal falls back to the normal public request, blocks included.
 */
export function usePublicQuote(token: string, preview = false) {
  return useQuery<PublicQuoteResult>({
    queryKey: publicQuoteKeys.detail(token, preview),
    queryFn: async () => {
      if (preview) {
        const previewed = await fetchPreview(token);
        if (previewed) return previewed;
      }
      return fetchPublic(token);
    },
    enabled: !!token,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogQuoteView() {
  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const { data } = await axiosClient.post(`/api/public/quote/${encodeURIComponent(token)}/view`, {});
      return data;
    },
  });
}

/** The share buttons the server accepts (anything else is refused). */
export type ShareMethod = "WhatsApp" | "Facebook" | "Email" | "Copy Link" | "Text message" | "Share";

export function useShareQuote() {
  return useMutation({
    mutationFn: async ({ token, method }: { token: string; method: ShareMethod }) => {
      const { data } = await axiosClient.post(`/api/public/quote/${encodeURIComponent(token)}/share`, { method });
      return data;
    },
  });
}
