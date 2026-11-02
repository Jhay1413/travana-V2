import { z } from "zod";

// Request shapes for the quote child routes (flights, accommodations, transfers, passengers). The
// field lists mirror the table columns a user may legitimately set. `id`, `quote_id` and `booking_id`
// (FORBIDDEN_KEYS) are rejected here, and those three plus `leg_order` (PROTECTED_CHILD_KEYS) are also
// stripped in the service, since the validate() helper does not write parsed values back: a child must
// never be re-parented or re-keyed from a request body. Unknown keys are tolerated by Zod's default, but never reach a column.

const uuidOrNull = z.string().uuid().nullable().optional();
const text = z.string().nullable().optional();
const money = z.union([z.string(), z.number()]).nullable().optional();
const dateText = z.string().nullable().optional();
const flag = z.boolean().nullable().optional();

const FORBIDDEN_KEYS = ["id", "quote_id", "booking_id"] as const;

/** Rejects a body that tries to set the row's id or its parent. */
function noReparenting<T extends z.ZodTypeAny>(shape: T) {
  return shape.superRefine((value, ctx) => {
    const body = (value ?? {}) as Record<string, unknown>;
    for (const key of FORBIDDEN_KEYS) {
      if (key in body) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} cannot be set` });
    }
  });
}

const flightFields = {
  flight_number: text,
  flight_ref: text,
  departing_airport_id: uuidOrNull,
  arrival_airport_id: uuidOrNull,
  tour_operator_id: uuidOrNull,
  flight_type: text,
  departure_date_time: dateText,
  arrival_date_time: dateText,
  is_included_in_package: flag,
  cost: money,
  commission: money,
};

const accommodationFields = {
  booking_ref: text,
  tour_operator_id: uuidOrNull,
  no_of_nights: z.union([z.number(), z.string()]).optional(),
  room_type: text,
  board_basis_id: uuidOrNull,
  check_in_date_time: dateText,
  stay_type: text,
  is_primary: flag,
  is_included_in_package: flag,
  cost: money,
  commission: money,
  accomodation_id: uuidOrNull,
};

const transferFields = {
  booking_ref: text,
  tour_operator_id: uuidOrNull,
  pick_up_location: text,
  drop_off_location: text,
  pick_up_time: dateText,
  drop_off_time: dateText,
  is_included_in_package: flag,
  cost: money,
  commission: money,
  note: text,
};

/** Body schemas, shared with the booking child routes (same columns). */
export const flightBody = noReparenting(z.object(flightFields).passthrough());
export const accommodationBody = noReparenting(z.object(accommodationFields).passthrough());

const idParam = z.object({ id: z.string().uuid("Invalid quote id") });

export const addFlightValidator = z.object({ params: idParam, body: flightBody });
export const updateFlightValidator = z.object({
  params: idParam.extend({ flightId: z.string().uuid("Invalid flight id") }),
  body: flightBody,
});
export const addAccommodationValidator = z.object({ params: idParam, body: accommodationBody });
export const updateAccommodationValidator = z.object({
  params: idParam.extend({ accommodationId: z.string().uuid("Invalid accommodation id") }),
  body: accommodationBody,
});
export const addTransferValidator = z.object({ params: idParam, body: noReparenting(z.object(transferFields).passthrough()) });
export const addPassengerValidator = z.object({
  params: idParam,
  body: noReparenting(
    z.object({ type: text, age: z.number().int().min(0).max(120).optional() }).passthrough(),
  ),
});

/** Keys a child request may never set; stripped in the service on top of the validators above. */
export const PROTECTED_CHILD_KEYS = ["id", "quote_id", "booking_id", "leg_order"] as const;

/** A child body may never set its own id or re-parent the row, whatever the route validator let through. */
export function withoutProtectedKeys<T extends object>(data: T): T {
  const copy = { ...data } as Record<string, unknown>;
  for (const key of PROTECTED_CHILD_KEYS) delete copy[key];
  return copy as unknown as T;
}
