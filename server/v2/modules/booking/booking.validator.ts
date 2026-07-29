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
