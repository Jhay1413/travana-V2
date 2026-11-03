import { z } from "zod";

export const createUpscaleJobValidator = z.object({
  body: z
    .object({
      quoteId: z.string().uuid("quoteId must be a valid UUID").optional(),
      imageUrl: z.string().min(1).max(4000).optional(),
    })
    // quoteId is the SSRF guard for imageUrl (the url must belong to the quote);
    // an uploaded file never touches a quote, so it can be used standalone.
    .refine((body) => !body.imageUrl || !!body.quoteId, {
      message: "quoteId is required when using imageUrl",
      path: ["quoteId"],
    }),
});

export const listUpscaleJobsValidator = z.object({
  query: z.object({
    quoteId: z.string().uuid("quoteId must be a valid UUID"),
  }),
});

export const upscaleJobIdValidator = z.object({
  params: z.object({
    id: z.string().uuid("id must be a valid UUID"),
  }),
});
