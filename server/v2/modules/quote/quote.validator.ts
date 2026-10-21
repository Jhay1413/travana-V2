import { z } from "zod";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../utils/image-storage";
import { ENGAGEMENT_PERIODS, SOCIAL_STATUSES } from "./quote.types";

export const addImagesValidator = z.object({
  body: z.object({
    images: z.array(z.string().url()).min(1, "At least one image URL is required"),
  }),
});

// The full desired image order, as ids. Ids the quote doesn't own are ignored
// downstream (shared accommodation/lodge library images have no per-quote row).
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

// Direct-to-S3 presigned upload for quote images (Option A, single PUT — see
// image-storage.ts). contentType is restricted to the same allowlist the
// storage layer keys extensions for.
export const presignQuoteImagesValidator = z.object({
  body: z.object({
    files: z
      .array(
        z.object({
          filename: z.string().min(1, "filename is required"),
          contentType: z.enum(ALLOWED_IMAGE_MIME_TYPES, {
            errorMap: () => ({
              message: `contentType must be one of: ${ALLOWED_IMAGE_MIME_TYPES.join(", ")}`,
            }),
          }),
        }),
      )
      .min(1, "At least one file is required")
      .max(50, "At most 50 files may be presigned at once"),
  }),
});

export type PresignQuoteImagesBody = z.infer<typeof presignQuoteImagesValidator>["body"];

// GET /free — only socialStatus is validated here; every other existing param
// keeps flowing through untouched.
export const freeQuotesQueryValidator = z.object({
  query: z
    .object({
      socialStatus: z.enum(SOCIAL_STATUSES).optional(),
    })
    .passthrough(),
});

// GET /engagement/recent — all params optional; limit stays lenient (the
// controller clamps/defaults it exactly as before).
export const recentEngagementQueryValidator = z.object({
  query: z
    .object({
      mine: z.enum(["true", "false"]).optional(),
      period: z.enum(ENGAGEMENT_PERIODS).optional(),
    })
    .passthrough(),
});

// GET /free/status-counts
export const freeQuoteStatusCountsValidator = z.object({
  query: z
    .object({
      search: z.string().optional(),
      tags: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .passthrough(),
});

// PATCH /:id/accepted — manual "customer accepted" mark (true) or undo (false).
export const setAcceptedValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid quote id") }),
  body: z
    .object({ accepted: z.boolean({ required_error: "accepted is required", invalid_type_error: "accepted must be a boolean" }) })
    .strict(),
});
