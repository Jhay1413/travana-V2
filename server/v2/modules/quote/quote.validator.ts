import { z } from "zod";
import { ALLOWED_IMAGE_MIME_TYPES } from "../../utils/image-storage";

export const addImagesValidator = z.object({
  body: z.object({
    images: z.array(z.string().url()).min(1, "At least one image URL is required"),
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
