import { z } from "zod";
import { insertClientTableSchema } from "@shared/schema";
import { SYSTEM_MANAGED_CLIENT_FIELDS } from "../neon-client/neon-client.validator";

// System-managed columns (portal PIN, status, VIP, merge lineage) are not
// writable here; the service strips them from any payload that carries them.
const editableClientSchema = insertClientTableSchema.omit(SYSTEM_MANAGED_CLIENT_FIELDS);

export const createClientValidator = z.object({
  body: editableClientSchema,
});

export const updateClientValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: editableClientSchema.partial(),
});

export const mergeClientValidator = z.object({
  params: z.object({
    id: z.string().uuid(),
  }),
  body: z.object({
    targetId: z.string().uuid(),
  }),
});
