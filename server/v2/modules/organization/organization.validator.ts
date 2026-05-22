import { z } from 'zod';

const billingContactSchema = z.object({
  contactEmail: z.string().email().optional().or(z.literal('')),
  companyName:  z.string().max(200).optional().or(z.literal('')),
  addressLine1: z.string().max(200).optional().or(z.literal('')),
  addressLine2: z.string().max(200).optional().or(z.literal('')),
  city:         z.string().max(100).optional().or(z.literal('')),
  postalCode:   z.string().max(20).optional().or(z.literal('')),
  country:      z.string().max(100).optional().or(z.literal('')),
  vatNumber:    z.string().max(40).optional().or(z.literal('')),
}).partial();

const orgSettingsSchema = z.object({
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
    isActive:   z.boolean().optional(),
    seatLimit:  z.number().int().positive().optional(),
    plan:       z.enum(['starter', 'growth', 'enterprise']).optional(),
  }),
});
