import type { Client } from "../client";
import type { User } from "../user";

export interface Quote {
  id: string;
  clientId: string;
  userId: string;
  status: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string | null;
  destination: string;
  country: string | null;
  resort: string | null;
  travelDate: string;
  returnDate: string;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  childAges: number[];
  checkInDate: string | null;
  checkInTime: string | null;
  nights: number | null;
  transferType: string | null;
  preBookedSeats: string | null;
  flightMeals: string | null;
  leadSource: string | null;
  haysReference: string | null;
  tourReference: string | null;
  bookedAt: string | null;
  createdAt: string;
  images?: QuoteImage[];
}

export interface Accommodation {
  id: string;
  quoteId: string;
  property: string;
  board: string;
  roomType: string;
  notes: string | null;
}

export interface Flight {
  id: string;
  quoteId: string;
  direction: string;
  fromAirport: string;
  toAirport: string;
  carrier: string;
  flightNo: string;
  depart: string;
  arrive: string;
}

export interface Commission {
  id: string;
  quoteId: string;
  tourOperator: string;
  price: string;
  commissionPercent: string;
  commissionValue: string;
  agentSplitPercent: string;
  agentSplitValue: string;
  netToAgency: string;
}

export interface QuoteImage {
  id: string;
  quoteId: string;
  url: string;
  isPrimary: boolean;
}

export interface Note {
  id: string;
  quoteId: string;
  content: string;
  createdAt: string;
}

export interface QuoteFull extends Quote {
  accommodation?: Accommodation;
  flights: Flight[];
  commission?: Commission;
  images: QuoteImage[];
  notes: Note[];
  client?: Client;
  owner?: User;
}

export interface CreateQuoteData {
  clientId: string;
  userId?: string;
  status?: string;
  packageType?: string;
  quoteTitle?: string;
  quoteLink?: string;
  travelDate?: string;
  returnDate?: string;
  passengersAdults?: number;
  passengersChildren?: number;
  passengersInfants?: number;
  childAges?: number[];
  country?: string;
  destination?: string;
  resort?: string;
  accommodation?: string;
  checkInDate?: string;
  checkInTime?: string;
  nights?: number;
  boardBasis?: string;
  roomType?: string;
  transferType?: string;
  preBookedSeats?: string;
  flightMeals?: string;
  leadSource?: string;
  outboundDepartAirport?: string;
  outboundDepartDate?: string;
  outboundDepartTime?: string;
  outboundArriveAirport?: string;
  outboundArriveDate?: string;
  outboundArriveTime?: string;
  inboundDepartAirport?: string;
  inboundDepartDate?: string;
  inboundDepartTime?: string;
  inboundArriveAirport?: string;
  inboundArriveDate?: string;
  inboundArriveTime?: string;
  tourOperator?: string;
  sales?: number;
  price?: number;
  commission?: number;
  discount?: number;
  serviceCharge?: number;
  pricePerPerson?: number;
}

export interface QuoteFilters {
  status?: string;
  clientId?: string;
}
