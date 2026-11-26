/**
 * What the customer portal may know about an agency. This is an allowlist: the
 * service builds it field by field, so nothing else on the organisation row
 * (plan, seats, billing, other settings) can ever reach a customer's browser.
 */
export interface PortalBranding {
  name: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  /** `#rrggbb`, or null when the agency has none (the portal then uses its neutral navy). */
  brandColor: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  /** Present only when the agency has entered the number. */
  atol?: string;
  abta?: string;
  /** Signed-in variant only: the first name of the customer's active agent. */
  agentName?: string;
  /** Signed-in variant only: the agency's own portal slug (public in its URLs), so the device cache can be matched to it. */
  slug?: string;
}

/** The organisation columns the branding read needs, as stored. */
export interface PortalBrandingOrgRow {
  name: string;
  logoUrl: string | null;
  brandColor: string | null;
  settings: unknown;
}

/** The customer's most recently active, non-test deal owner. */
export interface PortalActiveAgentRow {
  firstName: string | null;
  lastName: string | null;
}
