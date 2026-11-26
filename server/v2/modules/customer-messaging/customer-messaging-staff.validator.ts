import { z } from "zod";
import { AUTO_CHANNELS } from "./customer-messaging.types";
import { STAFF_PURPOSES } from "./customer-messaging-staff.types";

const clientId = z.string().uuid("Invalid client id");
const purpose = z.enum(STAFF_PURPOSES, { errorMap: () => ({ message: `purpose must be one of: ${STAFF_PURPOSES.join(", ")}` }) });

/** The page size the history accepts. */
export const MAX_LOG_LIMIT = 50;
export const DEFAULT_LOG_LIMIT = 20;

// GET /availability?clientId=&purpose=
export const availabilityValidator = z.object({
  query: z.object({ clientId, purpose }),
});

// POST /send
export const staffSendValidator = z.object({
  body: z
    .object({
      clientId,
      purpose,
      channel: z.enum(AUTO_CHANNELS, { errorMap: () => ({ message: "channel must be whatsapp or sms" }) }),
      quoteId: z.string().uuid("Invalid quote id").optional(),
    })
    .strict()
    .refine((b) => b.purpose !== "quote_link" || b.quoteId !== undefined, { message: "quoteId is required to send a quote link", path: ["quoteId"] }),
});

// GET /log?clientId=&limit=&cursor=
export const logValidator = z.object({
  query: z.object({
    clientId,
    limit: z.coerce.number().int().min(1).max(MAX_LOG_LIMIT).optional(),
    cursor: z.string().regex(/^\d{1,6}$/, "Invalid cursor").optional(),
  }),
});
