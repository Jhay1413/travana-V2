import { z } from 'zod';

export const sendInviteSchema = z.object({
  body: z.object({
    email:    z.string().email(),
    branchId: z.string().uuid(),
    orgRole:  z.enum(['branch_manager', 'agent', 'homeworker', 'referral_agent']),
  }),
});
