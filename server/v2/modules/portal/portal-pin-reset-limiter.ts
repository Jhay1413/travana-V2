/**
 * Caps how many sign-in texts one email can trigger, because each text costs the
 * agency money. Behind an interface so a database-backed version can replace the
 * in-memory one later without touching the service.
 */
export interface PinResetLimiter {
  /** Records a text about to be sent for this key. False (and nothing recorded) when the allowance is used up. */
  tryConsume(key: string): boolean;
  /** Peeks without spending: would a text for this key be allowed right now? */
  isAllowed(key: string): boolean;
  /** Spends one allowance for this key (after the durable reservation succeeded). */
  record(key: string): void;
}

export const PIN_RESET_MAX_TEXTS = 3;
export const PIN_RESET_WINDOW_MS = 24 * 60 * 60 * 1000;

const MAX_KEYS = 10_000;

export class InMemoryPinResetLimiter implements PinResetLimiter {
  /** key -> timestamps (ascending) of texts inside the rolling window. */
  private readonly sent = new Map<string, number[]>();

  constructor(
    private readonly max: number = PIN_RESET_MAX_TEXTS,
    private readonly windowMs: number = PIN_RESET_WINDOW_MS,
    private readonly now: () => number = () => Date.now(),
  ) {}

  isAllowed(key: string): boolean {
    const now = this.now();
    const stamps = (this.sent.get(key) ?? []).filter((t) => now - t < this.windowMs);
    return stamps.length < this.max;
  }

  record(key: string): void {
    const now = this.now();
    const stamps = (this.sent.get(key) ?? []).filter((t) => now - t < this.windowMs);
    stamps.push(now);
    this.sent.set(key, stamps);
  }

  tryConsume(key: string): boolean {
    const now = this.now();
    this.sweep(now);
    const stamps = this.sent.get(key) ?? [];
    while (stamps.length > 0 && now - stamps[0] >= this.windowMs) stamps.shift();
    if (stamps.length >= this.max) {
      this.sent.set(key, stamps);
      return false;
    }
    stamps.push(now);
    this.sent.set(key, stamps);
    return true;
  }

  /** Drops finished windows; if still over the cap, evicts the oldest keys. */
  private sweep(now: number): void {
    if (this.sent.size <= MAX_KEYS) return;
    for (const [k, stamps] of this.sent) {
      if (stamps.length === 0 || now - stamps[stamps.length - 1] >= this.windowMs) this.sent.delete(k);
    }
    for (const k of this.sent.keys()) {
      if (this.sent.size <= MAX_KEYS) break;
      this.sent.delete(k);
    }
  }

  /** Forget everything (tests). */
  clearAll(): void {
    this.sent.clear();
  }
}

/** Key for the allowance: the trimmed, lower-cased, bounded email only. */
export function pinResetKey(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}
