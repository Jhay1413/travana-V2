import { db } from "../../config/database";
import { portalLoginTokens } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

// Unambiguous alphabet (no 0/O/1/l/I) so a code is safe to read off a phone.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

function generateCode(len = 12): string {
  const bytes = crypto.randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export const portalLoginTokenRepository = {
  /** Mint a single-use login code for a client, valid for `ttlMs`. */
  async create(clientId: string, ttlMs: number): Promise<string> {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + ttlMs);
    await db.insert(portalLoginTokens).values({ code, clientId, expiresAt });
    return code;
  },

  /**
   * Consume a code: returns its clientId if valid (exists, unused, unexpired)
   * and marks it used; otherwise null. Single-use is enforced atomically by
   * only flipping `used` on a still-unused row.
   */
  async redeem(code: string): Promise<{ clientId: string } | null> {
    const [row] = await db
      .select()
      .from(portalLoginTokens)
      .where(eq(portalLoginTokens.code, code))
      .limit(1);
    if (!row || row.used || new Date(row.expiresAt).getTime() < Date.now()) return null;

    const [claimed] = await db
      .update(portalLoginTokens)
      .set({ used: true })
      .where(eq(portalLoginTokens.id, row.id))
      .returning({ id: portalLoginTokens.id });
    if (!claimed) return null;

    return { clientId: row.clientId };
  },
};
