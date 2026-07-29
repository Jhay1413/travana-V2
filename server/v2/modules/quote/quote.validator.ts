import { z } from "zod";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../utils/image-storage";

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
