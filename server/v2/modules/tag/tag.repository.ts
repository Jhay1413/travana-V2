import { db } from "../../config/database";
import { tags, quoteTags, clientTags, bookingTags } from "@shared/schema";
import { eq, ilike, sql, and } from "drizzle-orm";

export const tagRepository = {
  /**
   * Get or create a tag by name (case-insensitive)
   */
  async upsertTag(name: string): Promise<{ id: string; name: string }> {
    const trimmedName = name.trim();

    // Try to find existing tag (case-insensitive)
    const [existing] = await db
      .select()
      .from(tags)
      .where(ilike(tags.name, trimmedName))
      .limit(1);

    if (existing) {
      return { id: existing.id, name: existing.name };
    }

    // Create new tag
    const [newTag] = await db
      .insert(tags)
      .values({
        name: trimmedName,
        usageCount: 0,
      })
      .returning();

    return { id: newTag.id, name: newTag.name };
  },

  /**
   * Add tags to a quote (creates tags if they don't exist)
   */
  async addTagsToQuote(quoteId: string, tagNames: string[]) {
    for (const name of tagNames) {
      if (!name.trim()) continue;

      const tag = await this.upsertTag(name);

      // Check if relationship already exists
      const [existing] = await db
        .select()
        .from(quoteTags)
        .where(and(eq(quoteTags.quoteId, quoteId), eq(quoteTags.tagId, tag.id)))
        .limit(1);

      if (!existing) {
        await db.insert(quoteTags).values({
          quoteId,
          tagId: tag.id,
        });

        // Increment usage count
        await db
          .update(tags)
          .set({
            usageCount: sql`${tags.usageCount} + 1`,
            lastUsedAt: new Date(),
          })
          .where(eq(tags.id, tag.id));
      }
    }
  },

  /**
   * Remove tags from a quote
   */
  async removeTagsFromQuote(quoteId: string, tagNames: string[]) {
    for (const name of tagNames) {
      const [tag] = await db
        .select()
        .from(tags)
        .where(ilike(tags.name, name.trim()))
        .limit(1);

      if (tag) {
        await db
          .delete(quoteTags)
          .where(and(eq(quoteTags.quoteId, quoteId), eq(quoteTags.tagId, tag.id)));

        // Decrement usage count
        await db
          .update(tags)
          .set({
            usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)`,
          })
          .where(eq(tags.id, tag.id));
      }
    }
  },

  /**
   * Replace all tags for a quote
   */
  async replaceQuoteTags(quoteId: string, newTagNames: string[]) {
    // Get current tags for this quote
    const currentTagRelations = await db
      .select({ tagId: quoteTags.tagId, tagName: tags.name })
      .from(quoteTags)
      .innerJoin(tags, eq(quoteTags.tagId, tags.id))
      .where(eq(quoteTags.quoteId, quoteId));

    const currentTagNames = currentTagRelations.map(t => t.tagName.toLowerCase());
    const normalizedNew = newTagNames.map(n => n.trim().toLowerCase());

    // Find tags to remove and add (case-insensitive comparison)
    const toRemove = currentTagRelations
      .filter(t => !normalizedNew.includes(t.tagName.toLowerCase()))
      .map(t => t.tagName);
    const toAdd = newTagNames.filter(n => !currentTagNames.includes(n.trim().toLowerCase()));

    // Remove old tags
    if (toRemove.length > 0) {
      await this.removeTagsFromQuote(quoteId, toRemove);
    }

    // Add new tags
    if (toAdd.length > 0) {
      await this.addTagsToQuote(quoteId, toAdd);
    }
  },

  /**
   * Get tags for a specific quote
   */
  async getQuoteTags(quoteId: string) {
    return await db
      .select({ id: tags.id, name: tags.name })
      .from(quoteTags)
      .innerJoin(tags, eq(quoteTags.tagId, tags.id))
      .where(eq(quoteTags.quoteId, quoteId))
      .orderBy(tags.name);
  },

  /**
   * Get all tags ordered by usage
   */
  async getAllTags() {
    return await db
      .select()
      .from(tags)
      .orderBy(sql`${tags.usageCount} DESC, ${tags.name} ASC`);
  },

  /**
   * Search tags by name
   */
  async searchTags(query: string) {
    return await db
      .select()
      .from(tags)
      .where(ilike(tags.name, `%${query}%`))
      .orderBy(sql`${tags.usageCount} DESC, ${tags.name} ASC`)
      .limit(20);
  },

  /**
   * Delete unused tags (usage count = 0)
   */
  async deleteUnusedTags() {
    await db.delete(tags).where(eq(tags.usageCount, 0));
  },

  /**
   * Get tags selected by a client
   */
  async getClientTags(clientId: string) {
    return await db
      .select({ id: tags.id, name: tags.name })
      .from(clientTags)
      .innerJoin(tags, eq(clientTags.tagId, tags.id))
      .where(eq(clientTags.clientId, clientId))
      .orderBy(tags.name);
  },

  /**
   * Replace all tags for a client
   */
  async setClientTags(clientId: string, tagIds: string[]) {
    await db.delete(clientTags).where(eq(clientTags.clientId, clientId));
    if (tagIds.length > 0) {
      await db.insert(clientTags).values(
        tagIds.map(tagId => ({ clientId, tagId }))
      );
    }
  },

  /**
   * Get tags for a specific booking
   */
  async getBookingTags(bookingId: string) {
    return await db
      .select({ id: tags.id, name: tags.name })
      .from(bookingTags)
      .innerJoin(tags, eq(bookingTags.tagId, tags.id))
      .where(eq(bookingTags.bookingId, bookingId))
      .orderBy(tags.name);
  },

  /**
   * Replace all tags for a booking (using tag names, upserts as needed)
   */
  async replaceBookingTags(bookingId: string, newTagNames: string[]) {
    const currentTagRelations = await db
      .select({ tagId: bookingTags.tagId, tagName: tags.name })
      .from(bookingTags)
      .innerJoin(tags, eq(bookingTags.tagId, tags.id))
      .where(eq(bookingTags.bookingId, bookingId));

    const currentTagNames = currentTagRelations.map(t => t.tagName.toLowerCase());
    const normalizedNew = newTagNames.map(n => n.trim().toLowerCase());

    const toRemove = currentTagRelations.filter(t => !normalizedNew.includes(t.tagName.toLowerCase()));
    const toAdd = newTagNames.filter(n => !currentTagNames.includes(n.trim().toLowerCase()));

    for (const { tagId } of toRemove) {
      await db.delete(bookingTags).where(
        and(eq(bookingTags.bookingId, bookingId), eq(bookingTags.tagId, tagId))
      );
      await db.update(tags)
        .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
        .where(eq(tags.id, tagId));
    }

    for (const name of toAdd) {
      if (!name.trim()) continue;
      const [existing] = await db.select().from(tags).where(ilike(tags.name, name.trim())).limit(1);
      let tagId: string;
      if (existing) {
        tagId = existing.id;
      } else {
        const [newTag] = await db.insert(tags).values({ name: name.trim(), usageCount: 0 }).returning();
        tagId = newTag.id;
      }
      const [already] = await db.select({ id: bookingTags.id }).from(bookingTags)
        .where(and(eq(bookingTags.bookingId, bookingId), eq(bookingTags.tagId, tagId))).limit(1);
      if (!already) {
        await db.insert(bookingTags).values({ bookingId, tagId });
        await db.update(tags)
          .set({ usageCount: sql`${tags.usageCount} + 1`, lastUsedAt: new Date() })
          .where(eq(tags.id, tagId));
      }
    }
  },

  /**
   * Check if a client has any tags selected
   */
  async clientHasTags(clientId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: clientTags.id })
      .from(clientTags)
      .where(eq(clientTags.clientId, clientId))
      .limit(1);
    return !!row;
  },
};
