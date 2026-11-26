import { useMutation } from "@tanstack/react-query";
import { PORTAL_ENDPOINTS } from "./portal-endpoints";

/** The one confirmation the login screen shows, whatever the server did (it never says whether the email exists). */
export const PIN_RESET_CONFIRMATION = "If we have your details, we've sent you a sign-in link.";

/** "Forgotten your PIN?": asks the server to text a one-time sign-in link. */
export function usePortalPinReset() {
  return useMutation<void, Error, { email: string; org?: string }>({
    mutationFn: async ({ email, org }) => {
      const res = await fetch(PORTAL_ENDPOINTS.pinReset, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, ...(org ? { org } : {}) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong. Please try again.");
      }
    },
  });
}
