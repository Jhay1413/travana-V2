import type { Client as ApiClient } from "@/types/client";
import type { NeonClient } from "@/types/neon-client";
import type { Ticket as ApiTicket } from "@/types/ticket";
import type { Quote as ApiQuote, Booking, DealImage } from "@/types/quote";

export type QuoteWithJoins = ApiQuote & { holiday_type_name?: string };
export type BookingWithJoins = Booking & { images?: DealImage[]; holiday_type_name?: string; user_id?: string };

export type Stage = "Enquiry" | "Quote" | "Booked";

export type ClientTier = "Platinum" | "Gold" | "Standard";

export type Client = {
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
};

export type TicketItem = {
  id: string;
  subject: string;
  type: string;
  status: string;
  priority: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  userId: string;
};

export type FileItem = {
  id: string;
  name: string;
  type: "PDF" | "DOC" | "IMG";
  updated: string;
};

export type QuotePassenger = {
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
};

export type QuoteFlightLeg = {
  departAirport: string;
  departCity: string;
  departDate: string;
  departTime: string;
  arriveAirport: string;
  arriveCity: string;
  arriveDate: string;
  arriveTime: string;
};

export type QuoteCommission = {
  tourOperator: string;
  sales: number;
  price: number;
  commission: number;
  discount: number;
  serviceCharge: number;
  pricePerPerson: number;
};

export type Quote = {
  id: string;
  packageType: string;
  quoteTitle: string;
  quoteLink: string;
  images: { id: string; label: string }[];
  travelDate: string;
  passengers: QuotePassenger;
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
  flights: {
    outbound: QuoteFlightLeg;
    inbound: QuoteFlightLeg;
  };
  commissions: QuoteCommission;
  jsonPayload: string;
};

export const currency = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
});

export function tierPill(tier: ClientTier) {
  switch (tier) {
    case "Platinum":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Gold":
      return "border-amber-500/25 bg-amber-500/10 text-amber-800";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function stagePill(stage: Stage) {
  switch (stage) {
    case "Booked":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800";
    case "Quote":
      return "border-sky-500/25 bg-sky-500/10 text-sky-800";
    default:
      return "border-fuchsia-500/25 bg-fuchsia-500/10 text-fuchsia-800";
  }
}

export function transformClientData(apiData: ApiClient): Client {
  return {
    id: apiData.id,
    name: apiData.name,
    tier: apiData.tier as ClientTier,
    stage: apiData.stage as Stage,
    location: apiData.location || "",
    nextTrip: apiData.nextTrip || "",
    value: parseFloat(apiData.value || "0"),
    lastTouch: apiData.lastTouch || "",
    email: apiData.email ?? "",
    phone: apiData.phone ?? "",
    tags: apiData.tags,
  };
}

export function transformNeonClientData(apiData: NeonClient): Client {
  return {
    id: apiData.id,
    name: [apiData.firstName, apiData.surename].filter(Boolean).join(" ") || "Unknown",
    tier: "Standard" as ClientTier,
    stage: "Enquiry" as Stage,
    location: [apiData.city, apiData.country].filter(Boolean).join(", "),
    nextTrip: "",
    value: 0,
    lastTouch: "",
    email: apiData.email || "",
    phone: apiData.phoneNumber || "",
    tags: apiData.badge ? [apiData.badge] : [],
  };
}

export function transformTicket(ticket: ApiTicket): TicketItem {
  return {
    id: ticket.id,
    subject: ticket.subject,
    type: ticket.type,
    status: ticket.status,
    priority: ticket.priority,
    description: ticket.description,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    userId: ticket.userId,
  };
}

export function formatTicketDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ticketStatusPill(status: string) {
  switch (status) {
    case "Open":
      return "border-red-500/25 bg-red-500/10 text-red-700";
    case "In Progress":
      return "border-amber-500/25 bg-amber-500/10 text-amber-700";
    case "Resolved":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    case "Closed":
      return "border-black/10 bg-black/[0.03] text-black/70";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function ticketTypePill(type: string) {
  switch (type) {
    case "Admin":
      return "border-violet-500/25 bg-violet-500/10 text-violet-700";
    case "Build":
      return "border-sky-500/25 bg-sky-500/10 text-sky-700";
    case "Sales":
      return "border-emerald-500/25 bg-emerald-500/10 text-emerald-700";
    default:
      return "border-black/10 bg-black/[0.03] text-black/70";
  }
}

export function filesFor(clientId: string): FileItem[] {
  return [
    { id: `${clientId}-F1`, name: "Passport scan", type: "IMG", updated: "Today" },
    { id: `${clientId}-F2`, name: "Quote v3", type: "PDF", updated: "2d" },
    { id: `${clientId}-F3`, name: "Itinerary draft", type: "DOC", updated: "6d" },
  ];
}

export type ConnectingLeg = {
  departAirportId: string;
  departAirport: string;
  arriveAirportId: string;
  arriveAirport: string;
  departDate: string;
  departTime: string;
  arriveDate: string;
  arriveTime: string;
  flightNumber: string;
};

export type NewQuoteFormState = {
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
  outboundConnectingLegs: ConnectingLeg[];
  inboundConnectingLegs: ConnectingLeg[];
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
  lodgeId: string;
  parkId: string;
  parkName: string;
  pets: boolean;
};

export function safeJsonParse(value: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    const data = JSON.parse(value);
    return { ok: true, data };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }
}

export function formatPax(p: QuotePassenger) {
  const parts: string[] = [];
  parts.push(`${p.adults} adult${p.adults === 1 ? "" : "s"}`);
  if (p.children > 0) parts.push(`${p.children} child${p.children === 1 ? "" : "ren"}`);
  if (p.infants > 0) parts.push(`${p.infants} infant${p.infants === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

export function computePaxTotal(p: QuotePassenger) {
  return p.adults + p.children + p.infants;
}

export function formatUKDate(value: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value.trim());
  if (!m) return value;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
