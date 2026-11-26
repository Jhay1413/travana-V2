import { portalBrandingRepository } from './portal-branding.repository';
import { normalizeOrgSlug } from './portal-org-slug';
import type { PortalActiveAgentRow, PortalBranding, PortalBrandingOrgRow } from './portal-branding.types';

/** What an unknown, inactive or malformed agency gets: the same shape, nothing in it. */
export function neutralBranding(): PortalBranding {
  return { name: null, logoUrl: null, iconUrl: null, brandColor: null, phone: null, email: null, address: null };
}

const HEX_COLOUR = /^#[0-9a-fA-F]{6}$/;

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

/** Only absolute http(s) URLs or site-relative paths: never javascript: or data: URLs. */
function safeUrl(value: unknown): string | null {
  const url = text(value, 2000);
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || (url.startsWith('/') && !url.startsWith('//'))) return url;
  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Builds the response field by field (allowlist). Never spreads the organisation row or its settings. */
export function toPortalBranding(org: PortalBrandingOrgRow, agent?: PortalActiveAgentRow): PortalBranding {
  const settings = asRecord(org.settings);
  const profile = asRecord(settings.profile);
  const branding = asRecord(settings.branding);

  const address = ['addressLine1', 'addressLine2', 'town', 'county', 'postcode']
    .map((key) => text(profile[key], 200))
    .filter((part): part is string => part !== null)
    .join(', ');

  const result: PortalBranding = {
    name: text(org.name, 200),
    logoUrl: safeUrl(org.logoUrl),
    iconUrl: safeUrl(branding.iconUrl),
    brandColor: org.brandColor && HEX_COLOUR.test(org.brandColor.trim()) ? org.brandColor.trim().toLowerCase() : null,
    phone: text(profile.phone, 40),
    email: text(profile.email, 200),
    address: address || null,
  };

  const atol = text(profile.atol, 40);
  if (atol) result.atol = atol;
  const abta = text(profile.abta, 40);
  if (abta) result.abta = abta;

  const agentName = agent?.firstName?.trim();
  if (agentName) result.agentName = agentName.slice(0, 100);

  return result;
}

export const portalBrandingService = {
  /** Public, for the login screen. Unknown, inactive or malformed slug → neutral default, never an error. */
  async getForSlug(rawSlug: string): Promise<PortalBranding> {
    const slug = normalizeOrgSlug(rawSlug);
    if (!slug) return neutralBranding();
    const org = await portalBrandingRepository.findActiveBySlug(slug);
    return org ? toPortalBranding(org) : neutralBranding();
  },

  /** Signed-in customer's own agency, with the name of their active agent. */
  async getForClient(clientId: string): Promise<PortalBranding> {
    const found = await portalBrandingRepository.findForClient(clientId);
    if (!found) return neutralBranding();
    const agent = await portalBrandingRepository.findActiveAgentForClient(clientId, found.orgId);
    return { ...toPortalBranding(found.org, agent), slug: found.slug };
  },
};
