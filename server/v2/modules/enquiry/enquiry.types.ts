/** The enquiry_table columns a user may edit. Everything else in a request body is dropped before a write. */
export const ENQUIRY_EDITABLE_COLUMNS = [
  "holiday_type_id",
  "accomodation_type_id",
  "travel_date",
  "adults",
  "children",
  "infants",
  "cabin_type",
  "title",
  "flexibility_date",
  "flexible_date",
  "weekend_lodge",
  "accom_min_star_rating",
  "no_of_nights",
  "flexible_nights",
  "budget",
  "max_budget",
  "budget_type",
  "no_of_guests",
  "no_of_pets",
  "pre_cruise_stay",
  "post_cruise_stay",
  "status",
  "email",
] as const;

/** Copy only the editable enquiry columns out of a request body (the service's defence behind the validator). */
export function pickEditableEnquiryFields(body: Record<string, unknown>): Record<string, unknown> {
  const picked: Record<string, unknown> = {};
  for (const key of ENQUIRY_EDITABLE_COLUMNS) {
    if (body[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}
