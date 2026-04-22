import { useQuery, useMutation } from "@tanstack/react-query";
import axiosClient from "@/api/client/axios-client";

export interface PublicQuoteData {
  title: string;
  holidayType: string;
  travelDate: string | null;
  numNights: number;
  adults: number;
  children: number;
  infants: number;
  pets: number;
  salesPrice: string;
  pricePerPerson: string;
  transferType: string;
  flightMeals: boolean;
  preBookedSeats: string;
  destinationName: string;
  countryName: string;
  resortName: string;
  tags: string[];
  flights: Array<{
    flightType: string | null;
    flightNumber: string | null;
    departingAirport: string;
    arrivalAirport: string;
    departureDateTime: string | null;
    arrivalDateTime: string | null;
    airline: string;
    legOrder: number | null;
  }>;
  accommodations: Array<{
    name: string;
    boardBasis: string;
    roomType: string;
    checkInDateTime: string | null;
    starRating: string | null;
    resortName: string;
  }>;
  transfers: Array<{
    from: string;
    to: string;
    pickUpTime: string | null;
    dropOffTime: string | null;
    note: string;
  }>;
  carHires: Array<{
    pickupLocation: string;
    dropoffLocation: string;
    pickupTime: string | null;
    dropoffTime: string | null;
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
    note: string;
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
    itinerary: Array<{ day: number; description: string }>;
  }>;
  passengers: Array<{
    title: string | null;
    firstName: string | null;
    lastName: string | null;
    type: string | null;
    age: number | null;
  }>;
  images: Array<{
    id: string;
    image_url: string | null;
    isPrimary: boolean | null;
  }>;
  destinationGuru: {
    destination: string;
    country: string | null;
    data: any;
  } | null;
  agent: {
    name: string;
    avatar: string | null;
  };
}

export const publicQuoteKeys = {
  all: ["public-quote"] as const,
  detail: (token: string) => [...publicQuoteKeys.all, token] as const,
};

export function usePublicQuote(token: string) {
  return useQuery<PublicQuoteData>({
    queryKey: publicQuoteKeys.detail(token),
    queryFn: async () => {
      const { data } = await axiosClient.get(`/api/public/quote/${token}`);
      return data;
    },
    enabled: !!token,
    retry: 1,
  });
}

export function useLogQuoteView() {
  return useMutation({
    mutationFn: async (token: string) => {
      const { data } = await axiosClient.post(`/api/public/quote/${token}/view`, {
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      return data;
    },
  });
}

export function useShareQuote() {
  return useMutation({
    mutationFn: async ({ token, method }: { token: string; method: string }) => {
      const { data } = await axiosClient.post(`/api/public/quote/${token}/share`, { method });
      return data;
    },
  });
}

export function useSubmitQuoteAction() {
  return useMutation({
    mutationFn: async ({
      token,
      actionType,
      message,
      customerName,
    }: {
      token: string;
      actionType: "accepted" | "changes_requested";
      message?: string;
      customerName?: string;
    }) => {
      const { data } = await axiosClient.post(`/api/public/quote/${token}/action`, {
        actionType,
        message,
        customerName,
      });
      return data;
    },
  });
}
