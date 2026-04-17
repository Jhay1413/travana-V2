/**
 * Type Definitions for Quote Page
 * Centralized type definitions for quote display and management.
 */

import type { EnrichedQuote, EnrichedBooking, TransactionNote, Passenger, DealImage, EnrichedTransfer, EnrichedCarHire, EnrichedAttractionTicket, EnrichedLoungePass, EnrichedAirportParking } from "@/types/quote";

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
  pricePerPerson: number;
  tags: string[];
  notes: string[];
  lodge?: { name: string; type: string; code: string; parkName?: string; parkLocation?: string };
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
  transfers: Array<{ pickUpLocation: string | null; dropOffLocation: string | null; pickUpTime: string | null; dropOffTime: string | null; note: string | null; tourOperatorName: string | null }>;
  carHires: Array<{ pickUpLocation: string | null; dropOffLocation: string | null; pickUpTime: string | null; dropOffTime: string | null; noOfDays: number | null; tourOperatorName: string | null }>;
  attractionTickets: Array<{ ticketType: string | null; dateOfVisit: string | null; numberOfTickets: number; tourOperatorName: string | null }>;
  loungePasses: Array<{ terminal: string | null; airportName: string | null; dateOfUsage: string | null; note: string | null; tourOperatorName: string | null }>;
  airportParkings: Array<{ parkingType: string | null; airportName: string | null; parkingDate: string | null; duration: string | null; tourOperatorName: string | null }>;
  extraAccommodations: Array<{ property: string; checkInDate: string; noOfNights: number | null; board: string; roomType: string; tourOperatorName: string | null }>;
};

export type { EnrichedQuote, EnrichedBooking, TransactionNote, Passenger, DealImage, EnrichedTransfer, EnrichedCarHire, EnrichedAttractionTicket, EnrichedLoungePass, EnrichedAirportParking };
