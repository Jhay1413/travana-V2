import { z } from 'zod';

const ASSIGNABLE_ROLE = z.enum([
  'org_admin',
  'branch_manager',
  'agent',
  'homeworker',
  'referral_agent',
]);

export const addUserRoleSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
  }),
  body: z.object({
    role: ASSIGNABLE_ROLE,
  }),
});

export const removeUserRoleSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
    role:   ASSIGNABLE_ROLE,
  }),
});

export const listUserRolesParamsSchema = z.object({
  params: z.object({
    id:     z.string().uuid(),
    userId: z.string().min(1),
  }),
});

// Self-service: no body, just verify the route shape.
export const noopSchema = z.object({});
