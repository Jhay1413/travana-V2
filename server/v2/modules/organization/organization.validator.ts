import { z } from 'zod';
import { websiteSchema } from '../../utils/website-schema';

const billingContactSchema = z.object({
  contactEmail: z.string().email().optional().or(z.literal('')),
  companyName:  z.string().max(200).optional().or(z.literal('')),
  website:      websiteSchema.optional(),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  city:         z.string().max(100).optional().or(z.literal('')),
  postalCode:   z.string().max(20).optional().or(z.literal('')),
  country:      z.string().max(100).optional().or(z.literal('')),
  vatNumber:    z.string().max(40).optional().or(z.literal('')),
}).partial();

const profileSchema = z.object({
  phone:        z.string().max(40).optional().or(z.literal('')),
  email:        z.string().email().max(200).optional().or(z.literal('')),
  website:      websiteSchema.optional(),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  town:         z.string().max(100).optional().or(z.literal('')),
  county:       z.string().max(100).optional().or(z.literal('')),
  postcode:     z.string().max(20).optional().or(z.literal('')),
}).partial();

const brandingSchema = z.object({
  iconUrl: z.string().url().nullable().optional(),
}).partial();

const orgSettingsSchema = z.object({
  profile:    profileSchema.optional(),
  branding:   brandingSchema.optional(),
  timezone:   z.string().optional(),
  currency:   z.string().length(3).optional(),
  dateFormat: z.string().optional(),
  weekStart:  z.enum(['sunday', 'monday']).optional(),
  billing:    billingContactSchema.optional(),
}).passthrough();

export const createOrganizationSchema = z.object({
  body: z.object({
    name:        z.string().min(1),
    slug:        z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
    plan:        z.enum(['starter', 'growth', 'enterprise']).optional(),
    brandColor:  z.string().optional(),
    logoUrl:     z.string().url().optional(),
  }),
});

export const updateOrganizationSchema = z.object({
  body: z.object({
    name:       z.string().min(1).optional(),
    slug:       z.string().min(3).max(40).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase, numbers and hyphens').optional(),
    brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Brand color must be a 6-digit hex').optional(),
    logoUrl:    z.string().url().optional().nullable(),
    settings:   orgSettingsSchema.optional(),
    // seatLimit and isActive are not editable here: seats follow the plan, and
    // activation belongs to the platform admin. The controller only reads the keys above.
    // plan is not editable here: only platform admins change a plan (see the controller).
  }),
});

// ---------------------------------------------------------------------------
// Members (Teams & Roles). User ids are text, never uuids.
// ---------------------------------------------------------------------------

const userIdParam = z.string().min(1, 'User id is required');

const memberRoleEnum = z.enum(
  ['org_admin', 'branch_manager', 'agent', 'homeworker', 'referral_agent', 'social_media_manager'],
  { errorMap: () => ({ message: 'Invalid role' }) },
);

export const memberUserIdParams = z.object({
  params: z.object({ userId: userIdParam }),
});

export const updateMemberRoleSchema = z.object({
  params: z.object({ userId: userIdParam }),
  body: z.object({ orgRole: memberRoleEnum }),
});

export const setMemberSuspendedSchema = z.object({
  params: z.object({ userId: userIdParam }),
  body: z.object({
    suspended: z.boolean(),
    notify: z.boolean().optional(),
  }).strict(),
});

export const assignMemberBranchSchema = z.object({
  params: z.object({ userId: userIdParam }),
  body: z.object({
    branchId: z.string().uuid('Invalid branch id'),
    orgRole: memberRoleEnum.optional(),
  }),
});

export const unassignMemberBranchSchema = z.object({
  params: z.object({ userId: userIdParam, branchId: z.string().uuid('Invalid branch id') }),
});

const personName = z.string().trim().min(1, 'Name cannot be empty').max(60, 'Name is too long');

export const updateMemberProfileSchema = z.object({
  params: z.object({ userId: userIdParam }),
  body: z.object({
    firstName: personName.optional(),
    lastName: personName.optional(),
    phoneNumber: z.union([z.literal(''), z.string().regex(/^[+()\d\s-]{7,20}$/, 'Enter a valid phone number')]).optional(),
  }).refine(
    (b) => b.firstName !== undefined || b.lastName !== undefined || b.phoneNumber !== undefined,
    { message: 'Provide at least one field to update' },
  ),
});

export const removeMemberSchema = z.object({
  params: z.object({ userId: userIdParam }),
  body: z.object({
    newOwnerId: z.string().min(1).optional(),
    confirm: z.literal('REMOVE', { errorMap: () => ({ message: 'Type REMOVE to confirm' }) }),
  }),
});
