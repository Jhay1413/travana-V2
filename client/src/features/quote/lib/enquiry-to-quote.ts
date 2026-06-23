import type { EnquiryTable } from "@/features/quote/types/quote.types";
import type { QuoteFormValues } from "@/features/quote/types/quote-form.types";
import { defaultQuoteFormValues } from "@/features/quote/types/quote-form.types";

/**
 * Maps a fully-hydrated EnquiryTable (including passengers, destinations,
 * resorts, boardBases, and airports relations) to the subset of QuoteFormValues
 * that can be pre-filled from that enquiry.
 *
 * This is the single source of truth for the enquiry→quote seeding logic.
 * The enquiry-details page, the client enquiry list, and the pipeline board all
 * use this function so the flows cannot drift apart.
 *
 * NOTE: the enquiry API returns resort rows keyed as `resorts_id` (see
 * server enquiry.repository.ts), even though the EnquiryResort type declares
 * `resort_id`. We read both so the resort always populates.
 */
export function buildQuoteInitialValuesFromEnquiry(enq: EnquiryTable): Partial<QuoteFormValues> {
  const firstDestination = enq.destinations?.[0];
  const firstResort = enq.resorts?.[0];
  const firstAirport = enq.airports?.[0];
  const firstBoardBasis = enq.boardBases?.[0];

  return {
    ...defaultQuoteFormValues,
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
    country: (firstDestination as unknown as { country_id?: string })?.country_id || "",
    destination: firstDestination?.destination_id || "",
    resort: firstResort?.resort_id || (firstResort as unknown as { resorts_id?: string })?.resorts_id || "",
    boardBasisId: firstBoardBasis?.board_basis_id || "",
    outboundDepartAirportId: firstAirport?.airport_id || "",
    cabinType: enq.cabin_type || "",
    pets: enq.no_of_pets ?? 0,
    status: "QUOTE_IN_PROGRESS",
  };
}
