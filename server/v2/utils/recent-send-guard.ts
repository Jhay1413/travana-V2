import { AppError } from "./error-handler";

// Short-lived in-memory duplicate-send guard. `assert` throws 429 when the key was
// recorded within the window; `record` arms it, so call it only after a real send
// succeeded (never for fallbacks or failures). Per process, which is enough for
// the double-click / retry case it exists for.
export interface RecentSendGuard {
  assert(key: string, message: string): void;
  record(key: string): void;
}

export function createRecentSendGuard(windowMs: number): RecentSendGuard {
  const recent = new Map<string, number>();

  function prune(now: number): void {
    recent.forEach((ts, k) => {
      if (now - ts > windowMs) recent.delete(k);
    });
  }

  return {
    assert(key, message) {
      const now = Date.now();
      prune(now);
      const last = recent.get(key);
      if (last !== undefined && now - last < windowMs) throw new AppError(message, 429);
    },
    record(key) {
      recent.set(key, Date.now());
    },
  };
}
