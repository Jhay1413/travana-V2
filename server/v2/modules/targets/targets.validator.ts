import { z } from "zod";

const branchId = z.string().min(1, "Invalid branchId").optional();

const shopTargetItem = z.object({
  year: z.number({ invalid_type_error: "year must be a number" }),
  month: z.number({ invalid_type_error: "month must be a number" }),
  targetAmount: z.string({ invalid_type_error: "targetAmount must be a string" }),
});

const agentTargetItem = shopTargetItem.extend({
  userId: z.string().min(1, "User ID is required for agent targets."),
});

const targetsList = <T extends z.ZodTypeAny>(item: T) =>
  z
    .array(item, { required_error: "targets is required", invalid_type_error: "targets must be an array" })
    .min(1, "Targets array cannot be empty");

export const branchQueryValidator = z.object({
  query: z.object({ branchId }),
});

export const upsertShopTargetsValidator = z.object({
  query: z.object({ branchId }),
  body: z.object({ targets: targetsList(shopTargetItem), branchId }),
});

export const upsertAgentTargetsValidator = z.object({
  query: z.object({ branchId }),
  body: z.object({ targets: targetsList(agentTargetItem), branchId }),
});
