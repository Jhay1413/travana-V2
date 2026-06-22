import type { EnquiryTable } from "@/features/quote/types/quote.types";
import type { QuoteFormValues } from "@/features/quote/types/quote-form.types";

/**
 * Maps a fully-hydrated EnquiryTable (including passengers, destinations,
 * resorts, boardBases, and airports relations) to the subset of QuoteFormValues
 * that can be pre-filled from that enquiry.
 *
 * This is the single source of truth for the enquiry→quote seeding logic.
 * Both the client-details page and the pipeline board use this function so
 * the two flows cannot drift apart.
 */
export function buildQuoteInitialValuesFromEnquiry(enq: EnquiryTable): Partial<QuoteFormValues> {
  return {
    packageType: enq.holiday_type_id || "",
    quoteTitle: enq.title || "",
    travelDate: enq.travel_date || "",
    passengersAdults: enq.adults || 2,
    passengersChildren: enq.children || 0,
    passengersInfants: enq.infants || 0,
    childAges: (enq.passengers ?? [])
      .filter((p) => p.type === "child")
      .map((p) => p.age ?? 0),
    nights: enq.no_of_nights || 7,
    destination: enq.destinations?.[0]?.destination_id || "",
    resort: enq.resorts?.[0]?.resort_id || "",
    boardBasisId: enq.boardBases?.[0]?.board_basis_id || "",
    outboundDepartAirportId: enq.airports?.[0]?.airport_id || "",
  };
}
