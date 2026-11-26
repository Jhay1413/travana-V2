const UNIQUE_VIOLATION = '23505';

/** True for a Postgres unique-constraint violation (also when a driver wraps it as `cause`). */
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (code === UNIQUE_VIOLATION) return true;
  return cause !== undefined && cause !== err && isUniqueViolation(cause);
}

const STRING_DATA_RIGHT_TRUNCATION = '22001';

/** True when a value is too long for its column (e.g. a 20 character token in a varchar(12) that has not been widened yet). */
export function isValueTooLong(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (code === STRING_DATA_RIGHT_TRUNCATION) return true;
  return cause !== undefined && cause !== err && isValueTooLong(cause);
}

const UNDEFINED_COLUMN = '42703';

/** True for a Postgres undefined-column error (a column the schema names but the database does not have yet). */
export function isUndefinedColumn(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const { code, cause } = err as { code?: unknown; cause?: unknown };
  if (code === UNDEFINED_COLUMN) return true;
  return cause !== undefined && cause !== err && isUndefinedColumn(cause);
}
