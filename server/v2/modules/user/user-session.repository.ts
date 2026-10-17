import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { sessionDb } from "../../config/session-database";

/**
 * Deletes express-session rows for a user. Sessions live in the session store's
 * database (sessionDb), which may not be the app database, so this deliberately
 * does not use the drizzle `db` pool. Password logins store `{ userId }` on the
 * passport user; OIDC logins store `{ claims: { sub } }`.
 */
export function buildDeleteSessionsQuery(userId: string): { sql: string; params: unknown[] } {
  const statement = sql`DELETE FROM sessions WHERE sess #>> '{passport,user,userId}' = ${userId} OR sess #>> '{passport,user,claims,sub}' = ${userId}`;
  const built = new PgDialect().sqlToQuery(statement);
  return { sql: built.sql, params: built.params };
}

export const userSessionRepository = {
  /** Best-effort: returns the number of sessions removed, 0 when the delete failed. */
  async deleteByUserId(userId: string): Promise<number> {
    try {
      const { sql: text, params } = buildDeleteSessionsQuery(userId);
      const result = await sessionDb.query(text, params);
      return result.rowCount ?? 0;
    } catch (err) {
      console.error("[user-session] failed to delete sessions:", err);
      return 0;
    }
  },
};
