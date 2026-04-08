import { z } from "zod";

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

export const bookingFormSchema = z.object({
  haysRef: z.string().default(""),
  supplierRef: z.string().default(""),
  bookingStatus: z.string().default("BOOKED"),

  packageType: z.string().min(1, "Package type is required"),
  quoteTitle: z.string().default(""),
  leadSource: z.string().default(""),
  tourOperatorId: z.string().default(""),

  travelDate: z.string().default(""),
  nights: z.coerce.number().int().min(1).default(7),
  passengersAdults: z.coerce.number().int().min(1).default(2),
  passengersChildren: z.coerce.number().int().min(0).default(0),
  passengersInfants: z.coerce.number().int().min(0).default(0),
  childAges: z.array(z.coerce.number().int().min(0)).default([]),
  transferType: z.string().default(""),
  preBookedSeats: z.string().default(""),
  flightMeals: z.string().default("No"),

  country: z.string().default(""),
  destination: z.string().default(""),
  resort: z.string().default(""),
  accommodationId: z.string().default(""),
  boardBasisId: z.string().default(""),
  checkInDate: z.string().default(""),
  checkInTime: z.string().default(""),
  roomType: z.string().default(""),

  outboundDepartAirportId: z.string().default(""),
  outboundArriveAirportId: z.string().default(""),
  outboundDepartDate: z.string().default(""),
  outboundDepartTime: z.string().default(""),
  outboundArriveDate: z.string().default(""),
  outboundArriveTime: z.string().default(""),
  outboundFlightNumber: z.string().default(""),
  outboundConnectingLegs: z.array(flightLegSchema).default([]),

  inboundDepartAirportId: z.string().default(""),
  inboundArriveAirportId: z.string().default(""),
  inboundDepartDate: z.string().default(""),
  inboundDepartTime: z.string().default(""),
  inboundArriveDate: z.string().default(""),
  inboundArriveTime: z.string().default(""),
  inboundFlightNumber: z.string().default(""),
  inboundConnectingLegs: z.array(flightLegSchema).default([]),

  lodgeId: z.string().default(""),
  parkId: z.string().default(""),
  pets: z.boolean().default(false),

  cruiseTitle: z.string().default(""),
  cruiseLine: z.string().default(""),
  shipName: z.string().default(""),
  cruiseDate: z.string().default(""),
  cabinType: z.string().default(""),
  embarkation: z.string().default(""),
  debarkation: z.string().default(""),
  cruiseExtras: z.string().default(""),
  cruiseOnly: z.boolean().default(false),

  price: z.coerce.number().min(0).default(0),
  commission: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  serviceCharge: z.coerce.number().min(0).default(0),
  pricePerPerson: z.coerce.number().min(0).default(0),

  // Extras
  transfers: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    pickUpLocation: z.string().default(""),
    dropOffLocation: z.string().default(""),
    pickUpDate: z.string().default(""),
    pickUpTime: z.string().default(""),
    dropOffDate: z.string().default(""),
    dropOffTime: z.string().default(""),
    note: z.string().default(""),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),

  carHires: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    pickUpLocation: z.string().default(""),
    dropOffLocation: z.string().default(""),
    pickUpDate: z.string().default(""),
    pickUpTime: z.string().default(""),
    dropOffDate: z.string().default(""),
    dropOffTime: z.string().default(""),
    noOfDays: z.coerce.number().int().min(0).default(1),
    driverAge: z.coerce.number().int().min(0).default(25),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),

  attractionTickets: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    ticketType: z.string().default(""),
    dateOfVisit: z.string().default(""),
    numberOfTickets: z.coerce.number().int().min(1).default(1),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),

  loungePasses: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    airportId: z.string().default(""),
    terminal: z.string().default(""),
    dateOfUsage: z.string().default(""),
    note: z.string().default(""),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),

  airportParkings: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    airportId: z.string().default(""),
    parkingType: z.string().default(""),
    parkingDate: z.string().default(""),
    carMake: z.string().default(""),
    carModel: z.string().default(""),
    colour: z.string().default(""),
    carRegNumber: z.string().default(""),
    duration: z.string().default(""),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),

  extraAccommodations: z.array(z.object({
    bookingRef: z.string().default(""),
    tourOperatorId: z.string().default(""),
    accommodationId: z.string().default(""),
    boardBasisId: z.string().default(""),
    roomType: z.string().default(""),
    checkInDate: z.string().default(""),
    checkInTime: z.string().default(""),
    noOfNights: z.coerce.number().int().min(0).default(0),
    cost: z.coerce.number().min(0).default(0),
    commission: z.coerce.number().min(0).default(0),
    isIncludedInPackage: z.boolean().default(true),
  })).default([]),
  tags: z.array(z.string()).default([]),
});

export type FlightLegValue = z.infer<typeof flightLegSchema>;
export type BookingFormValues = z.infer<typeof bookingFormSchema>;
export type ExtrasFormValues = Pick<BookingFormValues, "transfers" | "carHires" | "attractionTickets" | "loungePasses" | "airportParkings" | "extraAccommodations">;

export const defaultBookingFormValues: BookingFormValues = {
  haysRef: "",
  supplierRef: "",
  bookingStatus: "BOOKED",
  packageType: "",
  quoteTitle: "",
  leadSource: "",
  tourOperatorId: "",
  travelDate: "",
  nights: 7,
  passengersAdults: 2,
  passengersChildren: 0,
  passengersInfants: 0,
  childAges: [],
  transferType: "",
  preBookedSeats: "",
  flightMeals: "No",
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
  transfers: [],
  carHires: [],
  attractionTickets: [],
  loungePasses: [],
  airportParkings: [],
  extraAccommodations: [],
  tags: [],
};

export interface BookingRHFFormProps {
  defaultValues?: Partial<BookingFormValues>;
  onSubmit: (values: BookingFormValues) => Promise<void> | void;
  isLoading?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
}

export interface BookingCreateDialogProps {
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (bookingId: string) => void;
  initialValues?: Partial<BookingFormValues>;
}

export interface BookingUpdateDialogProps {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}
