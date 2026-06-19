import { db } from "../../config/database";
import { tags, quoteTags, clientTags, bookingTags } from "@shared/schema";
import { eq, ilike, sql, and, inArray } from "drizzle-orm";

export const tagRepository = {
  /**
   * Get or create a tag by name (case-insensitive).
   *
   * tags.name has a unique constraint in the schema, so we use
   * onConflictDoUpdate to avoid the select-then-insert race condition.
   * The update sets name to itself — this is a no-op that lets `.returning()`
   * return the existing row when a conflict occurs.
   */
  async upsertTag(name: string): Promise<{ id: string; name: string }> {
    const trimmedName = name.trim();

    const [row] = await db
      .insert(tags)
      .values({ name: trimmedName, usageCount: 0 })
      .onConflictDoUpdate({
        target: tags.name,
        set: { name: tags.name },
      })
      .returning({ id: tags.id, name: tags.name });

    return { id: row.id, name: row.name };
  },

  /**
   * Add tags to a quote (creates tags if they don't exist).
   *
   * Reduced from ~3-4 queries per tag to 4 total queries regardless of count:
   *   1. Bulk upsert all tag rows (one INSERT … ON CONFLICT DO UPDATE RETURNING).
   *   2. One inArray query to find which quote-tag relations already exist.
   *   3. One bulk insert of the missing relation rows (guarded against empty).
   *   4. One atomic UPDATE usage_count += 1 WHERE id IN (…) (guarded against empty).
   */
  async addTagsToQuote(quoteId: string, tagNames: string[]) {
    const validNames = tagNames.map(n => n.trim()).filter(Boolean);
    if (validNames.length === 0) return;

    // 1. Bulk upsert all tag rows — returns id+name for every input name.
    const upsertedTags = await db
      .insert(tags)
      .values(validNames.map(name => ({ name, usageCount: 0 })))
      .onConflictDoUpdate({
        target: tags.name,
        set: { name: tags.name },
      })
      .returning({ id: tags.id, name: tags.name });

    const allTagIds = upsertedTags.map(t => t.id);

    // 2. Find which quote-tag relations already exist.
    const existingRelations = await db
      .select({ tagId: quoteTags.tagId })
      .from(quoteTags)
      .where(
        and(
          eq(quoteTags.quoteId, quoteId),
          inArray(quoteTags.tagId, allTagIds),
        ),
      );

    const existingTagIdSet = new Set(existingRelations.map(r => r.tagId));
    const newTagIds = allTagIds.filter(id => !existingTagIdSet.has(id));

    if (newTagIds.length === 0) return;

    // 3. Bulk insert the missing relation rows.
    await db
      .insert(quoteTags)
      .values(newTagIds.map(tagId => ({ quoteId, tagId })));

    // 4. Atomic increment of usage_count for the newly linked tags.
    await db
      .update(tags)
      .set({
        usageCount: sql`${tags.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(inArray(tags.id, newTagIds));
  },

  /**
   * Remove tags from a quote.
   *
   * Reduced from ~3 queries per tag to 3 total queries:
   *   1. One query to resolve all tag ids by lowercased name.
   *   2. One bulk delete of matching quote-tag relations.
   *   3. One atomic UPDATE usage_count = GREATEST(usage_count - 1, 0) WHERE id IN (…).
   */
  async removeTagsFromQuote(quoteId: string, tagNames: string[]) {
    const validNames = tagNames.map(n => n.trim().toLowerCase()).filter(Boolean);
    if (validNames.length === 0) return;

    // 1. Resolve all tag ids in one query using lower(name) IN (...).
    //    tags.name has a unique constraint so this returns at most one row per name.
    const foundTags = await db
      .select({ id: tags.id })
      .from(tags)
      .where(sql`lower(${tags.name}) IN (${sql.join(validNames.map(n => sql`${n}`), sql`, `)})`);

    if (foundTags.length === 0) return;
    const tagIds = foundTags.map(t => t.id);

    // 2. Bulk delete quote-tag relations.
    await db
      .delete(quoteTags)
      .where(
        and(
          eq(quoteTags.quoteId, quoteId),
          inArray(quoteTags.tagId, tagIds),
        ),
      );

    // 3. Atomic decrement (floored at 0) for all affected tags.
    await db
      .update(tags)
      .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
      .where(inArray(tags.id, tagIds));
  },

  /**
   * Replace all tags for a quote.
   *
   * Wrapped in a transaction for atomicity. Diffs the current tags against
   * newTagNames and delegates to the batched add/remove helpers.
   */
  async replaceQuoteTags(quoteId: string, newTagNames: string[]) {
    await db.transaction(async (tx) => {
      // Get current tags for this quote.
      const currentTagRelations = await tx
        .select({ tagId: quoteTags.tagId, tagName: tags.name })
        .from(quoteTags)
        .innerJoin(tags, eq(quoteTags.tagId, tags.id))
        .where(eq(quoteTags.quoteId, quoteId));

      const currentTagNames = currentTagRelations.map(t => t.tagName.toLowerCase());
      const normalizedNew = newTagNames.map(n => n.trim().toLowerCase());

      const toRemoveNames = currentTagRelations
        .filter(t => !normalizedNew.includes(t.tagName.toLowerCase()))
        .map(t => t.tagName);
      const toAddNames = newTagNames.filter(
        n => !currentTagNames.includes(n.trim().toLowerCase()),
      );

      // -- Remove old tags (batched) --
      if (toRemoveNames.length > 0) {
        const validRemove = toRemoveNames
          .map(n => n.trim().toLowerCase())
          .filter(Boolean);

        const foundTags = await tx
          .select({ id: tags.id })
          .from(tags)
          .where(
            sql`lower(${tags.name}) IN (${sql.join(validRemove.map(n => sql`${n}`), sql`, `)})`,
          );

        if (foundTags.length > 0) {
          const removeTagIds = foundTags.map(t => t.id);

          await tx
            .delete(quoteTags)
            .where(
              and(
                eq(quoteTags.quoteId, quoteId),
                inArray(quoteTags.tagId, removeTagIds),
              ),
            );

          await tx
            .update(tags)
            .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
            .where(inArray(tags.id, removeTagIds));
        }
      }

      // -- Add new tags (batched) --
      if (toAddNames.length > 0) {
        const validAdd = toAddNames.map(n => n.trim()).filter(Boolean);

        const upsertedTags = await tx
          .insert(tags)
          .values(validAdd.map(name => ({ name, usageCount: 0 })))
          .onConflictDoUpdate({ target: tags.name, set: { name: tags.name } })
          .returning({ id: tags.id });

        const allTagIds = upsertedTags.map(t => t.id);

        const existingRelations = await tx
          .select({ tagId: quoteTags.tagId })
          .from(quoteTags)
          .where(
            and(
              eq(quoteTags.quoteId, quoteId),
              inArray(quoteTags.tagId, allTagIds),
            ),
          );

        const existingTagIdSet = new Set(existingRelations.map(r => r.tagId));
        const newTagIds = allTagIds.filter(id => !existingTagIdSet.has(id));

        if (newTagIds.length > 0) {
          await tx
            .insert(quoteTags)
            .values(newTagIds.map(tagId => ({ quoteId, tagId })));

          await tx
            .update(tags)
            .set({ usageCount: sql`${tags.usageCount} + 1`, lastUsedAt: new Date() })
            .where(inArray(tags.id, newTagIds));
        }
      }
    });
  },

  /**
   * Get tags for a specific quote.
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
   * Get all tags ordered by usage.
   */
  async getAllTags() {
    return await db
      .select()
      .from(tags)
      .orderBy(sql`${tags.usageCount} DESC, ${tags.name} ASC`);
  },

  /**
   * Search tags by name.
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
   * Delete unused tags (usage count = 0).
   */
  async deleteUnusedTags() {
    await db.delete(tags).where(eq(tags.usageCount, 0));
  },

  /**
   * Get tags selected by a client.
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
   * Replace all tags for a client.
   */
  async setClientTags(clientId: string, tagIds: string[]) {
    await db.delete(clientTags).where(eq(clientTags.clientId, clientId));
    if (tagIds.length > 0) {
      await db.insert(clientTags).values(
        tagIds.map(tagId => ({ clientId, tagId })),
      );
    }
  },

  /**
   * Get tags for a specific booking.
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
   * Replace all tags for a booking (using tag names, upserts as needed).
   *
   * Wrapped in a transaction for atomicity. All diffing and bulk operations
   * are done without per-item loops:
   *   - toRemove: resolved from already-fetched currentTagRelations (reuses ids, no re-query).
   *   - toAdd: bulk upsert tags + bulk insert relations + atomic usage_count increment.
   *
   * Total queries: 1 (fetch current) + 0-1 (bulk delete) + 0-1 (decrement)
   *              + 0-1 (bulk upsert tags) + 0-1 (check existing rels) + 0-1 (insert rels)
   *              + 0-1 (increment) = at most 7 queries regardless of tag count.
   */
  async replaceBookingTags(bookingId: string, newTagNames: string[]) {
    await db.transaction(async (tx) => {
      // 1. Fetch current booking-tag relations (includes tag ids and names).
      const currentTagRelations = await tx
        .select({ tagId: bookingTags.tagId, tagName: tags.name })
        .from(bookingTags)
        .innerJoin(tags, eq(bookingTags.tagId, tags.id))
        .where(eq(bookingTags.bookingId, bookingId));

      const currentTagNames = currentTagRelations.map(t => t.tagName.toLowerCase());
      const normalizedNew = newTagNames.map(n => n.trim().toLowerCase());

      // Diff: reuse fetched tag ids — no re-query needed.
      const toRemove = currentTagRelations.filter(
        t => !normalizedNew.includes(t.tagName.toLowerCase()),
      );
      const toAddNames = newTagNames.filter(
        n => !currentTagNames.includes(n.trim().toLowerCase()),
      );

      // -- Remove old tags (batched, reusing ids from currentTagRelations) --
      if (toRemove.length > 0) {
        const removeTagIds = toRemove.map(t => t.tagId);

        await tx
          .delete(bookingTags)
          .where(
            and(
              eq(bookingTags.bookingId, bookingId),
              inArray(bookingTags.tagId, removeTagIds),
            ),
          );

        await tx
          .update(tags)
          .set({ usageCount: sql`GREATEST(${tags.usageCount} - 1, 0)` })
          .where(inArray(tags.id, removeTagIds));
      }

      // -- Add new tags (batched) --
      if (toAddNames.length > 0) {
        const validAdd = toAddNames.map(n => n.trim()).filter(Boolean);

        // Bulk upsert tag rows.
        const upsertedTags = await tx
          .insert(tags)
          .values(validAdd.map(name => ({ name, usageCount: 0 })))
          .onConflictDoUpdate({ target: tags.name, set: { name: tags.name } })
          .returning({ id: tags.id });

        const allTagIds = upsertedTags.map(t => t.id);

        // Find which booking-tag relations already exist.
        const existingRelations = await tx
          .select({ tagId: bookingTags.tagId })
          .from(bookingTags)
          .where(
            and(
              eq(bookingTags.bookingId, bookingId),
              inArray(bookingTags.tagId, allTagIds),
            ),
          );

        const existingTagIdSet = new Set(existingRelations.map(r => r.tagId));
        const newTagIds = allTagIds.filter(id => !existingTagIdSet.has(id));

        if (newTagIds.length > 0) {
          await tx
            .insert(bookingTags)
            .values(newTagIds.map(tagId => ({ bookingId, tagId })));

          await tx
            .update(tags)
            .set({ usageCount: sql`${tags.usageCount} + 1`, lastUsedAt: new Date() })
            .where(inArray(tags.id, newTagIds));
        }
      }
    });
  },

  /**
   * Check if a client has any tags selected.
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
