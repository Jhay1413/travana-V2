/** Endpoint paths for the new portal screens. Existing portal calls stay in hooks/use-portal-api.ts. */
export const PORTAL_ENDPOINTS = {
  /** The signed-in customer's own agency branding. */
  brandingMe: "/api/v2/portal/branding",
  /** Public branding for the login screen, by agency slug. */
  brandingBySlug: (slug: string) => `/api/v2/portal/branding/${encodeURIComponent(slug)}`,
  pinReset: "/api/v2/portal/pin-reset",
  webauthnCredentials: "/api/v2/portal/webauthn/credentials",
  webauthnCredential: (id: string) => `/api/v2/portal/webauthn/credentials/${encodeURIComponent(id)}`,
  /** Everything Home needs above the fold, in one call. */
  summary: "/api/v2/portal/summary",
  /** "I'm interested" on a deal: tells the agent once per customer and deal (answers `alreadyTold` on a repeat). */
  dealInterest: "/api/v2/portal/interest",
  quotes: "/api/v2/portal/quotes",
  quote: (token: string) => `/api/v2/portal/quotes/${encodeURIComponent(token)}`,
  quoteAction: (token: string) => `/api/v2/portal/quotes/${encodeURIComponent(token)}/action`,
  quoteView: (token: string) => `/api/v2/portal/quote/${encodeURIComponent(token)}/view`,
  /** The public share page records a share here (the same call the public quote page makes). */
  bookings: "/api/v2/portal/bookings",
  booking: (id: string) => `/api/v2/portal/bookings/${encodeURIComponent(id)}`,
  quoteShare: (token: string) => `/api/public/quote/${encodeURIComponent(token)}/share`,
  pushVapidKey: "/api/portal/push/vapid-key",
  pushSubscribe: "/api/portal/push/subscribe",
  pushUnsubscribe: "/api/portal/push/unsubscribe",
} as const;
