import { and, eq, inArray, or } from "drizzle-orm";
import { db } from "../../config/database";
import { inboxNoteAuthors, user, type InsertInboxNoteAuthor } from "@shared/schema";

export interface InboxNoteAuthorRow {
  sendsevenMessageId: string;
  sendsevenNoteId: string | null;
  userId: string;
  firstName: string;
  lastName: string;
  name: string;
  image: string | null;
}

export const inboxNoteAuthorRepository = {
  async create(row: InsertInboxNoteAuthor): Promise<void> {
    await db.insert(inboxNoteAuthors).values(row).onConflictDoNothing({ target: inboxNoteAuthors.sendsevenMessageId });
  },

  // `ids` may hold SendSeven message ids or note ids: the create response and
  // the thread listing don't use the same one, so match on either column.
  async findByMessageIds(orgId: string, ids: string[]): Promise<InboxNoteAuthorRow[]> {
    if (ids.length === 0) return [];
    return db
      .select({
        sendsevenMessageId: inboxNoteAuthors.sendsevenMessageId,
        sendsevenNoteId: inboxNoteAuthors.sendsevenNoteId,
        userId: inboxNoteAuthors.userId,
        firstName: user.firstName,
        lastName: user.lastName,
        name: user.name,
        image: user.image,
      })
      .from(inboxNoteAuthors)
      .innerJoin(user, eq(user.id, inboxNoteAuthors.userId))
      .where(
        and(
          eq(inboxNoteAuthors.orgId, orgId),
          or(inArray(inboxNoteAuthors.sendsevenMessageId, ids), inArray(inboxNoteAuthors.sendsevenNoteId, ids)),
        ),
      );
  },
};
