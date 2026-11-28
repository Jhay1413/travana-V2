/**
 * The portal service worker served from the STAFF host once a portal host exists (PORTAL_BASE_URL). A phone that turned
 * notifications on at the old address still has the old worker and a push subscription there; this replacement, picked up by
 * the browser's own update check, removes both so the customer is not notified twice (once per address):
 *
 *   1. read this worker's push subscription,
 *   2. tell the server to forget it (POST /api/v2/portal/push/retire: needs the endpoint AND its two keys, no session),
 *   3. unsubscribe it in the browser,
 *   4. unregister itself.
 *
 * It has no push or fetch handler: it never shows anything and never touches a page.
 */
export const PORTAL_SW_RETIRE_SCRIPT = `// This address no longer serves the customer portal: remove the old notification set-up, then remove this worker.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription) {
          const json = subscription.toJSON();
          if (json.endpoint && json.keys && json.keys.p256dh && json.keys.auth) {
            await fetch("/api/v2/portal/push/retire", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ subscription: { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } }),
            }).catch(() => undefined);
          }
          await subscription.unsubscribe().catch(() => undefined);
        }
      } catch (err) {
        // Best effort: unregistering below still ends this worker.
      }
      await self.registration.unregister().catch(() => undefined);
    })(),
  );
});
`;
