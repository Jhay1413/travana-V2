/** How long a deal must wait between two "Push to portal" sends: customers are not buzzed about the same deal again and again. */
export const PORTAL_PUSH_COOLDOWN_MS = 6 * 60 * 60 * 1000;

/**
 * Per-quote cooldown for "Push to portal". `remainingMs` is 0 when the deal may be sent now; `record` starts the wait;
 * `release` takes it back (a send that failed must not lock the deal). In memory, per process: enough to stop repeated
 * clicks, and behind this interface so a shared store can replace it without touching the service.
 */
export interface PortalPushCooldown {
  remainingMs(quoteId: string): number;
  record(quoteId: string): void;
  release(quoteId: string): void;
  /** Forgets every quote (tests). */
  reset(): void;
}

export function createPortalPushCooldown(windowMs: number = PORTAL_PUSH_COOLDOWN_MS, now: () => number = Date.now): PortalPushCooldown {
  const sentAt = new Map<string, number>();
  return {
    remainingMs(quoteId) {
      const at = sentAt.get(quoteId);
      if (at === undefined) return 0;
      const left = at + windowMs - now();
      if (left <= 0) {
        sentAt.delete(quoteId);
        return 0;
      }
      return left;
    },
    record(quoteId) {
      sentAt.set(quoteId, now());
    },
    release(quoteId) {
      sentAt.delete(quoteId);
    },
    reset() {
      sentAt.clear();
    },
  };
}

/** "2 hours 5 minutes", "45 minutes": how long until the deal can be sent again, rounded up to the minute. */
export function describeWait(ms: number): string {
  const totalMinutes = Math.max(1, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const h = hours > 0 ? `${hours} hour${hours === 1 ? "" : "s"}` : "";
  const m = minutes > 0 ? `${minutes} minute${minutes === 1 ? "" : "s"}` : "";
  return [h, m].filter(Boolean).join(" ");
}

/** The one cooldown the "Push to portal" endpoint uses. */
export const portalPushCooldown: PortalPushCooldown = createPortalPushCooldown();
