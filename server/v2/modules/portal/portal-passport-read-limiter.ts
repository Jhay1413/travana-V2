/**
 * Per-customer budget for passport photo reads (each one costs money and handles an identity document).
 * Behind an interface so a database-backed version can replace the in-memory one without touching the service.
 *
 * `tryStart` is ONE synchronous step that checks and takes the allowance together, so parallel requests cannot
 * all pass a check before any of them is recorded. It also allows at most one read in flight per customer.
 */
export type PassportReadStart = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface PassportReadLimiter {
  /** Atomically: refuse while a read is already running or the budget is used up; otherwise count this read and mark it running. */
  tryStart(key: string): PassportReadStart;
  /** The read has ended (any way): another one may start. Idempotent. */
  finish(key: string): void;
  /** Gives back the allowance taken by `tryStart` (a read refused before it reached the provider, for a reason that is not the customer's doing). */
  refund(key: string): void;
}

export const PASSPORT_READS_PER_MINUTE = 3;
export const PASSPORT_READS_PER_DAY = 10;
/** How long a customer is told to wait when a read of theirs is still running. */
export const PASSPORT_IN_FLIGHT_RETRY_MS = 5_000;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_KEYS = 10_000;

export class InMemoryPassportReadLimiter implements PassportReadLimiter {
  /** key -> read timestamps (ascending) still inside the day window. */
  private readonly reads = new Map<string, number[]>();
  private readonly running = new Set<string>();

  constructor(
    private readonly perMinute: number = PASSPORT_READS_PER_MINUTE,
    private readonly perDay: number = PASSPORT_READS_PER_DAY,
    private readonly now: () => number = () => Date.now(),
  ) {}

  private live(key: string): number[] {
    const now = this.now();
    const stamps = this.reads.get(key) ?? [];
    while (stamps.length > 0 && now - stamps[0]! >= DAY_MS) stamps.shift();
    if (stamps.length === 0) this.reads.delete(key);
    return stamps;
  }

  /** Milliseconds until the budget allows another read, or 0 (ignores the in-flight rule). */
  blockedForMs(key: string): number {
    const now = this.now();
    const stamps = this.live(key);
    let wait = 0;
    if (stamps.length >= this.perDay) wait = Math.max(wait, stamps[stamps.length - this.perDay]! + DAY_MS - now);
    if (stamps.length >= this.perMinute) wait = Math.max(wait, stamps[stamps.length - this.perMinute]! + MINUTE_MS - now);
    return Math.max(0, wait);
  }

  tryStart(key: string): PassportReadStart {
    if (this.running.has(key)) return { allowed: false, retryAfterMs: PASSPORT_IN_FLIGHT_RETRY_MS };
    const wait = this.blockedForMs(key);
    if (wait > 0) return { allowed: false, retryAfterMs: wait };
    this.evictIfFull();
    const stamps = this.live(key);
    stamps.push(this.now());
    this.reads.set(key, stamps);
    this.running.add(key);
    return { allowed: true };
  }

  finish(key: string): void {
    this.running.delete(key);
  }

  refund(key: string): void {
    const stamps = this.reads.get(key);
    if (!stamps) return;
    stamps.pop();
    if (stamps.length === 0) this.reads.delete(key);
  }

  private evictIfFull(): void {
    if (this.reads.size <= MAX_KEYS) return;
    for (const k of [...this.reads.keys()]) {
      this.live(k);
      if (this.reads.size <= MAX_KEYS) return;
    }
    const oldest = this.reads.keys().next().value;
    if (typeof oldest === 'string') this.reads.delete(oldest);
  }

  /** Forget everything (tests). */
  clearAll(): void {
    this.reads.clear();
    this.running.clear();
  }
}
