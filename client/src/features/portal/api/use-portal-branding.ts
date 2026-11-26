import { useQuery } from "@tanstack/react-query";
import { getPortalOrgSlug, getPortalToken, portalFetch } from "@/hooks/use-portal-api";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";
import {
  NEUTRAL_BRANDING,
  parseBranding,
  readBrandingCache,
  resolvePortalSlug,
  writeBrandingCache,
  type PortalBranding,
} from "./portal-branding";

export const portalBrandingKeys = {
  me: ["portal", "branding", "me"] as const,
  bySlug: (slug: string) => ["portal", "branding", "slug", slug] as const,
};

/**
 * The agency branding for whoever is looking at the portal: the signed-in customer's
 * own agency, or (on the login screen) the agency named by ?org= / remembered on this
 * device. Paints from the per-device cache first, then refreshes from the server.
 */
export function usePortalBranding(): { branding: PortalBranding; slug: string | null; signedIn: boolean } {
  const signedIn = !!getPortalToken();
  const slug = resolvePortalSlug(window.location.search, getPortalOrgSlug());
  // Signed in, only an agency named in the URL has to match; the "me" fetch replaces the placeholder at once.
  const urlSlug = resolvePortalSlug(window.location.search, null);
  const cached = readBrandingCache(window.localStorage, signedIn ? urlSlug : slug);

  const query = useQuery<PortalBranding>({
    queryKey: signedIn ? portalBrandingKeys.me : portalBrandingKeys.bySlug(slug ?? ""),
    queryFn: async () => {
      const raw = signedIn ? await portalFetch(PORTAL_ENDPOINTS.brandingMe) : await publicBranding(slug ?? "");
      const parsed = parseBranding(raw);
      writeBrandingCache(window.localStorage, signedIn ? null : slug, parsed);
      return parsed;
    },
    enabled: signedIn || !!slug,
    retry: false,
    staleTime: 5 * 60 * 1000,
    placeholderData: cached ?? undefined,
  });

  return { branding: query.data ?? cached ?? NEUTRAL_BRANDING, slug, signedIn };
}

async function publicBranding(slug: string): Promise<unknown> {
  const res = await fetch(PORTAL_ENDPOINTS.brandingBySlug(slug));
  if (!res.ok) return NEUTRAL_BRANDING;
  return res.json();
}
