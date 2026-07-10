import { and, eq } from "drizzle-orm";
import { db } from "../../config/database";
import { sendsevenContactLinks, type SendsevenContactLink } from "@shared/schema";

// Repository: DB access for the SendSeven-contact ↔ client link (one row per
// linked contact). Only touches the `sendseven_contact_links` table — client
// reads/writes go through the neon-client module.

export const contactLinkRepository = {
  async findByContact(orgId: string, contactId: string): Promise<SendsevenContactLink | null> {
    const [row] = await db
      .select()
      .from(sendsevenContactLinks)
      .where(and(eq(sendsevenContactLinks.orgId, orgId), eq(sendsevenContactLinks.sendsevenContactId, contactId)));
    return row ?? null;
  },

  // Links a contact to a client. A client maps to at most one contact, so any
  // prior link for this client is removed first; then we upsert on the contact.
  async link(
    orgId: string,
    contactId: string,
    clientId: string,
    linkedBy: string | null,
  ): Promise<SendsevenContactLink> {
    return db.transaction(async (tx) => {
      await tx
        .delete(sendsevenContactLinks)
        .where(and(eq(sendsevenContactLinks.orgId, orgId), eq(sendsevenContactLinks.clientId, clientId)));

      const [row] = await tx
        .insert(sendsevenContactLinks)
        .values({ orgId, sendsevenContactId: contactId, clientId, linkedBy })
        .onConflictDoUpdate({
          target: [sendsevenContactLinks.orgId, sendsevenContactLinks.sendsevenContactId],
          set: { clientId, linkedBy, linkedAt: new Date() },
        })
        .returning();
      return row;
    });
  },

  async deleteByContact(orgId: string, contactId: string): Promise<void> {
    await db
      .delete(sendsevenContactLinks)
      .where(and(eq(sendsevenContactLinks.orgId, orgId), eq(sendsevenContactLinks.sendsevenContactId, contactId)));
  },
};
