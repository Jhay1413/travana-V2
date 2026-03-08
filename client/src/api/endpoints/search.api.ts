import axiosClient from "../client/axios-client";

export type GlobalSearchResponse = {
  clients: Array<{
    id: string;
    name: string;
    subtitle: string;
  }>;
  quotes: Array<{
    id: string;
    transactionId: string;
    clientId: string | null;
    clientName: string;
    destination: string;
    country: string;
    accommodation: string;
    salesPrice: string;
    travelDate: string;
    quoteStatus: string;
    holidayType: string;
  }>;
  bookings: Array<{
    id: string;
    transactionId: string;
    clientId: string | null;
    clientName: string;
    destination: string;
    country: string;
    accommodation: string;
    salesPrice: string;
    travelDate: string;
    haysRef: string;
    supplierRef: string;
    holidayType: string;
  }>;
};

export const searchApi = {
  globalSearch: async (q: string): Promise<GlobalSearchResponse> => {
    const { data } = await axiosClient.get<GlobalSearchResponse>("/api/search", { params: { q } });
    return data;
  },
};
