import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../config/database';
import { clientTable, organization } from '@shared/schema';
import { buildLoginTokenInsert, generateLoginCode } from './portal-login-token.repository';

export interface PinResetTarget {
  firstName: string | null;
  phoneNumber: string | null;
  orgId: string | null;
  orgName: string | null;
  /** False when the agency is suspended (organization.is_active = false). */
  orgActive: boolean;
}

/** `portal_login_tokens.source` of a link minted by a customer's own "Forgotten your PIN?" request. */
export const PIN_RESET_SOURCE = 'pin_reset';

export interface ReserveLinkInput {
  clientId: string;
  orgId: string;
  email: string;
  since: Date;
  maxPerEmail: number;
  maxPerOrg: number;
  ttlMs: number;
}

export type ReserveLinkResult =
  | { reserved: true; code: string }
  | { reserved: false; reason: 'email_cap' | 'org_cap' };

export const portalPinResetRepository = {
  /** What the sign-in message needs about a live customer and their agency. */
  async findTarget(clientId: string): Promise<PinResetTarget | undefined> {
    const [row] = await db
      .select({
        firstName: clientTable.firstName,
        phoneNumber: clientTable.phoneNumber,
        orgId: clientTable.orgId,
        orgName: organization.name,
        orgActive: organization.isActive,
      })
      .from(clientTable)
      .leftJoin(organization, eq(organization.id, clientTable.orgId))
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    if (!row) return undefined;
    return { ...row, orgActive: row.orgActive === true };
  },

  /**
   * Atomically reserves one sign-in link: under a per-agency advisory lock it counts the links already minted
   * by "Forgotten your PIN?" (for this email at this agency, and for the whole agency, since `since`) and, only
   * if both are under their caps, inserts the token (source 'pin_reset') in the same transaction. Concurrent
   * requests for the same agency are serialised, so the caps cannot be overshot, in this process or another.
   * A reserved link counts even if its message later fails. Throws when the `source` column does not exist yet;
   * the caller fails closed.
   */
  async reserveLink(input: ReserveLinkInput): Promise<ReserveLinkResult> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`portal_pin_reset:${input.orgId}`}, 0))`);

      const email = input.email.trim().toLowerCase();
      const forEmail = await tx.execute(sql`
        select count(*)::int as n from portal_login_tokens t
        join client_table c on c.id = t.client_id
        where t.source = ${PIN_RESET_SOURCE} and t.created_at >= ${input.since}
          and c.org_id = ${input.orgId} and lower(c.email) = ${email}`);
      if (Number((forEmail.rows[0] as { n?: number } | undefined)?.n ?? 0) >= input.maxPerEmail) {
        return { reserved: false, reason: 'email_cap' } as const;
      }

      const forOrg = await tx.execute(sql`
        select count(*)::int as n from portal_login_tokens t
        join client_table c on c.id = t.client_id
        where t.source = ${PIN_RESET_SOURCE} and t.created_at >= ${input.since} and c.org_id = ${input.orgId}`);
      if (Number((forOrg.rows[0] as { n?: number } | undefined)?.n ?? 0) >= input.maxPerOrg) {
        return { reserved: false, reason: 'org_cap' } as const;
      }

      const code = generateLoginCode();
      await tx.execute(buildLoginTokenInsert(code, input.clientId, new Date(Date.now() + input.ttlMs), PIN_RESET_SOURCE));
      return { reserved: true, code } as const;
    });
  },
};
