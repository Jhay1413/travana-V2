/**
 * Validation rules for the onboarding flow, written once and shared by the forms,
 * the spreadsheet review screens and the signup page.
 */
import { z } from "zod";
import { HOMEWORKER_LABEL, HOMEWORKER_SHOP, isHomeworkerText, parseRole } from "./roles";
import type { RoleValue } from "../types";

export const MAX_AGENTS = 50;
export const BUSINESS_TYPES = ["single", "multi"] as const;

const text = (requiredMessage: string, min = 1) =>
  z.string().trim().min(min, requiredMessage).max(120, "That's too long. Keep it under 120 characters.");

export const emailField = (requiredMessage = "Email address is required.") =>
  z.string().trim().min(1, requiredMessage).email("Enter a valid email address.");

export const phoneField = z.string().trim().superRefine((value, ctx) => {
  if (value === "") {
    ctx.addIssue({ code: "custom", message: "Phone number is required." });
    return;
  }
  if (!/^\+?[\d\s()-]+$/.test(value)) {
    ctx.addIssue({ code: "custom", message: "Use digits, spaces, + ( ) and - only." });
    return;
  }
  const digits = value.replace(/\D/g, "").length;
  if (digits < 10) ctx.addIssue({ code: "custom", message: "Phone number looks incomplete." });
  else if (digits > 15) ctx.addIssue({ code: "custom", message: "Phone number looks too long." });
});

export function isOptionalHttpUrl(value: string): boolean {
  if (value === "") return true;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/* ------------------------------- signup ---------------------------------- */

export const signupSchema = z.object({
  businessName: text("Enter your business name.", 2),
  firstName: text("Enter your first name."),
  lastName: text("Enter your last name."),
  email: emailField("Enter your email address."),
  password: z.string().min(8, "Use at least 8 characters."),
});

/* --------------------------- business details ----------------------------- */

export const businessSchema = z
  .object({
    businessType: z.enum(BUSINESS_TYPES),
    businessName: text("Enter your business name.", 2),
    phone: phoneField,
    address: text("Enter your business address.", 5),
    website: z
      .string()
      .trim()
      .refine(isOptionalHttpUrl, "Enter the full web address, like https://sunrisetravel.example."),
    email: emailField("Enter your main email address."),
    hasBranchManager: z.boolean(),
    agentCount: z.string(),
  })
  .superRefine((value, ctx) => {
    // The agent count only matters for a single shop; multi-shop businesses add people per shop.
    if (value.businessType !== "single") return;
    const n = Number(value.agentCount);
    if (!Number.isInteger(n) || n < 1 || n > MAX_AGENTS) {
      ctx.addIssue({ code: "custom", path: ["agentCount"], message: `Choose a number from 1 to ${MAX_AGENTS}.` });
    }
  });

/** What the form holds while it is being filled in. */
export type BusinessDraft = z.input<typeof businessSchema>;

/* -------------------------------- shops ----------------------------------- */

export const shopSchema = z.object({
  name: text("Enter the shop name.", 2).refine(
    (v) => v.toLowerCase() !== HOMEWORKER_LABEL.toLowerCase(),
    '"Homeworker" is reserved. Choose another shop name.',
  ),
  phone: phoneField,
  address: text("Enter the shop address.", 5),
  email: emailField("Shop email is required."),
  /** Optional: blank means no manager invite is sent for this shop. */
  managerEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address."),
});
export type Shop = z.output<typeof shopSchema>;

/* -------------------------------- people ---------------------------------- */

const SINGLE_HOMEWORKER_HINT = "Homeworkers can only be added in a multi-shop business. Use Agent.";
const TEAM_HOMEWORKER_HINT = "Homeworker is a shop choice, not a role. Pick Homeworker in the Shop column.";

function makeRoleField(homeworkerHint: string) {
  return z
    .string()
    .superRefine((v, ctx) => {
      if (parseRole(v) !== null) return;
      ctx.addIssue({
        code: "custom",
        message: isHomeworkerText(v) ? homeworkerHint : "Role not recognised. Use Agent or Branch Manager.",
      });
    })
    .transform((v): RoleValue => parseRole(v) ?? "agent");
}

export const agentSchema = z.object({
  firstName: text("First name is required."),
  lastName: text("Last name is required."),
  email: emailField(),
  role: makeRoleField(SINGLE_HOMEWORKER_HINT),
  /** Only ever set by an upload that names Homeworker as the shop; single shops have no homeworkers. */
  shop: z
    .string()
    .optional()
    .refine((v) => v !== HOMEWORKER_SHOP, SINGLE_HOMEWORKER_HINT),
});
export type Agent = z.output<typeof agentSchema>;

export interface ShopChoice {
  id: string;
  name: string;
}

/** Team members belong to one of the created shops, or are homeworkers. */
export function makeTeamMemberSchema(shops: ShopChoice[]) {
  return agentSchema.extend({
    role: makeRoleField(TEAM_HOMEWORKER_HINT),
    shop: z
      .string()
      .trim()
      .min(1, "Choose a shop, or Homeworker.")
      .refine(
        (v) => v === HOMEWORKER_SHOP || shops.some((s) => s.id === v),
        "Shop not found. Pick one of your shops, or Homeworker.",
      ),
  });
}
export type TeamMember = z.output<ReturnType<typeof makeTeamMemberSchema>>;

/** Homeworker commission is optional, but must be a whole percentage from 0 to 100. */
export const commissionSchema = z
  .string()
  .trim()
  .refine((v) => v === "" || (/^\d{1,3}$/.test(v) && Number(v) <= 100), "Enter a whole percentage from 0 to 100.");

/** The percentage to save: null when the field is blank. */
export function commissionValue(raw: string): number | null {
  const v = raw.trim();
  return v === "" ? null : Number(v);
}

/** Whether the typed commission needs saving: any difference from the saved value, including clearing it. */
export function commissionChange(typed: string, saved: number | null): { save: boolean; value: number | null } {
  const value = commissionValue(typed);
  return { save: value !== saved, value };
}
