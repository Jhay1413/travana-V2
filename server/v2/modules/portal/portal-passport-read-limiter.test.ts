import { describe, expect, it } from 'vitest';
import { InMemoryPassportReadLimiter } from './portal-passport-read-limiter';

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

function make() {
  let now = 1_000_000;
  const limiter = new InMemoryPassportReadLimiter(3, 10, () => now);
  return { limiter, advance: (ms: number) => (now += ms) };
}

/** One whole read: start, then finish. */
function read(limiter: InMemoryPassportReadLimiter, key: string) {
  const start = limiter.tryStart(key);
  if (start.allowed) limiter.finish(key);
  return start;
}

describe('InMemoryPassportReadLimiter', () => {
  it('allows three reads a minute, then blocks until the oldest of them is a minute old', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 3; i += 1) {
      expect(read(limiter, 'c1')).toEqual({ allowed: true });
      advance(10_000);
    }
    expect(read(limiter, 'c1')).toEqual({ allowed: false, retryAfterMs: 30_000 });
    advance(30_000);
    expect(read(limiter, 'c1')).toEqual({ allowed: true });
  });

  it('allows ten reads in 24 hours, then blocks until the oldest is a day old', () => {
    const { limiter, advance } = make();
    for (let i = 0; i < 10; i += 1) {
      expect(read(limiter, 'c1').allowed).toBe(true);
      advance(2 * MIN);
    }
    expect(read(limiter, 'c1')).toEqual({ allowed: false, retryAfterMs: DAY - 20 * MIN });
    advance(DAY - 20 * MIN);
    expect(read(limiter, 'c1').allowed).toBe(true);
  });

  it('check and take are one step: a burst of starts never exceeds the allowance, whatever the interleaving', () => {
    const { limiter } = make();
    const results = Array.from({ length: 50 }, () => limiter.tryStart('c1'));
    expect(results.filter((r) => r.allowed)).toHaveLength(1);
  });

  it('allows one read in flight per customer, released by finish (and finish is idempotent)', () => {
    const { limiter } = make();
    expect(limiter.tryStart('c1').allowed).toBe(true);
    expect(limiter.tryStart('c1')).toEqual({ allowed: false, retryAfterMs: 5_000 });
    expect(limiter.tryStart('c2').allowed).toBe(true);
    limiter.finish('c1');
    limiter.finish('c1');
    expect(limiter.tryStart('c1').allowed).toBe(true);
  });

  it('refund gives back exactly the allowance that was taken', () => {
    const { limiter } = make();
    for (let i = 0; i < 3; i += 1) {
      expect(limiter.tryStart('c1').allowed).toBe(true);
      limiter.refund('c1');
      limiter.finish('c1');
    }
    expect(limiter.blockedForMs('c1')).toBe(0);
    for (let i = 0; i < 3; i += 1) expect(read(limiter, 'c1').allowed).toBe(true);
    expect(read(limiter, 'c1').allowed).toBe(false);
  });

  it('counts each customer separately', () => {
    const { limiter } = make();
    for (let i = 0; i < 3; i += 1) read(limiter, 'c1');
    expect(read(limiter, 'c1').allowed).toBe(false);
    expect(read(limiter, 'c2').allowed).toBe(true);
  });

  it('forgets reads older than a day', () => {
    const { limiter, advance } = make();
    read(limiter, 'c1');
    advance(DAY + 1);
    expect(limiter.blockedForMs('c1')).toBe(0);
  });
});
