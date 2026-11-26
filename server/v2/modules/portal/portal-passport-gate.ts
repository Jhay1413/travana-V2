/**
 * A small process-wide concurrency gate: at most `maxActive` jobs run at once and at most `maxQueued` wait; one more
 * is refused at once (`GateFullError`) instead of queueing without bound. Passport reads decode a large photo in
 * memory and wait on a provider, so this keeps memory and open connections bounded.
 */
export class GateFullError extends Error {
  constructor() {
    super('gate full');
    this.name = 'GateFullError';
  }
}

export class AbortedWhileQueuedError extends Error {
  constructor() {
    super('aborted while queued');
    this.name = 'AbortedWhileQueuedError';
  }
}

interface Waiter {
  start: () => void;
  cancel: () => void;
}

export class ConcurrencyGate {
  private active = 0;
  private readonly queue: Waiter[] = [];

  constructor(
    private readonly maxActive: number,
    private readonly maxQueued: number,
  ) {}

  /** Runs `job` when a slot is free. Rejects with GateFullError when the queue is full, or AbortedWhileQueuedError if `signal` fires while waiting. */
  async run<T>(job: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.active >= this.maxActive) {
      if (this.queue.length >= this.maxQueued) throw new GateFullError();
      await new Promise<void>((resolve, reject) => {
        const waiter: Waiter = {
          start: () => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
          },
          cancel: () => reject(new AbortedWhileQueuedError()),
        };
        const onAbort = () => {
          const i = this.queue.indexOf(waiter);
          if (i !== -1) {
            this.queue.splice(i, 1);
            waiter.cancel();
          }
        };
        signal?.addEventListener('abort', onAbort, { once: true });
        this.queue.push(waiter);
      });
    } else {
      this.active += 1;
    }
    try {
      return await job();
    } finally {
      const next = this.queue.shift();
      if (next) next.start(); // the slot passes straight to the next waiter
      else this.active -= 1;
    }
  }

  get running(): number {
    return this.active;
  }

  get waiting(): number {
    return this.queue.length;
  }
}
