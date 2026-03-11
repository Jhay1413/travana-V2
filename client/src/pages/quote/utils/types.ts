/**
 * Type Definitions for Quote Page
 * Centralized type definitions for quote display and management.
 */

import type { EnrichedQuote, EnrichedBooking, TransactionNote, Passenger, DealImage } from "@/types/quote";

export type QuoteDisplay = {
  id: string;
  transaction_id: string;
  status: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  travelDate: string;
  returnDate: string;
  destination: string;
  destinationName: string;
  country: string;
  countryName: string;
  resort: string;
  resortName: string;
  createdAt: string;
  passengersInfants: number;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  leadSource: string;
  passengers: {
    adults: number;
    children: number;
    childAges: number[];
  };
  accommodation: {
    property: string;
    board: string;
    roomType: string;
    notes: string;
  };
  flights: {
    outbound: {
      from: string;
      to: string;
      carrier: string;
      flightNo: string;
      depart: string;
      arrive: string;
      departDate: string;
      departTime: string;
      arriveDate: string;
      arriveTime: string;
    };
    inbound: {
      from: string;
      to: string;
      carrier: string;
      flightNo: string;
      depart: string;
      arrive: string;
      departDate: string;
      departTime: string;
      arriveDate: string;
      arriveTime: string;
    };
  };
  owner: {
    name: string;
    role: "Agent" | "Manager" | "Homeworker";
  };
  commissions: {
    tourOperator: string;
    price: number;
    discount: number;
    serviceCharge: number;
    commissionPercent: number;
    commissionValue: number;
    agentSplitPercent: number;
    agentSplitValue: number;
    netToAgency: number;
    totalCommission: number;
  };
  tags: string[];
  notes: string[];
  lodge?: { name: string; type: string; code: string };
  cottage?: { name: string; code: string };
  cruise?: {
    cruiseLine: string;
    ship: string;
    cabinType: string;
    cruiseName: string;
    cruiseDate: string;
    preCruiseStay: number;
    postCruiseStay: number;
  };
  pets: number;
  haysRef?: string;
  supplierRef?: string;
};

export type { EnrichedQuote, EnrichedBooking, TransactionNote, Passenger, DealImage };
