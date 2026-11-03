import { z } from "zod";

export function extractPlaceholders(text: string): number[] {
  return Array.from(text.matchAll(/\{\{(\d+)\}\}/g)).map((m) => Number(m[1]));
}

const button = z.object({
  type: z.enum(["URL", "QUICK_REPLY", "PHONE_NUMBER"]),
  text: z.string().min(1).max(25),
  url: z.string().url().optional(),
  phone_number: z.string().min(1).optional(),
});

export const createTemplateBodySchema = z
  .object({
    channel_id: z.string().uuid(),
    name: z.string().regex(/^[a-z0-9_]{1,512}$/, "Name must be lowercase letters, numbers and underscores only"),
    category: z.enum(["MARKETING", "UTILITY"]),
    language: z.string().min(2).max(10).default("en"),
    header_text: z.string().min(1).max(60).optional(),
    body_text: z.string().min(1).max(1024),
    body_examples: z.array(z.string().min(1).max(200)),
    footer_text: z.string().min(1).max(60).optional(),
    buttons: z.array(button).max(3).optional(),
  })
  .strict()
  .superRefine((val, ctx) => {
    const distinct = Array.from(new Set(extractPlaceholders(val.body_text))).sort((a, b) => a - b);
    const consecutive = distinct.every((n, i) => n === i + 1);
    if (!consecutive) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_text"],
        message: "Body placeholders must be numbered consecutively from {{1}} with no gaps",
      });
    } else if (val.body_examples.length !== distinct.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["body_examples"],
        message: `Provide exactly ${distinct.length} example value(s), one for each placeholder in the body`,
      });
    }
    (val.buttons ?? []).forEach((b, i) => {
      if (b.type === "URL" && !b.url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["buttons", i, "url"], message: "URL buttons need a url" });
      }
      if (b.type === "PHONE_NUMBER" && !b.phone_number) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["buttons", i, "phone_number"],
          message: "Phone number buttons need a phone_number",
        });
      }
    });
  });

export const createTemplateValidator = z.object({ body: createTemplateBodySchema });

export const syncTemplatesValidator = z.object({
  body: z.object({ channel_id: z.string().uuid("channel_id must be a valid id") }),
});
