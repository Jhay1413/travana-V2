import { z } from "zod";
import { ukAddDays, ukDateString } from "../../utils/london-dates";

const DAY_MS = 86_400_000;
const MAX_SPAN_DAYS = 400;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

/** A real calendar date written YYYY-MM-DD (rejects 2026-02-30). */
function isRealDate(value: string): boolean {
  if (!YMD.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const ymd = z.string().refine(isRealDate, "Dates must be real YYYY-MM-DD dates");

export const CHECK_KEYS = [
  "checkIn",
  "ticketsInHouse",
  "passportInfo",
  "ticketsPickUp",
  "completed",
  "fullyPaid",
] as const;

/** A lone bound may not reach further than the 400 day window from London today. */
function addLoneBoundIssues(q: { from?: string; to?: string }, ctx: z.RefinementCtx, now: Date): void {
  if (q.from && !q.to && isRealDate(q.from) && q.from < ukDateString(ukAddDays(now, -MAX_SPAN_DAYS))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `from cannot be more than ${MAX_SPAN_DAYS} days in the past` });
  }
  if (q.to && !q.from && isRealDate(q.to) && q.to > ukDateString(ukAddDays(now, MAX_SPAN_DAYS))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `to cannot be more than ${MAX_SPAN_DAYS} days ahead` });
  }
}

export const listQuery = z
  .object({ from: ymd.optional(), to: ymd.optional() })
  .strict()
  .superRefine((q, ctx) => {
    addLoneBoundIssues(q, ctx, new Date());
    if (!q.from || !q.to) return;
    const span = (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / DAY_MS;
    if (span <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before to" });
    else if (span > MAX_SPAN_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `The window cannot exceed ${MAX_SPAN_DAYS} days` });
    }
  });

export const listValidator = z.object({ query: listQuery });

export const summaryValidator = z.object({
  query: z.object({
    days: z
      .string()
      .regex(/^\d{1,3}$/, "days must be a whole number")
      .refine((v) => Number(v) >= 1 && Number(v) <= MAX_SPAN_DAYS, `days must be between 1 and ${MAX_SPAN_DAYS}`)
      .optional(),
  }).strict(),
});

export const patchCheckValidator = z.object({
  params: z.object({ bookingId: z.string().uuid("bookingId must be a valid id") }),
  body: z.object({ key: z.enum(CHECK_KEYS), value: z.boolean() }).strict(),
});

export type ListQuery = z.infer<typeof listQuery>;
export type SummaryQuery = z.infer<typeof summaryValidator>["query"];
export type PatchCheckBody = z.infer<typeof patchCheckValidator>["body"];
