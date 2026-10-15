import { z } from 'zod';
import { homeworkerRoleInviteBody } from '../homeworker/homeworker.validator';

// Homeworkers get their own branch on invite, so they carry no branchId.
const branchInviteBody = z.object({
  email:    z.string().email(),
  branchId: z.string().uuid(),
  orgRole:  z.enum(['branch_manager', 'agent', 'referral_agent', 'social_media_manager']),
});

export const sendInviteSchema = z.object({
  body: z.discriminatedUnion('orgRole', [homeworkerRoleInviteBody, branchInviteBody]),
});

export const acceptInviteQuerySchema = z.object({
  query: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
});

export const acceptInviteSubmitSchema = z.object({
  body: z.object({
    token:       z.string().min(1, 'Token is required'),
    firstName:   z.string().min(1, 'First name is required'),
    lastName:    z.string().min(1, 'Last name is required'),
    phoneNumber: z.string().min(1, 'Phone number is required'),
    password:    z.string().min(8, 'Password must be at least 8 characters'),
  }),
});
