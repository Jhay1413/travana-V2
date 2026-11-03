import { z } from "zod";

// PATCH /enquiries/:id. Only the enquiry's own content columns are editable. Ownership, tenancy and lifecycle
// columns (id, transaction_id, org / branch, deleted_at / deleted_by, date_created) are refused here and also
// stripped in the service (validate() does not write parsed values back), so a body can never re-parent an
// enquiry onto another deal or revive a deleted one. The enquiry form also posts relation lists and a few
// non-column keys (notes, is_test, destinations, ...): those are tolerated and handled or dropped downstream.

const text = z.string().nullable().optional();
const num = z.union([z.number(), z.string()]).nullable().optional();
const uuid = z.string().uuid().nullable().optional();

/** Keys a request may never set on an enquiry (any spelling of ownership / tenancy / lifecycle). */
export const ENQUIRY_FORBIDDEN_KEYS = [
  "id",
  "transaction_id",
  "transactionId",
  "org_id",
  "orgId",
  "branch_id",
  "branchId",
  "user_id",
  "deleted_at",
  "deleted_by",
  "deletion_code",
  "date_created",
  "is_active",
] as const;

const enquiryFields = {
  // holiday_type_id is NOT NULL: never null, never blank.
  holiday_type_id: z.string().uuid("Invalid holiday type").optional(),
  accomodation_type_id: uuid,
  travel_date: text,
  adults: num,
  children: num,
  infants: num,
  cabin_type: text,
  title: text,
  flexibility_date: text,
  flexible_date: text,
  weekend_lodge: text,
  accom_min_star_rating: text,
  no_of_nights: num,
  flexible_nights: z.array(z.union([z.number(), z.string()])).nullable().optional(),
  budget: num,
  max_budget: num,
  budget_type: text,
  no_of_guests: num,
  no_of_pets: num,
  pre_cruise_stay: num,
  post_cruise_stay: num,
  status: text,
  email: text,
};

export const updateEnquiryValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid enquiry id") }),
  body: z
    .object(enquiryFields)
    .passthrough()
    .superRefine((value, ctx) => {
      const body = value as Record<string, unknown>;
      for (const key of ENQUIRY_FORBIDDEN_KEYS) {
        if (key in body) ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${key} cannot be set` });
      }
    }),
});
