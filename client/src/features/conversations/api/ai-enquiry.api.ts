import axiosClient from "@/api/client/axios-client";

// Free-text enquiry intent the server AI extracts from a conversation transcript.
// The enquiry wizard resolves the name fields to lookup IDs client-side.
export interface EnquiryIntent {
  enquiryTitle: string;
  holidayType: string;
  countries: string[];
  destinations: string[];
  resorts: string[];
  departureAirports: string[];
  boardBasis: string[];
  starRating: string;
  travelDate: string;
  flexibility: string;
  nights: number | null;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  budget: string;
  budgetType: string;
  notes: string;
  confidence: "low" | "medium" | "high";
}

export const aiEnquiryApi = {
  fromConversation: async (transcript: string): Promise<EnquiryIntent> => {
    const { data } = await axiosClient.post<EnquiryIntent>("/api/v2/ai-enquiry/from-conversation", { transcript });
    return data;
  },
};
