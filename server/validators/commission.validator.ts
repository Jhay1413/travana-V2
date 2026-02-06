import { z } from "zod";
import { insertCommissionSchema } from "@shared/schema";

export const createCommissionValidator = z.object({
  body: insertCommissionSchema,
});

export const updateCommissionValidator = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: insertCommissionSchema.partial(),
});
