// Pure form model for the "Create enquiry from this chat" drawer: defaults,
// holiday-type kinds, option lists and validation. No React, no I/O.

export const FLEXIBILITY_OPTIONS = ["Exact Date", "+/- 3 Days", "+/- 7 Days", "+ 3 Days", "+ 7 Days", "Anytime in Month"];
export const CRUISE_FLEXIBILITY_OPTIONS = ["Exact Date", "+/- 3 Days", "+/- 7 Days", "+ 3 Days", "+ 7 Days", "Any Time"];
export const STAR_RATINGS = ["2 Star", "3 Star", "4 Star", "5 Star"];
export const BUDGET_TYPES = ["Per Person", "Package"];
export const CABIN_TYPES = ["Inside Cabin", "Outside Cabin", "Balcony", "Suite"];
export const LEAD_SOURCES = ["SHOP", "FACEBOOK", "WHATSAPP", "INSTAGRAM", "PHONE_ENQUIRY"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const MAX_NIGHTS = 21;
export const NIGHT_OPTIONS = Array.from({ length: MAX_NIGHTS }, (_, i) => i + 1);
export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_NIGHTS = 7;
export const EXACT_DATE = "Exact Date";
/** Flexibility choices that mean "any time", so no travel date is needed. Relative options ("+/- 3 Days") still need one. */
export const DATELESS_FLEXIBILITY: readonly string[] = ["Anytime in Month", "Any Time"];

export type HolidayKind = "package" | "hottub" | "cruise";

/** Fields that carry a source chip ("From chat" / "Please check" / "Set for you"). */
export type FieldKey =
  | "title"
  | "holidayType"
  | "leadSource"
  | "destinations"
  | "resorts"
  | "airports"
  | "travelDate"
  | "flexibility"
  | "nights"
  | "travellers"
  | "budget"
  | "budgetType"
  | "boardBasis"
  | "starRating"
  | "notes";

export const FIELD_KEYS: FieldKey[] = [
  "title", "holidayType", "leadSource", "destinations", "resorts", "airports", "travelDate",
  "flexibility", "nights", "travellers", "budget", "budgetType", "boardBasis", "starRating", "notes",
];

export type Source = "chat" | "check" | "set";
export type Sources = Record<FieldKey, Source>;

export interface EnquiryForm {
  title: string;
  holidayType: string;
  holidayTypeName: string;
  leadSource: LeadSource;
  destinations: string[];
  resorts: string[];
  countries: string[];
  airports: string[];
  travelDate: string;
  flexibility: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  childAges: number[];
  budget: string;
  budgetType: string;
  boardBasis: string[];
  starRating: string;
  notes: string;
  accommodationType: string;
  guests: number;
  pets: "Yes" | "No";
  weekendLodge: boolean;
  flexibleOnDate: boolean;
  cabinType: string;
  preCruiseDays: string;
  postCruiseDays: string;
  /** id -> display label cache for chips of async-fetched options. */
  labels: Record<string, string>;
  /** destination/resort id -> country id. */
  countryOf: Record<string, string>;
  /** resort id -> destination id. */
  destinationOf: Record<string, string>;
}

export const DEFAULT_FORM: EnquiryForm = {
  title: "",
  holidayType: "",
  holidayTypeName: "",
  leadSource: "SHOP",
  destinations: [],
  resorts: [],
  countries: [],
  airports: [],
  travelDate: "",
  flexibility: "",
  nights: DEFAULT_NIGHTS,
  adults: 2,
  children: 0,
  infants: 0,
  childAges: [],
  budget: "",
  budgetType: "Per Person",
  boardBasis: [],
  starRating: "",
  notes: "",
  accommodationType: "",
  guests: 2,
  pets: "No",
  weekendLodge: false,
  flexibleOnDate: false,
  cabinType: "",
  preCruiseDays: "",
  postCruiseDays: "",
  labels: {},
  countryOf: {},
  destinationOf: {},
};

export function holidayKind(typeName: string): HolidayKind {
  const n = typeName.toLowerCase();
  if (n.includes("hot tub")) return "hottub";
  if (n.includes("cruise")) return "cruise";
  return "package";
}

/** Flexibility choices offered for a holiday kind (hot tub has no flexibility field; it shares the package list). */
export function flexibilityOptionsFor(kind: HolidayKind): string[] {
  return kind === "cruise" ? CRUISE_FLEXIBILITY_OPTIONS : FLEXIBILITY_OPTIONS;
}

/** Lead source implied by the chat channel. */
export function leadSourceForChannel(channel: string): LeadSource {
  if (channel === "whatsapp") return "WHATSAPP";
  if (channel === "messenger") return "FACEBOOK";
  if (channel === "instagram") return "INSTAGRAM";
  return "SHOP";
}

/** "Lanzarote, Spain" -> "Lanzarote". */
export function destinationName(label: string): string {
  return label.split(",")[0].trim();
}

/** Auto title once a destination is known. */
export function autoTitle(destinationLabel: string | undefined): string {
  const name = destinationLabel ? destinationName(destinationLabel) : "";
  return name ? `${name} holiday` : "";
}

/** Keeps the child-age array the same length as the child count. */
export function fitChildAges(ages: number[], children: number): number[] {
  if (ages.length === children) return ages;
  return children > ages.length ? [...ages, ...Array<number>(children - ages.length).fill(0)] : ages.slice(0, children);
}

export type ErrorKey = "title" | "holidayType" | "destinations" | "airports" | "travelDate" | "travellers";
export type FormErrors = Partial<Record<ErrorKey, string>>;

const TRAVEL_DATE_ERROR = "Add the travel date, or choose an any-time flexibility.";

export function validateEnquiryForm(form: EnquiryForm): FormErrors {
  const kind = holidayKind(form.holidayTypeName);
  const errors: FormErrors = {};
  if (!form.title.trim()) errors.title = "Give the enquiry a title.";
  if (!form.holidayType) errors.holidayType = "Pick a holiday type.";
  if (form.destinations.length === 0) errors.destinations = "Where do they want to go?";
  if (kind !== "hottub" && form.airports.length === 0) errors.airports = "Which airport are they flying from?";
  if (!form.travelDate) {
    if (kind === "hottub") {
      if (!form.flexibleOnDate) errors.travelDate = "Add the travel date, or mark the date as flexible.";
    } else if (!DATELESS_FLEXIBILITY.includes(form.flexibility)) {
      errors.travelDate = TRAVEL_DATE_ERROR;
    }
  }
  if (kind !== "hottub" && form.adults < 1) errors.travellers = "Who is travelling?";
  return errors;
}

/** Tomorrow at 10:00 local time. */
export function tomorrowAtTen(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}
