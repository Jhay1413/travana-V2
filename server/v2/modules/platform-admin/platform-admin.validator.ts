import { z } from 'zod';

export const orgIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const suspendOrgSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body:   z.object({ reason: z.string().min(3).max(500) }),
});

export const activateOrgSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body:   z.object({}).optional(),
});

export const changePlanSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body:   z.object({
    plan:      z.enum(['starter', 'growth', 'pro', 'enterprise']),
    seatLimit: z.number().int().positive().optional(),
  }),
});

export const auditLogQuerySchema = z.object({
  query: z.object({
    actorId: z.string().optional(),
    orgId:   z.string().uuid().optional(),
    action:  z.string().max(64).optional(),
    limit:   z.coerce.number().int().min(1).max(200).default(50),
    offset:  z.coerce.number().int().min(0).default(0),
  }),
});

export const listUsersQuerySchema = z.object({
  query: z.object({
    orgId:  z.string().uuid().optional(),
    search: z.string().max(100).optional(),
    limit:  z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string() }),
});

export const orgUserParamsSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
  }),
});

export const changeUserRoleSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
  }),
  body: z.object({
    orgRole: z.enum(['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent']),
  }),
});

export const deactivateUserSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
  }),
  body: z.object({ reason: z.string().max(500).optional() }).optional(),
});

export const updateCreditLimitSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    limit:   z.number().int().min(0),
    enabled: z.boolean().optional(),
  }),
});

export const updateOveragePriceSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ priceCents: z.number().int().min(0) }),
});

export const topUpCreditsSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({
    credits: z.number().int().positive(),
    reason:  z.string().max(500).optional(),
  }),
});

export const usageHistoryQuerySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    months: z.coerce.number().int().min(1).max(36).default(12),
  }),
});

export const listChargesQuerySchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  query: z.object({
    status: z.enum(['pending', 'invoiced', 'paid', 'written_off']).optional(),
    limit:  z.coerce.number().int().min(1).max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  }),
});

export const writeOffChargeSchema = z.object({
  params: z.object({
    id:       z.string().uuid(),
    chargeId: z.string().uuid(),
  }),
  body: z.object({ reason: z.string().max(500).optional() }).optional(),
});
