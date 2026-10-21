import { z } from "zod";

export const addImagesValidator = z.object({
  body: z.object({
    images: z.array(z.string().url()).min(1, "At least one image URL is required"),
  }),
});

// The full desired image order, as ids — see the quote module's equivalent.
export const reorderImagesValidator = z.object({
  body: z
    .object({
      imageIds: z.array(z.string().min(1)).optional(),
      imageUrls: z.array(z.string().min(1)).optional(),
    })
    .refine((b) => !!b.imageIds?.length || !!b.imageUrls?.length, {
      message: "Provide imageIds or imageUrls",
    }),
});

// PATCH /:id — the edit drawer sends a large free-form payload, so everything
// passes through untouched. Only the two references are checked: when the key is
// present it must be a non-empty string (the columns are NOT NULL, so null is
// refused too). validate() does not write parsed values back, so the service
// does the actual trimming.
const bookingRefField = z.string({ invalid_type_error: "Reference cannot be empty" }).trim().min(1, "Reference cannot be empty").optional();

export const updateBookingValidator = z.object({
  body: z
    .object({
      hays_ref: bookingRefField,
      supplier_ref: bookingRefField,
    })
    .passthrough(),
});

// POST /convert/:quoteId — both references are required.
export const convertQuoteToBookingValidator = z.object({
  params: z.object({ quoteId: z.string().min(1) }),
  body: z.object({
    haysRef: z.string({ required_error: "HAYS ref is required" }).trim().min(1, "HAYS ref is required"),
    supplierRef: z.string({ required_error: "Supplier ref is required" }).trim().min(1, "Supplier ref is required"),
  }),
});
