import type { z } from "zod";

/** field name -> first error message for that field */
export type FieldErrors = Record<string, string>;

export function firstErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function validateObject<S extends z.ZodTypeAny>(
  schema: S,
  value: unknown,
): { data: z.output<S> | null; errors: FieldErrors } {
  const result = schema.safeParse(value);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: firstErrors(result.error) };
}

export interface RowResult<T> {
  id: string;
  /** Untouched rows are ignored: they are neither valid nor invalid. */
  blank: boolean;
  errors: FieldErrors;
  data: T | null;
}

interface RowOptions<Row extends { id: string }, S extends z.ZodTypeAny> {
  schema: S;
  isBlank: (row: Row) => boolean;
  /** Fields that must be unique across rows (case-insensitive). */
  unique?: { field: keyof Row & string; message: string; alsoTaken?: string[] }[];
}

/** Validate a table of rows with a zod schema, plus cross-row uniqueness. */
export function validateRows<Row extends { id: string }, S extends z.ZodTypeAny>(
  rows: Row[],
  { schema, isBlank, unique = [] }: RowOptions<Row, S>,
): RowResult<z.output<S>>[] {
  const results: RowResult<z.output<S>>[] = rows.map((row) => {
    if (isBlank(row)) return { id: row.id, blank: true, errors: {}, data: null };
    const { data, errors } = validateObject(schema, row);
    return { id: row.id, blank: false, errors, data };
  });

  for (const rule of unique) {
    const seen = new Set((rule.alsoTaken ?? []).map((v) => v.trim().toLowerCase()));
    rows.forEach((row, i) => {
      const result = results[i];
      if (!result || result.blank || result.errors[rule.field]) return;
      const key = String(row[rule.field]).trim().toLowerCase();
      if (seen.has(key)) {
        result.errors[rule.field] = rule.message;
        result.data = null;
      } else {
        seen.add(key);
      }
    });
  }
  return results;
}

/** First error in column order, for the single message shown under a row. */
export function rowMessage(errors: FieldErrors, order: string[]): string | null {
  for (const key of order) if (errors[key]) return errors[key];
  return null;
}
