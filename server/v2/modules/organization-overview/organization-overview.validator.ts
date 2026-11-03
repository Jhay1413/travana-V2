import { z } from "zod";

const branchIdQuery = z.string().uuid("Invalid branchId").optional();

// range/from/to are parsed leniently by the controller (unknown values fall back
// to defaults), so they are only accepted as strings here.
export const getStatsValidator = z.object({
  query: z.object({ branchId: branchIdQuery }),
});

export const getPerformanceValidator = z.object({
  query: z.object({
    branchId: branchIdQuery,
    range: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
  }),
});

export type OverviewBranchQuery = z.infer<typeof getStatsValidator>["query"];
export type PerformanceQuery = z.infer<typeof getPerformanceValidator>["query"];

const COMPARE_AGAINST_BY_PERIOD = {
  week: ["prev", "year"],
  month: ["prev", "year"],
  year: ["prev", "year", "two_years"],
} as const;

export const getCompareValidator = z.object({
  query: z
    .object({
      period: z.enum(["week", "month", "year"]),
      against: z.enum(["prev", "year", "two_years"]),
      branchId: branchIdQuery,
    })
    .superRefine((q, ctx) => {
      const allowed: readonly string[] = COMPARE_AGAINST_BY_PERIOD[q.period];
      if (!allowed.includes(q.against)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["against"],
          message: `against "${q.against}" is not allowed for period "${q.period}"`,
        });
      }
    }),
});

export const getProfitSourcesValidator = getStatsValidator;

export type CompareQuery = z.infer<typeof getCompareValidator>["query"];
