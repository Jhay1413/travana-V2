import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

// Chainable stand-in for the drizzle `db` used by repository unit tests: every
// builder method returns the same chain, `.where()` records its condition, and
// awaiting the chain resolves to the rows set via setRows(). Lets a test assert
// the WHERE clause a repository built without a database.

export const whereCalls: unknown[] = [];
export const orderByCalls: unknown[][] = [];
let rows: unknown[] = [];

export function setRows(next: unknown[]): void {
  rows = next;
}

export function resetCapture(): void {
  whereCalls.length = 0;
  orderByCalls.length = 0;
  rows = [];
}

function makeChain(): object {
  const proxy: object = new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === "then") {
          return (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
            Promise.resolve(rows).then(resolve, reject);
        }
        if (prop === "where") {
          return (cond: unknown) => {
            whereCalls.push(cond);
            return proxy;
          };
        }
        if (prop === "orderBy") {
          return (...cols: unknown[]) => {
            orderByCalls.push(cols);
            return proxy;
          };
        }
        return () => proxy;
      },
    },
  );
  return proxy;
}

export const captureDb: object = new Proxy({}, { get: () => () => makeChain() });

const dialect = new PgDialect();

/** Renders the n-th captured WHERE clause to SQL text + params. */
export function renderWhere(index: number): { text: string; params: unknown[] } {
  const q = dialect.sqlToQuery(whereCalls[index] as SQL);
  return { text: q.sql, params: q.params };
}

/** Renders the n-th captured ORDER BY (all its expressions, comma-joined). */
export function renderOrderBy(index: number): string {
  return orderByCalls[index]
    .map((c) => {
      const q = dialect.sqlToQuery(c instanceof Object && "getSQL" in c ? (c as { getSQL(): SQL }).getSQL() : (c as SQL));
      return q.sql;
    })
    .join(", ");
}
