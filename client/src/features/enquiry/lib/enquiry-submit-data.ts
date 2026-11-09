import { holidayKind, nightsAsNumbers, type EnquiryForm } from "./enquiry-form";

/** The enquiry body the form hands to its caller (same keys as the old wizard, per holiday type). */
export type EnquirySubmitData = {
  title: string;
  holiday_type_id: string;
  notes?: string;
  is_test: boolean;
  travel_date?: string;
  adults?: number;
  children?: number;
  infants?: number;
  no_of_nights?: number;
  flexible_nights?: number[];
  budget?: string;
  max_budget?: string;
  budget_type?: string;
  accom_min_star_rating?: string;
  flexibility_date?: string;
  flexible_date?: string;
  weekend_lodge?: string;
  no_of_guests?: number;
  no_of_pets?: number;
  accomodation_type_id?: string;
  cabin_type?: string;
  pre_cruise_stay?: number;
  post_cruise_stay?: number;
  destinations?: string[];
  resorts?: string[];
  accommodations?: string[];
  boardBases?: string[];
  departureAirports?: string[];
  passengers?: { type: string; age: number }[];
};

const orUndefined = <T>(list: T[]): T[] | undefined => (list.length ? list : undefined);

/**
 * Builds the submit body for the form's holiday type. Copied from the old wizard's
 * handleSubmit: the "Number of Nights" choice stores every duration in flexible_nights,
 * and the first one is the primary no_of_nights.
 */
export function buildEnquirySubmitData(form: EnquiryForm): EnquirySubmitData {
  const kind = holidayKind(form.holidayTypeName);
  const selectedNights = nightsAsNumbers(form.flexibleNights);
  const primaryNights = selectedNights[0];
  const flexibleNights = orUndefined(selectedNights);
  const childPassengers = form.childAges.map((age) => ({ type: "child", age }));

  const base: EnquirySubmitData = {
    title: form.title.trim(),
    holiday_type_id: form.holidayType,
    notes: form.notes || undefined,
    is_test: form.isTest,
  };

  if (kind === "hottub") {
    return {
      ...base,
      budget: form.budget || form.maxBudget || undefined,
      max_budget: form.maxBudget || undefined,
      budget_type: form.budgetType || undefined,
      no_of_nights: primaryNights ?? undefined,
      flexible_nights: flexibleNights,
      no_of_guests: form.guests || undefined,
      no_of_pets: form.pets > 0 ? form.pets : 0,
      travel_date: form.travelDate || undefined,
      flexible_date: form.flexibleOnDate ? "Yes" : "No",
      weekend_lodge: form.weekendLodge ? "Yes" : "No",
      accomodation_type_id: form.accommodationType || undefined,
      destinations: orUndefined(form.destinations),
    };
  }

  if (kind === "cruise") {
    return {
      ...base,
      travel_date: form.travelDate || undefined,
      no_of_nights: primaryNights ?? undefined,
      flexible_nights: flexibleNights,
      budget: form.budget || form.maxBudget || undefined,
      max_budget: form.maxBudget || undefined,
      budget_type: form.budgetType || undefined,
      adults: form.adults,
      children: form.children,
      infants: form.infants,
      flexibility_date: form.flexibility || undefined,
      cabin_type: form.cabinType || undefined,
      pre_cruise_stay: form.preCruiseDays ? parseInt(form.preCruiseDays, 10) : undefined,
      post_cruise_stay: form.postCruiseDays ? parseInt(form.postCruiseDays, 10) : undefined,
      destinations: form.destinations[0] ? [form.destinations[0]] : undefined,
      departureAirports: orUndefined(form.airports),
      passengers: orUndefined(childPassengers),
    };
  }

  return {
    ...base,
    travel_date: form.travelDate || undefined,
    adults: form.adults,
    children: form.children,
    infants: form.infants,
    no_of_nights: primaryNights ?? undefined,
    flexible_nights: flexibleNights,
    budget: form.budget || undefined,
    budget_type: form.budgetType || undefined,
    accom_min_star_rating: form.starRating || undefined,
    flexibility_date: form.flexibility || undefined,
    destinations: orUndefined(form.destinations),
    resorts: orUndefined(form.resorts),
    accommodations: orUndefined(form.accommodations),
    boardBases: orUndefined(form.boardBasis),
    departureAirports: orUndefined(form.airports),
    passengers: orUndefined(childPassengers),
  };
}
