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
