import { z } from "zod";
import { insertOrgKnowledgeBaseSchema } from "@shared/schema";

export const createKnowledgeValidator = z.object({
  body: insertOrgKnowledgeBaseSchema,
});

export const updateKnowledgeValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: insertOrgKnowledgeBaseSchema.partial(),
});

export const idParamValidator = z.object({
  params: z.object({ id: z.string().uuid() }),
});
