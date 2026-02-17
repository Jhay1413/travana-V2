import type { DealImage } from "@/types/quote";
import type { Quote as ApiQuote, Booking } from "@/types/quote";

export type QuoteWithJoins = ApiQuote & { holiday_type_name?: string };
export type BookingWithJoins = Booking & { images?: DealImage[]; holiday_type_name?: string };

export type Stage = "Enquiry" | "Quote" | "Booked";
export type ClientTier = "Platinum" | "Gold" | "Standard";
export type ClientTab = "overview" | "enquiries" | "quotes" | "booked" | "files" | "tickets";

export interface Client {
  id: string;
  name: string;
  tier: ClientTier;
  stage: Stage;
  location: string;
  nextTrip: string;
  value: number;
  lastTouch: string;
  email: string;
  phone: string;
  tags: string[];
}

export interface TicketItem {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
}

export interface FileItem {
  id: string;
  name: string;
  type: "PDF" | "DOC" | "IMG";
  updated: string;
}

export interface QuotePassenger {
  adults: number;
  children: number;
  infants?: number;
}

export interface NewQuoteForm {
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  jsonPayload: string;
  travelDate: string;
  passengersAdults: number;
  passengersChildren: number;
  passengersInfants: number;
  childAges: number[];
  country: string;
  destination: string;
  resort: string;
  accommodation: string;
  checkInDate: string;
  checkInTime: string;
  nights: number;
  boardBasis: string;
  roomType: string;
  transferType: string;
  preBookedSeats: string;
  flightMeals: string;
  leadSource: string;
  outboundDepartAirport: string;
  outboundDepartDate: string;
  outboundDepartTime: string;
  outboundArriveAirport: string;
  outboundArriveDate: string;
  outboundArriveTime: string;
  inboundDepartAirport: string;
  inboundDepartDate: string;
  inboundDepartTime: string;
  inboundArriveAirport: string;
  inboundArriveDate: string;
  inboundArriveTime: string;
  tourOperator: string;
  sales: number;
  price: number;
  commission: number;
  discount: number;
  serviceCharge: number;
  pricePerPerson: number;
  returnDate: string;
  haysReference: string;
  tourReference: string;
  cruiseTitle: string;
  cruiseLine: string;
  shipName: string;
  cruiseDate: string;
  cabinType: string;
  embarkation: string;
  debarkation: string;
  cruiseExtras: string;
  cruiseOnly: boolean;
  lodgeCode: string;
  parkName: string;
  pets: boolean;
}

export interface EditClientForm {
  title: string;
  firstName: string;
  surename: string;
  phoneNumber: string;
  email: string;
  DOB: string;
  houseNumber: string;
  street: string;
  city: string;
  country: string;
  post_code: string;
  badge: string;
}

export interface UploadFileForm {
  file: File | null;
  title: string;
  fileType: string;
  allocationType: string;
  allocationId: string;
}
