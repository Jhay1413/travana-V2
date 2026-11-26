/**
 * Per-account PIN lockout. Keyed on what was TYPED (email + agency slug), never on
 * whether an account exists, so a locked key looks identical for real and made-up
 * emails. Behind an interface so a database-backed version can replace the
 * in-memory one later without touching the service.
 */
export interface PinLockout {
  /** Milliseconds left on the lock for this key, or 0 when sign-in by PIN is allowed. */
  lockedForMs(key: string): number;
  /** Records a failed PIN attempt; the Nth failure starts the lock. */
  recordFailure(key: string): void;
  /** Clears the key after a successful sign-in. */
  reset(key: string): void;

  /**
   * Daily budget, keyed on the validated email alone (every org / preferOrg value
   * counts together). Milliseconds until PIN sign-in for this email is allowed
   * again, or 0 when the budget is not used up.
   */
  dailyBlockedForMs(emailKey: string): number;
  /** Records a failed PIN attempt against the daily budget. A success never clears it. */
  recordDailyFailure(emailKey: string): void;
}

/** Failed PIN attempts allowed per email in the rolling window. */
export const PIN_DAILY_MAX_FAILURES = 20;
export const PIN_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

export const PIN_MAX_FAILURES = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;

interface Entry {
  failures: number;
  lockedUntil: number;
  /** When the current run of failures began; a run older than the lock length is forgotten. */
  windowStart: number;
}

/** Entries are swept at most this often, so clean-up cost is bounded by time... */
const SWEEP_INTERVAL_MS = 60 * 1000;
/** ...and the map can never exceed this many keys (oldest evicted first). */
const MAX_ENTRIES = 10_000;

export class InMemoryPinLockout implements PinLockout {
  private readonly entries = new Map<string, Entry>();
  /** emailKey -> timestamps (ascending, at most dailyMax) of failures inside the rolling window. */
  private readonly daily = new Map<string, number[]>();
  private lastSweep = 0;

  constructor(
    private readonly maxFailures: number = PIN_MAX_FAILURES,
    private readonly lockMs: number = PIN_LOCK_MS,
    private readonly now: () => number = () => Date.now(),
    private readonly dailyMax: number = PIN_DAILY_MAX_FAILURES,
    private readonly dailyWindowMs: number = PIN_DAILY_WINDOW_MS,
  ) {}

  lockedForMs(key: string): number {
    this.sweep(this.now());
    const entry = this.entries.get(key);
    if (!entry) return 0;
    const left = entry.lockedUntil - this.now();
    if (left > 0) return left;
    // Lock (if any) has run out: the slate is clean.
    if (entry.lockedUntil > 0) this.entries.delete(key);
    return 0;
  }

  /** Drops finished locks and stale failure runs; evicts the oldest keys if still over the cap. */
  private sweep(now: number): void {
    if (now - this.lastSweep < SWEEP_INTERVAL_MS && this.entries.size <= MAX_ENTRIES && this.daily.size <= MAX_ENTRIES) return;
    this.lastSweep = now;
    for (const [k, stamps] of this.daily) {
      if (stamps.length === 0 || now - stamps[stamps.length - 1] > this.dailyWindowMs) this.daily.delete(k);
    }
    for (const k of this.daily.keys()) {
      if (this.daily.size <= MAX_ENTRIES) break;
      this.daily.delete(k);
    }
    for (const [k, e] of this.entries) {
      if (e.lockedUntil <= now && now - e.windowStart > this.lockMs) this.entries.delete(k);
    }
    for (const k of this.entries.keys()) {
      if (this.entries.size <= MAX_ENTRIES) break;
      this.entries.delete(k);
    }
  }

  recordFailure(key: string): void {
    const now = this.now();
    this.sweep(now);
    let entry = this.entries.get(key);
    if (!entry || (entry.lockedUntil <= now && now - entry.windowStart > this.lockMs)) {
      entry = { failures: 0, lockedUntil: 0, windowStart: now };
    }
    entry.failures += 1;
    if (entry.failures >= this.maxFailures) entry.lockedUntil = now + this.lockMs;
    this.entries.set(key, entry);
  }

  reset(key: string): void {
    this.entries.delete(key);
  }

  dailyBlockedForMs(emailKey: string): number {
    const now = this.now();
    this.sweep(now);
    const stamps = this.daily.get(emailKey);
    if (!stamps) return 0;
    // Drop failures that have aged out of the rolling window.
    while (stamps.length > 0 && now - stamps[0] >= this.dailyWindowMs) stamps.shift();
    if (stamps.length === 0) {
      this.daily.delete(emailKey);
      return 0;
    }
    if (stamps.length < this.dailyMax) return 0;
    return stamps[0] + this.dailyWindowMs - now;
  }

  recordDailyFailure(emailKey: string): void {
    const now = this.now();
    this.sweep(now);
    const stamps = this.daily.get(emailKey) ?? [];
    while (stamps.length > 0 && now - stamps[0] >= this.dailyWindowMs) stamps.shift();
    stamps.push(now);
    // Only the newest dailyMax matter; the oldest of those decides when the block ends.
    while (stamps.length > this.dailyMax) stamps.shift();
    this.daily.set(emailKey, stamps);
  }

  /** Number of tracked keys (tests). */
  get size(): number {
    return this.entries.size + this.daily.size;
  }

  /** Forget everything (tests). */
  clearAll(): void {
    this.entries.clear();
    this.daily.clear();
  }
}

/** Key for the daily budget: the trimmed, lower-cased, bounded email only. */
export function pinDailyKey(email: string): string {
  return email.trim().toLowerCase().slice(0, 254);
}

/** Key for a PIN attempt: lower-cased email plus the agency slug that was typed. */
export function pinLockoutKey(email: string, orgSlug: string | undefined): string {
  // Callers pass validated values; bound them anyway so a key can never be large.
  return `${email.trim().toLowerCase().slice(0, 254)}|${(orgSlug ?? '').trim().toLowerCase().slice(0, 100)}`;
}
