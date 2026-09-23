/**
 * Builds the href for a deal (quote/booking/enquiry) or client task/row.
 *
 * Client-linked deals open in the client dashboard's new detail view (via the
 * `?holiday=` deep link, parsed in client/src/pages/client/index.tsx); only
 * client-less deals fall back to the standalone pages.
 *
 * Note: pipeline-live-panel.tsx's `dealHref` implements the same mapping for
 * `Transaction` objects (which carry the primary quote directly rather than
 * an entityType/entityId pair) — keep the two in sync if this logic changes.
 */
export function dealDeepLinkHref(
  entityType: string | null | undefined,
  entityId: string | null | undefined,
  clientId: string | null | undefined,
): string | null {
  if ((entityType === "quote" || entityType === "booking" || entityType === "enquiry") && entityId) {
    if (clientId) return `/clients/${clientId}?holiday=${entityType}:${entityId}`;
    const standalonePath = entityType === "enquiry" ? "enquiries" : `${entityType}s`;
    return `/${standalonePath}/${entityId}`;
  }
  if (entityType === "client" && clientId) return `/clients/${clientId}`;
  return null;
}

/**
 * Builds the href for a deal of a known type (quote/booking/enquiry) — a thin
 * wrapper around `dealDeepLinkHref` for call sites that already know their
 * entity type statically and don't need the `null`-returning task/client
 * handling above.
 */
export function dealTypeHref(
  entityType: "quote" | "booking" | "enquiry",
  entityId: string,
  clientId: string | null | undefined,
): string {
  return dealDeepLinkHref(entityType, entityId, clientId) as string;
}
