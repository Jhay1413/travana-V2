import { z } from "zod";
import { insertOrgKnowledgeBaseSchema } from "@shared/schema";

export const createKnowledgeValidator = z.object({
  body: insertOrgKnowledgeBaseSchema.extend({
    audience: z.enum(["general", "sales", "admin"]).optional(),
  }),
});

export const updateKnowledgeValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: insertOrgKnowledgeBaseSchema.partial().extend({
    audience: z.enum(["general", "sales", "admin"]).optional(),
  }),
});

export const idParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});
