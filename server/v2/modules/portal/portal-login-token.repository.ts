import { db } from "../../config/database";
import { portalLoginTokens } from "@shared/schema";
import { and, eq, sql, type SQL } from "drizzle-orm";
import crypto from "crypto";

// Unambiguous alphabet (no 0/O/1/l/I) so a code is safe to read off a phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateLoginCode(len = 12): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

/** What minted a login code: "pin_reset" (the customer asked) or "staff" (a staff member sent the link). */
export type LoginTokenSource = "pin_reset" | "staff";

/**
 * The insert for one login code. The column list is explicit on purpose: the staff-sent path (no `source`)
 * must keep working in a database that has not yet had the `source` column added, which a Drizzle insert
 * (it names every table column) would not.
 */
export function buildLoginTokenInsert(code: string, clientId: string, expiresAt: Date, source?: LoginTokenSource): SQL {
  return source
    ? sql`insert into portal_login_tokens (code, client_id, expires_at, source) values (${code}, ${clientId}, ${expiresAt}, ${source})`
    : sql`insert into portal_login_tokens (code, client_id, expires_at) values (${code}, ${clientId}, ${expiresAt})`;
}

/** Postgres "undefined column" (42703), possibly wrapped by the driver. */
export function isUndefinedColumn(err: unknown): boolean {
  const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(err) === "42703" || codeOf(cause) === "42703";
}

export const portalLoginTokenRepository = {
  /**
   * Mint a single-use login code for a client, valid for `ttlMs`. A `source` is a label only: if the `source`
   * column is not in this database yet (Postgres 42703) the code is minted without it, so minting never breaks.
   */
  async create(clientId: string, ttlMs: number, source?: LoginTokenSource): Promise<string> {
    const code = generateLoginCode();
    const expiresAt = new Date(Date.now() + ttlMs);
    try {
      await db.execute(buildLoginTokenInsert(code, clientId, expiresAt, source));
    } catch (err) {
      if (!source || !isUndefinedColumn(err)) throw err;
      await db.execute(buildLoginTokenInsert(code, clientId, expiresAt));
    }
    return code;
  },

  /**
   * A new staff link replaces the older ones: this client's earlier UNUSED staff-sent codes are marked used, so only
   * the newest works. Safe before the `source` column exists (nothing to match, nothing done).
   */
  async retireStaffLinks(clientId: string): Promise<void> {
    try {
      await db.execute(sql`update portal_login_tokens set used = true where client_id = ${clientId} and source = 'staff' and used = false`);
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
    }
  },

  /** How many staff-sent codes were minted for this client since `since`. Throws if the `source` column does not exist yet. */
  async countStaffLinksSince(clientId: string, since: Date): Promise<number> {
    const result = await db.execute(sql`select count(*)::int as n from portal_login_tokens where client_id = ${clientId} and source = 'staff' and created_at >= ${since}`);
    return Number((result.rows[0] as { n?: number } | undefined)?.n ?? 0);
  },

  /**
   * Consume a code: returns its clientId if valid (exists, unused, unexpired)
   * and marks it used; otherwise null. Single-use is enforced atomically by
   * only flipping `used` on a still-unused row.
   */
  async redeem(code: string): Promise<{ clientId: string } | null> {
    const [row] = await db
      .select({
        id: portalLoginTokens.id,
        clientId: portalLoginTokens.clientId,
        expiresAt: portalLoginTokens.expiresAt,
        used: portalLoginTokens.used,
      })
      .from(portalLoginTokens)
      .where(eq(portalLoginTokens.code, code))
      .limit(1);
    if (!row || row.used || new Date(row.expiresAt).getTime() < Date.now()) return null;

    const [claimed] = await db
      .update(portalLoginTokens)
      .set({ used: true })
      .where(and(eq(portalLoginTokens.id, row.id), eq(portalLoginTokens.used, false)))
      .returning({ id: portalLoginTokens.id });
    if (!claimed) return null;

    return { clientId: row.clientId };
  },
};
