import { z } from 'zod';

/** 0-100 with up to two decimals; accepts a number or a decimal string, never "". */
export const profitSharePercentSchema = z
  .union([z.number(), z.string()])
  .refine(
    (v) => /^\d{1,3}(\.\d{1,2})?$/.test(String(v)) && Number(v) <= 100,
    'Profit share must be between 0 and 100 with at most 2 decimals',
  );

/** Fields shared by every "invite a homeworker" entry point (invite, HR, /homeworkers). */
export const homeworkerInviteFields = {
  email:              z.string().email(),
  firstName:          z.string().trim().min(1).optional(),
  lastName:           z.string().trim().min(1).optional(),
  profitSharePercent: profitSharePercentSchema.optional(),
  displayName:        z.string().trim().min(1).max(120).optional(),
};

/** Homeworker arm of the invite discriminated unions: no branchId. */
export const homeworkerRoleInviteBody = z.object({
  orgRole: z.literal('homeworker'),
  ...homeworkerInviteFields,
});

export const createHomeworkerSchema = z.object({
  body: z.object(homeworkerInviteFields),
});

export const listHomeworkersSchema = z.object({
  query: z.object({
    includeArchived: z.enum(['true', 'false']).optional(),
  }),
});

export const homeworkerBranchParamsSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
});

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');

export const statementQuerySchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
  query: z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() }),
});

export const myStatementQuerySchema = z.object({
  query: z.object({ from: isoDateSchema.optional(), to: isoDateSchema.optional() }),
});

export const finaliseStatementSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
  body: z.object({ from: isoDateSchema, to: isoDateSchema }),
});

export const updateHomeworkerSchema = z.object({
  params: z.object({ branchId: z.string().uuid() }),
  body: z
    .object({
      profitSharePercent: profitSharePercentSchema.optional(),
      name:               z.string().trim().min(1).max(120).optional(),
    })
    .refine((b) => b.profitSharePercent !== undefined || b.name !== undefined, 'Nothing to update'),
});
