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

// ─── Year view and redesign writes ───────────────────────────────────────

const MAX_MONTH_AMOUNT = 50_000_000;

const year = z.number({ invalid_type_error: "year must be a number" }).int().min(2000, "Invalid year").max(2100, "Invalid year");

const months = z
  .array(
    z.number({ invalid_type_error: "months must be numbers" }).int("Targets must be whole pounds").min(0, "Targets cannot be negative").max(MAX_MONTH_AMOUNT, "Target is too large"),
    { required_error: "months is required", invalid_type_error: "months must be an array" },
  )
  .length(12, "months must have 12 entries (January to December)");

export const yearQueryValidator = z.object({
  query: z.object({
    year: z.coerce.number({ invalid_type_error: "year must be a number" }).int().min(2000, "Invalid year").max(2100, "Invalid year"),
  }),
});

export const monthsBodyValidator = z.object({
  body: z.object({ year, months }),
});

export const overrideBodyValidator = z.object({
  params: z.object({ userId: z.string().min(1, "User ID is required") }),
  body: z.object({ year, months, note: z.string().max(500).nullable().optional() }),
});

export const revertOverrideValidator = z.object({
  params: z.object({ userId: z.string().min(1, "User ID is required") }),
  query: yearQueryValidator.shape.query,
});

export const allocationValidator = z.object({
  body: z
    .object({
      year,
      business: z.object({ months }).optional(),
      shops: z.array(z.object({ branchId: z.string().uuid("Invalid branchId"), months })).optional(),
      agents: z
        .array(z.object({ branchId: z.string().uuid("Invalid branchId"), userId: z.string().min(1), months }))
        .optional(),
    })
    .refine((b) => b.business || (b.shops && b.shops.length > 0) || (b.agents && b.agents.length > 0), {
      message: "Nothing to save",
    }),
});
