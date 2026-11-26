import { boolean, date, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { ClientPassengerRow } from '@shared/schema';

/** Postgres "undefined column" (42703), possibly wrapped by the driver. */
export function isUndefinedColumn(err: unknown): boolean {
  const codeOf = (e: unknown): unknown => (typeof e === 'object' && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = typeof err === 'object' && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(err) === '42703' || codeOf(cause) === '42703';
}

/**
 * `client_passenger` without the columns added for the portal passport feature (nationality, sex,
 * passport_issue_date). It is a query-only view of the same table, NOT a migration source: the real definition is
 * `clientPassenger` in shared/schema.ts. Until the owner pushes the schema, every existing read and write goes
 * through this so nothing that worked before breaks (drizzle lists every column of a table in INSERT/RETURNING).
 */
export const clientPassengerLegacy = pgTable('client_passenger', {
  id: uuid('id').default(sql`gen_random_uuid()`).primaryKey(),
  clientId: uuid('client_id').notNull(),
  isLead: boolean('is_lead').notNull().default(false),
  title: varchar('title'),
  firstName: varchar('first_name').notNull().default(''),
  surname: varchar('surname').notNull().default(''),
  dateOfBirth: date('date_of_birth', { mode: 'string' }),
  passportNumber: varchar('passport_number', { length: 20 }),
  passportExpiry: date('passport_expiry', { mode: 'string' }),
  passportNonUk: boolean('passport_non_uk').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type ClientPassengerLegacyRow = typeof clientPassengerLegacy.$inferSelect;

/** A legacy row as a full row: the three new details are simply unknown. */
export function fromLegacyRow(row: ClientPassengerLegacyRow): ClientPassengerRow {
  return { ...row, nationality: null, sex: null, passportIssueDate: null };
}

/** The writable fields that exist on the real table but not on the legacy one. */
export const NEW_PASSENGER_KEYS = ['nationality', 'sex', 'passportIssueDate'] as const;

/** `fields` without the new-column keys (for the legacy fallback). */
export function stripNewColumns<T extends object>(fields: T): Omit<T, (typeof NEW_PASSENGER_KEYS)[number]> {
  const out: Record<string, unknown> = { ...(fields as Record<string, unknown>) };
  for (const key of NEW_PASSENGER_KEYS) delete out[key];
  return out as Omit<T, (typeof NEW_PASSENGER_KEYS)[number]>;
}

/** Runs `full`; when the new columns are not in the database yet (42703) runs `legacy` instead. */
export async function withLegacyFallback<T>(full: () => Promise<T>, legacy: () => Promise<T>): Promise<T> {
  try {
    return await full();
  } catch (err) {
    if (isUndefinedColumn(err)) return legacy();
    throw err;
  }
}
