import { z } from "zod";

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

const userId = z.string().trim().min(1, "userId is required").max(128, "userId is too long");

export const userIdParams = z.object({ userId });

export const performanceQuery = z
  .object({ from: ymd, to: ymd })
  .superRefine((q, ctx) => {
    if (!isRealDate(q.from) || !isRealDate(q.to)) return;
    const span = (Date.parse(`${q.to}T00:00:00Z`) - Date.parse(`${q.from}T00:00:00Z`)) / DAY_MS;
    if (span <= 0) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "from must be before to" });
    else if (span > MAX_SPAN_DAYS) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `The window cannot exceed ${MAX_SPAN_DAYS} days` });
    }
  });

export const weekQuery = z.object({
  start: ymd.refine((v) => !isRealDate(v) || new Date(`${v}T00:00:00Z`).getUTCDay() === 1, "start must be a Monday"),
});

export const monthlyQuery = z.object({
  year: z
    .string()
    .regex(/^\d{4}$/, "year must be a four digit year")
    .refine((v) => Number(v) >= 2000 && Number(v) <= 2100, "year must be between 2000 and 2100")
    .optional(),
});

export const biggestDealsQuery = z.object({
  limit: z
    .string()
    .regex(/^\d{1,2}$/, "limit must be a whole number")
    .refine((v) => Number(v) >= 1 && Number(v) <= 20, "limit must be between 1 and 20")
    .optional(),
});

/** Route-level schemas for validate(): { body, query, params } is parsed together. */
export const userIdValidator = z.object({ params: userIdParams });
export const performanceValidator = z.object({ params: userIdParams, query: performanceQuery });
export const weekValidator = z.object({ params: userIdParams, query: weekQuery });
export const monthlyValidator = z.object({ params: userIdParams, query: monthlyQuery });
export const biggestDealsValidator = z.object({ params: userIdParams, query: biggestDealsQuery });

export type PerformanceQuery = z.infer<typeof performanceQuery>;
export type WeekQuery = z.infer<typeof weekQuery>;
export type MonthlyQuery = z.infer<typeof monthlyQuery>;
export type BiggestDealsQuery = z.infer<typeof biggestDealsQuery>;
