import { z } from "zod";

export const customerActionSchema = z.object({
  params: z.object({ token: z.string() }),
  body: z.object({
    actionType: z.enum(["accepted", "changes_requested"]),
    message: z.string().max(2000).nullable().optional(),
    customerName: z.string().max(200).nullable().optional(),
  }),
});
