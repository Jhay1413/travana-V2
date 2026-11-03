/**
 * Shared validation rules for tour operators. Used by the server (validators,
 * import planner) and the client form so both show the same messages.
 *
 * Pure: no I/O, no framework imports besides zod.
 */
import { z } from "zod";

/** Default balance due, in weeks before departure. */
export const DEFAULT_BALANCE_WEEKS = 14;

export const OPERATOR_MESSAGES = {
  nameMin: "Enter the tour operator's name.",
  nameDuplicate: (name: string) => `${name} is already in the list.`,
  nameDuplicateInFile: (name: string) => `${name} appears more than once in the file.`,
  noName: "(no name)",
  phone: "Enter a phone number, e.g. 0203 451 2720.",
  web: "Enter a web address, e.g. trade.jet2holidays.com.",
  commissionRequired: "Enter the commission as a number, e.g. 10.",
  commissionNumber: "Enter the commission as a number, e.g. 10.",
  commissionMin: "Commission can't be below 0%.",
  commissionMax: "Commission can't be over 100%.",
  weeksRequired: "Enter the number of weeks, e.g. 14.",
  weeksNumber: "Enter the number of weeks, e.g. 14.",
  weeksWhole: "Use whole weeks, e.g. 14.",
  weeksMin: "Weeks can't be below 0.",
  weeksMax: "Use 52 weeks or fewer.",
  notInList: "Tour operator is not in your list",
} as const;

export const PHONE_RE = /^[+()\d][\d\s()+-]{6,}$/;

/** Adds https:// when someone types "trade.jet2holidays.com". */
export function normaliseWeb(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export interface ParsedNumber {
  value?: number;
  error?: string;
}

function toTrimmedString(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

/**
 * Parses a commission such as "10", "12.5" or "10%". A blank value returns
 * neither a value nor an error: the caller decides whether blank is allowed.
 */
export function parseCommission(raw: string | number | null | undefined): ParsedNumber {
  const text = toTrimmedString(raw).replace(/%/g, "").trim();
  if (!text) return {};
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: OPERATOR_MESSAGES.commissionNumber };
  if (n < 0) return { error: OPERATOR_MESSAGES.commissionMin };
  if (n > 100) return { error: OPERATOR_MESSAGES.commissionMax };
  return { value: Math.round(n * 100) / 100 };
}

/**
 * Parses balance weeks such as "14" or "14 weeks". A blank value returns
 * neither a value nor an error.
 */
export function parseBalanceWeeks(raw: string | number | null | undefined): ParsedNumber {
  const text = toTrimmedString(raw).replace(/weeks?/i, "").trim();
  if (!text) return {};
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: OPERATOR_MESSAGES.weeksNumber };
  if (!Number.isInteger(n)) return { error: OPERATOR_MESSAGES.weeksWhole };
  if (n < 0) return { error: OPERATOR_MESSAGES.weeksMin };
  if (n > 52) return { error: OPERATOR_MESSAGES.weeksMax };
  return { value: n };
}

const phoneField = z.union([z.literal(""), z.string().trim().regex(PHONE_RE, OPERATOR_MESSAGES.phone)]);

const webField = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .transform(normaliseWeb)
    .pipe(z.string().url(OPERATOR_MESSAGES.web)),
]);

const numericInput = z.union([z.string(), z.number()]);

/** The seven form fields. Output carries numbers for commission and weeks. */
export const operatorFieldsSchema = z.object({
  name: z.string().trim().min(2, OPERATOR_MESSAGES.nameMin),
  phone: phoneField,
  web: webField,
  username: z.string().trim(),
  password: z.string(),
  commission: numericInput.transform((v, ctx) => {
    const r = parseCommission(v);
    if (r.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error ?? OPERATOR_MESSAGES.commissionRequired });
      return z.NEVER;
    }
    return r.value;
  }),
  balanceWeeks: numericInput.transform((v, ctx) => {
    const r = parseBalanceWeeks(v);
    if (r.value === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: r.error ?? OPERATOR_MESSAGES.weeksRequired });
      return z.NEVER;
    }
    return r.value;
  }),
});

export type OperatorFields = z.infer<typeof operatorFieldsSchema>;
