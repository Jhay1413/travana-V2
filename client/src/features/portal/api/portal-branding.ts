import { normalizeOrgSlug } from "@/lib/portal-org-slug";

/** What the server tells the portal about an agency (see server portal-branding.types.ts). */
export interface PortalBranding {
  name: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  brandColor: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  atol?: string;
  abta?: string;
  /** Signed-in variant only. */
  agentName?: string;
  /** Signed-in variant only: the agency's portal slug, so the device cache can be matched to the agency. */
  slug?: string;
}

/** What the portal shows when it knows nothing about the agency. */
export const NEUTRAL_BRANDING: PortalBranding = {
  name: null,
  logoUrl: null,
  iconUrl: null,
  brandColor: null,
  phone: null,
  email: null,
  address: null,
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Defensive parse of a server response or a cached value: only known keys, only strings. */
export function parseBranding(raw: unknown): PortalBranding {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ...NEUTRAL_BRANDING };
  const r = raw as Record<string, unknown>;
  const out: PortalBranding = {
    name: str(r.name),
    logoUrl: str(r.logoUrl),
    iconUrl: str(r.iconUrl),
    brandColor: str(r.brandColor),
    phone: str(r.phone),
    email: str(r.email),
    address: str(r.address),
  };
  const atol = str(r.atol);
  if (atol) out.atol = atol;
  const abta = str(r.abta);
  if (abta) out.abta = abta;
  const agentName = str(r.agentName);
  if (agentName) out.agentName = agentName;
  const slug = str(r.slug);
  if (slug) out.slug = slug;
  return out;
}

/** True when the response carries nothing the portal could display. */
export function isNeutralBranding(b: PortalBranding): boolean {
  return !b.name && !b.logoUrl && !b.brandColor;
}

// ── Per-device cache, so the next login screen is themed before the network answers ──

export const PORTAL_BRANDING_CACHE_KEY = "portal_branding";

/** The slice of Storage the cache needs (lets tests pass a plain object). */
export interface BrandingStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface CachedBranding {
  slug: string | null;
  branding: PortalBranding;
}

/**
 * Writes the branding without the agent's name: it is personal to one customer and the device may be shared.
 * The cache is filed under the visit's slug, or (signed in) the slug the server reported for the agency.
 */
export function writeBrandingCache(storage: BrandingStorage, slug: string | null, branding: PortalBranding): void {
  if (isNeutralBranding(branding)) return;
  const { agentName: _agentName, slug: brandingSlug, ...shared } = branding;
  const value: CachedBranding = { slug: slug ?? brandingSlug ?? null, branding: shared };
  try {
    storage.setItem(PORTAL_BRANDING_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage full or blocked: theming just starts neutral next time.
  }
}

/**
 * The cached branding for this slug (or the last one saved when the visit names none), else null.
 * A cache saved for a different or unknown agency is never shown for a visit that names one.
 */
export function readBrandingCache(storage: BrandingStorage, slug: string | null): PortalBranding | null {
  try {
    const raw = storage.getItem(PORTAL_BRANDING_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedBranding> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const branding = parseBranding(parsed.branding);
    if (isNeutralBranding(branding)) return null;
    const cachedSlug = typeof parsed.slug === "string" ? parsed.slug : null;
    // A visit that names an agency only ever sees a cache saved for that same agency (never an unlabelled one).
    if (slug && cachedSlug !== slug) return null;
    return branding;
  } catch {
    return null;
  }
}

/** The agency slug for this visit: a valid `?org=` wins over the remembered one; junk is ignored. */
export function resolvePortalSlug(search: string, remembered: string | null): string | null {
  const fromUrl = normalizeOrgSlug(new URLSearchParams(search).get("org"));
  return fromUrl ?? normalizeOrgSlug(remembered);
}

/** Name shown in the chrome: the agency's own, else a neutral label (never a fixed company name). */
export function displayName(b: PortalBranding): string {
  return b.name ?? "Your travel agent";
}
