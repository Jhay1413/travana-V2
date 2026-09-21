import { z } from "zod";

const DEAL_PRIORITIES = ["low", "medium", "high"] as const;

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD")
  .refine(
    (value) => {
      // The regex above accepts calendar-impossible dates (e.g. 2026-02-31),
      // which Date silently rolls forward (2026-03-03) instead of rejecting.
      // Round-trip through Date.UTC and compare the formatted result back
      // against the input to catch that.
      const [year, month, day] = value.split("-").map(Number);
      const ms = Date.UTC(year, month - 1, day);
      return new Date(ms).toISOString().slice(0, 10) === value;
    },
    { message: "Invalid calendar date" },
  );

export const updatePriorityValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    priority: z.enum(DEAL_PRIORITIES),
  }),
});

export const setFutureDealValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    future_deal_date: dateOnly.nullable().refine(
      (value) => {
        if (value === null) return true;
        // Compare as calendar dates in UTC (matching the client, which derives
        // its min date from toISOString()) so "today" is never "future" and
        // the server doesn't disagree with the browser's local timezone.
        const now = new Date();
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const [year, month, day] = value.split("-").map(Number);
        const candidateUtc = Date.UTC(year, month - 1, day);
        return candidateUtc > todayUtc;
      },
      { message: "future_deal_date must be a future date" },
    ),
  }),
});

export const setLostValidator = z.object({
  params: z.object({ id: z.string().uuid("Invalid transaction id") }),
  body: z.object({
    lost: z.boolean(),
  }),
});

// `sort` drives the Agent Dashboard's Pipeline Live "Latest"/"Oldest"/"Oldest
// Activity" views — other pre-existing query params (page, limit, agentId,
// quoteStatus) are still parsed manually in the controller and are left
// unvalidated here.
export const listPipelineByStatusValidator = z.object({
  params: z.object({ status: z.string() }),
  query: z.object({
    sort: z.enum(["newest", "oldest", "oldest-activity"]).optional(),
  }),
});

// The `validate()` middleware only checks req.query against this schema —
// it doesn't reassign req.query with the parsed result — so the controller
// still reads the raw query object; this type lets it do so against the
// validator's own inferred shape instead of re-deriving the enum by hand.
export type ListPipelineByStatusQuery = z.infer<typeof listPipelineByStatusValidator>["query"];
