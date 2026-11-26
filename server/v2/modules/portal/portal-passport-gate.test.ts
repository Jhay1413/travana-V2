import { describe, expect, it } from 'vitest';
import { AbortedWhileQueuedError, ConcurrencyGate, GateFullError } from './portal-passport-gate';

function job() {
  let release!: (v: string) => void;
  const done = new Promise<string>((r) => { release = r; });
  return { done, release };
}
const tick = () => new Promise((r) => setTimeout(r, 5));

describe('ConcurrencyGate', () => {
  it('runs up to maxActive at once and queues the next ones in order', async () => {
    const gate = new ConcurrencyGate(2, 2);
    const jobs = [job(), job(), job(), job()];
    const order: number[] = [];
    const runs = jobs.map((j, i) => gate.run(async () => { order.push(i); return j.done; }));
    await tick();
    expect(order).toEqual([0, 1]);
    expect([gate.running, gate.waiting]).toEqual([2, 2]);
    jobs[0]!.release('a');
    await tick();
    expect(order).toEqual([0, 1, 2]);
    jobs[1]!.release('b');
    jobs[2]!.release('c');
    await tick();
    jobs[3]!.release('d');
    expect(await Promise.all(runs)).toEqual(['a', 'b', 'c', 'd']);
    expect([gate.running, gate.waiting]).toEqual([0, 0]);
  });

  it('refuses at once when the waiting room is full, never queueing without bound', async () => {
    const gate = new ConcurrencyGate(1, 1);
    const a = job();
    const b = job();
    const first = gate.run(() => a.done);
    const second = gate.run(() => b.done);
    await tick();
    await expect(gate.run(async () => 'x')).rejects.toBeInstanceOf(GateFullError);
    a.release('1');
    await tick();
    b.release('2');
    await Promise.all([first, second]);
  });

  it('a failing job still frees its slot', async () => {
    const gate = new ConcurrencyGate(1, 1);
    await expect(gate.run(async () => { throw new Error('boom'); })).rejects.toThrow('boom');
    expect(await gate.run(async () => 'ok')).toBe('ok');
    expect(gate.running).toBe(0);
  });

  it('a waiter whose customer leaves is dropped from the queue and never runs', async () => {
    const gate = new ConcurrencyGate(1, 2);
    const a = job();
    const first = gate.run(() => a.done);
    const gone = new AbortController();
    let ran = false;
    const waiting = gate.run(async () => { ran = true; return 'x'; }, gone.signal);
    await tick();
    expect(gate.waiting).toBe(1);
    gone.abort();
    await expect(waiting).rejects.toBeInstanceOf(AbortedWhileQueuedError);
    expect(gate.waiting).toBe(0);
    a.release('1');
    await first;
    expect(ran).toBe(false);
    expect(gate.running).toBe(0);
  });
});
