export interface Enquiry {
  id: string;
  clientId: string;
  userId: string;
  enquiryTitle: string;
  holidayType: string;
  country: string | null;
  destination: string | null;
  resort: string | null;
  departureAirport: string | null;
  travelDate: string | null;
  flexibility: string | null;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  nights: number | null;
  starRating: string | null;
  boardBasis: string | null;
  budget: string | null;
  budgetType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateEnquiryData {
  clientId: string;
  userId: string;
  enquiryTitle: string;
  holidayType: string;
  country?: string;
  destination?: string;
  resort?: string;
  departureAirport?: string;
  travelDate?: string;
  flexibility?: string;
  passengersAdults?: number;
  passengersChildren?: number;
  passengersInfants?: number;
  nights?: number;
  starRating?: string;
  boardBasis?: string;
  budget?: string;
  budgetType?: string;
  status?: string;
}

export interface EnquiryFilters {
  clientId?: string;
}
