const UNIQUE_VIOLATION = '23505';

/** True for a Postgres unique-constraint violation (also when a driver wraps it as `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (code === UNIQUE_VIOLATION) return true;
  return cause !== undefined && cause !== err && isUniqueViolation(cause);
}
