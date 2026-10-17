import { buildEnquiryTransaction } from "@/features/enquiry";
import type { CreateTransactionData } from "@/features/quote/types";
import { holidayKind, type EnquiryForm, type LeadSource } from "./enquiry-form";

const toInt = (v: string): number | undefined => {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
};

/**
 * The wizard's submit shape for the form's holiday type (same keys per type),
 * which `buildEnquiryTransaction` then maps into the create-transaction body.
 */
function wizardData(form: EnquiryForm): Record<string, unknown> {
  const kind = holidayKind(form.holidayTypeName);
  const nights = form.nights > 0 ? form.nights : undefined;
  const childPassengers = form.childAges.map((age) => ({ type: "child", age }));
  const base: Record<string, unknown> = {
    title: form.title.trim(),
    holiday_type_id: form.holidayType,
    notes: form.notes || undefined,
    is_test: false,
  };

  if (kind === "hottub") {
    return {
      ...base,
      budget: form.budget || undefined,
      budget_type: form.budgetType || undefined,
      no_of_nights: nights,
      flexible_nights: nights ? [nights] : undefined,
      no_of_guests: form.guests || undefined,
      no_of_pets: form.pets === "Yes" ? 1 : 0,
      travel_date: form.travelDate || undefined,
      flexible_date: form.flexibleOnDate ? "Yes" : "No",
      weekend_lodge: form.weekendLodge ? "Yes" : "No",
      accomodation_type_id: form.accommodationType || undefined,
      destinations: form.destinations.length ? form.destinations : undefined,
    };
  }

  const travellers = {
    travel_date: form.travelDate || undefined,
    adults: form.adults,
    children: form.children,
    infants: form.infants,
    no_of_nights: nights,
    flexible_nights: nights ? [nights] : undefined,
    budget: form.budget || undefined,
    budget_type: form.budgetType || undefined,
    flexibility_date: form.flexibility || undefined,
    destinations: form.destinations.length ? form.destinations : undefined,
    departureAirports: form.airports.length ? form.airports : undefined,
    passengers: childPassengers.length ? childPassengers : undefined,
  };

  if (kind === "cruise") {
    return {
      ...base,
      ...travellers,
      cabin_type: form.cabinType || undefined,
      pre_cruise_stay: form.preCruiseDays ? toInt(form.preCruiseDays) : undefined,
      post_cruise_stay: form.postCruiseDays ? toInt(form.postCruiseDays) : undefined,
    };
  }

  return {
    ...base,
    ...travellers,
    accom_min_star_rating: form.starRating || undefined,
    resorts: form.resorts.length ? form.resorts : undefined,
    boardBases: form.boardBasis.length ? form.boardBasis : undefined,
  };
}

/** Create-transaction body for the drawer: same enquiry shape as the wizard, plus lead source and assignee. */
export function buildInboxEnquiryPayload(
  form: EnquiryForm,
  opts: { clientId: string; userId: string; leadSource: LeadSource },
): CreateTransactionData {
  const tx = buildEnquiryTransaction(wizardData(form), { clientId: opts.clientId, userId: opts.userId });
  return { ...tx, lead_source: opts.leadSource };
}
