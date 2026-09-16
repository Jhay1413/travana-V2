import type { NeonClient } from "@/features/client/types/neon-client";

/** "96 Scholars View, Easington Lane, DH5 0PF, United Kingdom" from the client's address parts. */
export function composeAddress(clientData: NeonClient | undefined): string | null {
  if (!clientData) return null;
  const line1 = [clientData.houseNumber, clientData.street].filter(Boolean).join(" ");
  const line2 = [clientData.city, clientData.post_code].filter(Boolean).join(", ");
  const parts = [line1, line2, clientData.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}
