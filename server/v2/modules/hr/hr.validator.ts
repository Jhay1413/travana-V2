import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");
const optionalDate = dateString.nullable().optional();
const optionalString = z.string().trim().nullable().optional();

export const inviteEmployeeBodySchema = z.object({
  email: z.string().email("Valid email is required"),
  branchId: z.string().uuid("branchId must be a UUID"),
  orgRole: z.enum(["agent", "branch_manager", "homeworker", "referral_agent"]),
});

export const updateEmployeeBodySchema = z.object({
  status: z.enum(["Active", "Probation", "On Leave", "Terminated"]).optional(),
  employmentType: z.enum(["Full-time", "Part-time", "Contractor"]).optional(),
  startDate: optionalDate,
  probationEnd: optionalDate,
  managerUserId: z.string().nullable().optional(),
  salary: z
    .union([z.string().regex(/^\d+(\.\d{1,2})?$/, "Salary must be a decimal"), z.null()])
    .optional(),
  salaryCurrency: z
    .union([z.string().length(3, "Currency must be a 3-letter ISO code"), z.null()])
    .optional(),
  contractType: z.enum(["Permanent", "Fixed-term", "Casual"]).nullable().optional(),
  contractEndDate: optionalDate,
  holidayAllowance: z.number().int().min(0).max(365).nullable().optional(),
  taxId: optionalString,
});

export const requestLeaveBodySchema = z
  .object({
    type: z.enum(["Annual", "Sick", "Unpaid", "Other"]),
    from: dateString,
    to: dateString,
    reason: z.string().trim().max(2000).optional(),
  })
  .refine((data) => data.from <= data.to, {
    message: "'to' must be on or after 'from'",
    path: ["to"],
  });

export const addNoteBodySchema = z.object({
  body: z.string().trim().min(1, "Note body is required").max(5000),
});

export const addDocumentBodySchema = z.object({
  name: z.string().trim().min(1, "Document name is required").max(255),
  url: z.string().url().optional(),
  category: z.enum(["Contract", "NDA", "Right to Work", "Policies", "Training", "Other"]).optional(),
  status: z.enum(["Uploaded", "Missing", "Expiring Soon"]).optional(),
  expiresAt: optionalDate,
});
