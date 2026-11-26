import { beforeEach, describe, expect, it, vi } from 'vitest';

// A stand-in for drizzle's chainable query builder. Every query runs against one table; while `schemaPushed` is
// false a query on the real `client_passenger` definition fails like Postgres does for a column that is not there.
const state = vi.hoisted(() => ({
  schemaPushed: false,
  ran: [] as Array<{ table: string; op: string; values?: Record<string, unknown> }>,
  legacyRow: undefined as Record<string, unknown> | undefined,
  failWith: undefined as Error | undefined,
}));

vi.mock('../../config/database', async () => {
  const schema = await import('@shared/schema');
  const legacy = await import('./client-passenger-legacy.schema');
  const nameOf = (t: unknown): string => (t === schema.clientPassenger ? 'real' : t === legacy.clientPassengerLegacy ? 'legacy' : 'other');
  function chain(op: string, table: unknown, values?: Record<string, unknown>) {
    const result = () => {
      const which = nameOf(table);
      state.ran.push({ table: which, op, values });
      if (state.failWith) return Promise.reject(state.failWith);
      if (which === 'real' && !state.schemaPushed) return Promise.reject(Object.assign(new Error('column "nationality" does not exist'), { code: '42703' }));
      const row = which === 'legacy' ? state.legacyRow : { id: 'p1', nationality: 'X', sex: 'F', passportIssueDate: '2020-01-01' };
      return Promise.resolve(op === 'select' ? [row] : [row]);
    };
    const proxy: unknown = new Proxy(() => undefined, {
      get: (_t, prop) => (prop === 'then' ? (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => result().then(ok, bad) : () => proxy),
    });
    return proxy;
  }
  return {
    db: {
      select: () => ({ from: (t: unknown) => chain('select', t) }),
      insert: (t: unknown) => ({ values: (v: Record<string, unknown>) => chain('insert', t, v) }),
      update: (t: unknown) => ({ set: (v: Record<string, unknown>) => chain('update', t, v) }),
    },
  };
});

import { clientPassengerRepository as repo } from './client-passenger.repository';

const LEGACY = {
  id: 'p1', clientId: 'c1', isLead: false, title: null, firstName: 'A', surname: 'B', dateOfBirth: null, passportNumber: '123456789',
  passportExpiry: '2032-01-01', passportNonUk: false, createdAt: new Date(), updatedAt: new Date(),
};
const FIELDS = {
  title: null, firstName: 'A', surname: 'B', dateOfBirth: null, passportNumber: '123456789', passportExpiry: '2032-01-01', passportNonUk: false,
  nationality: 'British', sex: 'F', passportIssueDate: '2022-01-01',
};

beforeEach(() => {
  state.schemaPushed = false;
  state.ran.length = 0;
  state.legacyRow = LEGACY;
  state.failWith = undefined;
});

describe('before the schema is pushed (Postgres 42703): everything that worked still works', () => {
  it('reads fall back to the legacy columns and fill the new details with null', async () => {
    const rows = await repo.findByClient('c1');
    expect(state.ran.map((r) => r.table)).toEqual(['real', 'legacy']);
    expect(rows).toEqual([{ ...LEGACY, nationality: null, sex: null, passportIssueDate: null }]);
    expect((await repo.findOne('c1', 'p1'))?.nationality).toBeNull();
    expect((await repo.findLead('c1'))?.passportNumber).toBe('123456789');
  });

  it('a create writes only the legacy columns', async () => {
    const row = await repo.create('c1', FIELDS);
    const insert = state.ran.find((r) => r.table === 'legacy' && r.op === 'insert');
    expect(insert?.values).toBeDefined();
    expect(insert?.values).not.toHaveProperty('nationality');
    expect(insert?.values).not.toHaveProperty('sex');
    expect(insert?.values).not.toHaveProperty('passportIssueDate');
    expect(insert?.values).toMatchObject({ clientId: 'c1', isLead: false, passportNumber: '123456789' });
    expect(row.nationality).toBeNull();
  });

  it('an update and a lead save also drop the new columns', async () => {
    await repo.update('c1', 'p1', FIELDS);
    await repo.upsertLead('c1', { passportNumber: '123456789', passportExpiry: '2032-01-01', passportNonUk: false, nationality: 'British' });
    const legacyWrites = state.ran.filter((r) => r.table === 'legacy' && r.op !== 'select');
    expect(legacyWrites).toHaveLength(2);
    for (const w of legacyWrites) expect(w.values).not.toHaveProperty('nationality');
  });

  it('an error that is not "missing column" is not swallowed and does not trigger the fallback', async () => {
    state.failWith = new Error('connection lost');
    await expect(repo.findByClient('c1')).rejects.toThrow('connection lost');
    expect(state.ran.map((r) => r.table)).toEqual(['real']);
  });
});

describe('after the schema is pushed', () => {
  it('uses the real table only and returns the new details', async () => {
    state.schemaPushed = true;
    const row = await repo.findOne('c1', 'p1');
    expect(state.ran.map((r) => r.table)).toEqual(['real']);
    expect(row).toMatchObject({ nationality: 'X', sex: 'F', passportIssueDate: '2020-01-01' });
  });

  it('writes the new details through', async () => {
    state.schemaPushed = true;
    await repo.create('c1', FIELDS);
    expect(state.ran.find((r) => r.op === 'insert')?.values).toMatchObject({ nationality: 'British', sex: 'F', passportIssueDate: '2022-01-01' });
  });
});
