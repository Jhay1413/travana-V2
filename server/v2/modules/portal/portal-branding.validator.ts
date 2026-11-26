import { z } from 'zod';
import { PORTAL_ORG_SLUG_MAX_LENGTH } from './portal-org-slug';

/**
 * Lenient on purpose: a malformed or unknown slug is answered with the neutral
 * default (200), exactly like an unknown agency, so the response never tells a
 * caller which slugs exist. Only an absurdly long value is rejected.
 */
export const portalBrandingBySlugValidator = z.object({
  params: z.object({
    slug: z.string().min(1).max(PORTAL_ORG_SLUG_MAX_LENGTH),
  }),
});

export type PortalBrandingBySlugParams = z.infer<typeof portalBrandingBySlugValidator>['params'];
