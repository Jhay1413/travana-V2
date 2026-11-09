import type { EnquiryDestination, EnquiryPassenger, EnquiryPassengerInput, EnquiryTable } from "@/features/quote/types";
import { DEFAULT_FORM, fitChildAges, type EnquiryForm } from "./enquiry-form";

type EnquiryRecord = EnquiryTable & { is_test?: boolean | null };
/** The detail endpoint also returns the destination's country. */
type DestinationRecord = EnquiryDestination & { country_id?: string | null };

/** Hot tub breaks keep "Yes"/"No" in flexible_date; only a real flexibility choice counts here. */
const flexibilityChoice = (v: string | null): string => (v === "Yes" || v === "No" ? "" : v || "");

/** The server stores PER_PERSON / PACKAGE; the form's chips use the labels it sends on save. */
const budgetTypeLabel = (v: string | null | undefined): string => {
  if (v === "PACKAGE" || v?.toLowerCase() === "package") return "Package";
  return "Per Person";
};

const isChild =(p: EnquiryPassenger | EnquiryPassengerInput): boolean => p.type === "child";

/**
 * Prefills the form from a saved enquiry (copied from the wizard's formFromEnquiry).
 * Notes are not loaded: the enquiry row does not carry them, as before.
 */
export function enquiryToForm(enquiry: EnquiryTable): EnquiryForm {
  const record: EnquiryRecord = enquiry;
  const labels: Record<string, string> = {};
  const countryOf: Record<string, string> = {};

  const destinations: string[] = [];
  const countries: string[] = [];
  for (const d of (record.destinations ?? []) as DestinationRecord[]) {
    const id = d.destination_id;
    if (!id) continue;
    destinations.push(id);
    const name = d.destination_name || d.name;
    if (name) labels[id] = name;
    if (d.country_id) {
      countryOf[id] = d.country_id;
      if (!countries.includes(d.country_id)) countries.push(d.country_id);
    }
  }

  const resorts: string[] = [];
  for (const r of record.resorts ?? []) {
    const id = r.resorts_id || r.resort_id;
    if (!id) continue;
    resorts.push(id);
    const name = r.resort_name || r.name;
    if (name) labels[id] = name;
  }

  const accommodations: string[] = [];
  for (const a of record.accommodations ?? []) {
    const id = a.accomodation_id;
    if (!id) continue;
    accommodations.push(id);
    const name = a.accomodation_name || a.name;
    if (name) labels[id] = name;
  }

  const boardBasis: string[] = [];
  for (const b of record.boardBases ?? []) {
    if (b.board_basis_id) boardBasis.push(b.board_basis_id);
  }

  const airports: string[] = [];
  for (const a of record.airports ?? []) {
    if (!a.airport_id) continue;
    airports.push(a.airport_id);
    if (a.airport_name) labels[a.airport_id] = a.airport_name;
  }

  const children = record.children || 0;
  const childAges = fitChildAges(
    (record.passengers ?? []).filter(isChild).map((p) => p.age ?? 0),
    children,
  );
  const nights = record.no_of_nights;
  const flexibleNights =
    Array.isArray(record.flexible_nights) && record.flexible_nights.length
      ? record.flexible_nights.map((n) => String(n))
      : nights
        ? [String(nights)]
        : [];

  return {
    ...DEFAULT_FORM,
    title: record.title || "",
    holidayType: record.holiday_type_id || "",
    holidayTypeName: record.holiday_type_name || "",
    countries,
    destinations,
    resorts,
    accommodations,
    airports,
    travelDate: record.travel_date || "",
    flexibility: record.flexibility_date || flexibilityChoice(record.flexible_date),
    flexibleNights,
    adults: record.adults || 2,
    children,
    infants: record.infants || 0,
    childAges,
    budget: record.budget || "",
    maxBudget: record.max_budget || "",
    budgetType: budgetTypeLabel(record.budget_type),
    boardBasis,
    starRating: record.accom_min_star_rating || "",
    notes: "",
    accommodationType: record.accomodation_type_id || "",
    guests: record.no_of_guests || 2,
    pets: record.no_of_pets || 0,
    weekendLodge: record.weekend_lodge === "Yes",
    flexibleOnDate: record.flexible_date === "Yes",
    cabinType: record.cabin_type || "",
    preCruiseDays: record.pre_cruise_stay ? String(record.pre_cruise_stay) : "",
    postCruiseDays: record.post_cruise_stay ? String(record.post_cruise_stay) : "",
    isTest: record.is_test === true,
    labels,
    countryOf,
    destinationOf: {},
  };
}
