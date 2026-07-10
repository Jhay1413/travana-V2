import type { CreateTransactionData, EnquiryPassengerInput } from "@/features/quote/types";

type EnquiryPayload = NonNullable<CreateTransactionData["enquiry"]>;

// Builds the create-transaction payload from the enquiry wizard's submit data.
// Mirrors the mapping used on the client page so an enquiry created from the
// inbox is identical to one created there. `data` uses the wizard's output keys
// (mostly snake_case already), so we read both shapes defensively.
export function buildEnquiryTransaction(
  data: Record<string, unknown>,
  opts: { clientId: string; userId: string },
): CreateTransactionData {
  const str = (a: unknown, b?: unknown) =>
    (typeof a === "string" ? a : undefined) ?? (typeof b === "string" ? b : undefined) ?? undefined;
  const num = (a: unknown, b?: unknown) =>
    (typeof a === "number" ? a : undefined) ?? (typeof b === "number" ? b : undefined) ?? undefined;

  return {
    client_id: opts.clientId,
    user_id: opts.userId,
    is_test: data.is_test === true,
    enquiry: {
      title: str(data.enquiryTitle, data.title) || "",
      holiday_type_id: str(data.holidayType, data.holiday_type_id) || "",
      travel_date: str(data.travelDate, data.travel_date),
      adults: num(data.passengersAdults, data.adults),
      children: num(data.passengersChildren, data.children),
      infants: num(data.passengersInfants, data.infants),
      no_of_nights: num(data.nights, data.no_of_nights),
      flexible_nights: Array.isArray(data.flexible_nights) ? (data.flexible_nights as number[]) : undefined,
      budget: (data.budget as string) || undefined,
      max_budget: (data.max_budget as string) || undefined,
      budget_type: str(data.budgetType, data.budget_type),
      cabin_type: str(data.cabinType, data.cabin_type),
      accom_min_star_rating: (data.accom_min_star_rating as string) || undefined,
      flexibility_date: (data.flexibility_date as string) || undefined,
      flexible_date: (data.flexible_date as string) || undefined,
      weekend_lodge: (data.weekend_lodge as string) || undefined,
      no_of_guests: (data.no_of_guests as number) || undefined,
      no_of_pets: (data.no_of_pets as number) || undefined,
      accomodation_type_id: (data.accomodation_type_id as string) || undefined,
      pre_cruise_stay: (data.pre_cruise_stay as number) || undefined,
      post_cruise_stay: (data.post_cruise_stay as number) || undefined,
      status: "ACTIVE",
      notes: typeof data.notes === "string" && data.notes.trim() ? data.notes.trim() : undefined,
      destinations: Array.isArray(data.destinations)
        ? (data.destinations as unknown as EnquiryPayload["destinations"])
        : undefined,
      resorts: Array.isArray(data.resorts) ? (data.resorts as unknown as EnquiryPayload["resorts"]) : undefined,
      boardBases: Array.isArray(data.boardBases) ? (data.boardBases as unknown as EnquiryPayload["boardBases"]) : undefined,
      departureAirports: Array.isArray(data.departureAirports) ? (data.departureAirports as string[]) : undefined,
      passengers: Array.isArray(data.passengers) ? (data.passengers as EnquiryPassengerInput[]) : undefined,
    },
  };
}
