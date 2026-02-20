import { z } from "zod";

// ─── Zod Schemas ─────────────────────────────────────────────────────────────

export const flightLegSchema = z.object({
  departAirportId: z.string().default(""),
  departAirport: z.string().default(""),
  arriveAirportId: z.string().default(""),
  arriveAirport: z.string().default(""),
  departDate: z.string().default(""),
  departTime: z.string().default(""),
  arriveDate: z.string().default(""),
  arriveTime: z.string().default(""),
  flightNumber: z.string().default(""),
});

export const quoteFormSchema = z.object({
  // Overview
  packageType: z.string().min(1, "Package type is required"),
  quoteTitle: z.string().default(""),
  quoteLink: z.string().default(""),
  leadSource: z.string().default(""),
  status: z.string().default("draft"),
  tourOperatorId: z.string().default(""),

  // Travel
  travelDate: z.string().default(""),
  nights: z.coerce.number().int().min(1).default(7),
  passengersAdults: z.coerce.number().int().min(1).default(2),
  passengersChildren: z.coerce.number().int().min(0).default(0),
  passengersInfants: z.coerce.number().int().min(0).default(0),
  childAges: z.array(z.coerce.number().int().min(0)).default([]),
  transferType: z.string().default(""),
  preBookedSeats: z.string().default(""),
  flightMeals: z.string().default(""),

  // Destination / Accommodation
  country: z.string().default(""),
  destination: z.string().default(""),
  resort: z.string().default(""),
  accommodationId: z.string().default(""),
  boardBasisId: z.string().default(""),
  checkInDate: z.string().default(""),
  checkInTime: z.string().default(""),
  roomType: z.string().default(""),

  // Outbound Flight
  outboundDepartAirportId: z.string().default(""),
  outboundArriveAirportId: z.string().default(""),
  outboundDepartDate: z.string().default(""),
  outboundDepartTime: z.string().default(""),
  outboundArriveDate: z.string().default(""),
  outboundArriveTime: z.string().default(""),
  outboundFlightNumber: z.string().default(""),
  outboundConnectingLegs: z.array(flightLegSchema).default([]),

  // Inbound Flight
  inboundDepartAirportId: z.string().default(""),
  inboundArriveAirportId: z.string().default(""),
  inboundDepartDate: z.string().default(""),
  inboundDepartTime: z.string().default(""),
  inboundArriveDate: z.string().default(""),
  inboundArriveTime: z.string().default(""),
  inboundFlightNumber: z.string().default(""),
  inboundConnectingLegs: z.array(flightLegSchema).default([]),

  // Lodge (Hot Tub Break)
  lodgeId: z.string().default(""),
  parkId: z.string().default(""),
  pets: z.boolean().default(false),

  // Cruise
  cruiseTitle: z.string().default(""),
  cruiseLine: z.string().default(""),
  shipName: z.string().default(""),
  cruiseDate: z.string().default(""),
  cabinType: z.string().default(""),
  embarkation: z.string().default(""),
  debarkation: z.string().default(""),
  cruiseExtras: z.string().default(""),
  cruiseOnly: z.boolean().default(false),

  // Pricing
  price: z.coerce.number().min(0).default(0),
  commission: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  serviceCharge: z.coerce.number().min(0).default(0),
  pricePerPerson: z.coerce.number().min(0).default(0),
});

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type FlightLegValue = z.infer<typeof flightLegSchema>;
export type QuoteFormValues = z.infer<typeof quoteFormSchema>;

// ─── Default Values ───────────────────────────────────────────────────────────

export const defaultQuoteFormValues: QuoteFormValues = {
  packageType: "",
  quoteTitle: "",
  quoteLink: "",
  leadSource: "",
  status: "draft",
  tourOperatorId: "",
  travelDate: "",
  nights: 7,
  passengersAdults: 2,
  passengersChildren: 0,
  passengersInfants: 0,
  childAges: [],
  transferType: "",
  preBookedSeats: "",
  flightMeals: "",
  country: "",
  destination: "",
  resort: "",
  accommodationId: "",
  boardBasisId: "",
  checkInDate: "",
  checkInTime: "",
  roomType: "",
  outboundDepartAirportId: "",
  outboundArriveAirportId: "",
  outboundDepartDate: "",
  outboundDepartTime: "",
  outboundArriveDate: "",
  outboundArriveTime: "",
  outboundFlightNumber: "",
  outboundConnectingLegs: [],
  inboundDepartAirportId: "",
  inboundArriveAirportId: "",
  inboundDepartDate: "",
  inboundDepartTime: "",
  inboundArriveDate: "",
  inboundArriveTime: "",
  inboundFlightNumber: "",
  inboundConnectingLegs: [],
  parkId: "",
  lodgeId: "",
  pets: false,
  cruiseTitle: "",
  cruiseLine: "",
  shipName: "",
  cruiseDate: "",
  cabinType: "",
  embarkation: "",
  debarkation: "",
  cruiseExtras: "",
  cruiseOnly: false,
  price: 0,
  commission: 0,
  discount: 0,
  serviceCharge: 0,
  pricePerPerson: 0,
};

// ─── Component Prop Types ─────────────────────────────────────────────────────

export interface QuoteRHFFormProps {
  defaultValues?: Partial<QuoteFormValues>;
  onSubmit: (values: QuoteFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

export interface QuoteEditDialogProps {
  quoteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export interface QuoteCreateDialogProps {
  transactionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (quoteId: string) => void;
  initialValues?: Partial<QuoteFormValues>;
}
