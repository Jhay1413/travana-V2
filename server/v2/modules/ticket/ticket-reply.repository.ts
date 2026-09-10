import { db } from '../../config/database';
import {
  ticketReplies,
  ticketReplyLikes,
  tickets,
  type TicketReply,
  type InsertTicketReply,
} from '@shared/schema';
import { and, eq, asc, sql } from 'drizzle-orm';
import type { TicketReplyWithLikes, TicketReplyWithOrg } from './ticket.types';

export const ticketReplyRepository = {
  async findById(id: string): Promise<TicketReply | undefined> {
    const [result] = await db.select().from(ticketReplies).where(eq(ticketReplies.id, id)).limit(1);
    return result;
  },

  /** The reply plus the org of the ticket it belongs to, for scope checks. */
  async findByIdWithOrg(id: string): Promise<TicketReplyWithOrg | null> {
    const [result] = await db
      .select({
        id: ticketReplies.id,
        ticketId: ticketReplies.ticketId,
        userId: ticketReplies.userId,
        parentReplyId: ticketReplies.parentReplyId,
        content: ticketReplies.content,
        createdAt: ticketReplies.createdAt,
        updatedAt: ticketReplies.updatedAt,
        ticketOrgId: tickets.orgId,
      })
      .from(ticketReplies)
      .leftJoin(tickets, eq(ticketReplies.ticketId, tickets.id))
      .where(eq(ticketReplies.id, id))
      .limit(1);
    return result ?? null;
  },

  async ticketBelongsToOrg(ticketId: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: tickets.id })
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async findByTicketId(ticketId: string, viewerUserId: string | null): Promise<TicketReplyWithLikes[]> {
    // One grouped query: the LEFT JOIN brings in every like, count() skips
    // the NULL row of an un-liked reply, and coalesce() turns bool_or()'s
    // NULL-over-no-rows into a plain false.
    return db
      .select({
        id: ticketReplies.id,
        ticketId: ticketReplies.ticketId,
        userId: ticketReplies.userId,
        parentReplyId: ticketReplies.parentReplyId,
        content: ticketReplies.content,
        createdAt: ticketReplies.createdAt,
        updatedAt: ticketReplies.updatedAt,
        likeCount: sql<number>`count(distinct ${ticketReplyLikes.id})`.mapWith(Number),
        likedByMe: viewerUserId
          ? sql<boolean>`coalesce(bool_or(${ticketReplyLikes.userId} = ${viewerUserId}), false)`.mapWith(Boolean)
          : sql<boolean>`false`.mapWith(Boolean),
      })
      .from(ticketReplies)
      .leftJoin(ticketReplyLikes, eq(ticketReplyLikes.replyId, ticketReplies.id))
      .where(eq(ticketReplies.ticketId, ticketId))
      .groupBy(ticketReplies.id)
      .orderBy(asc(ticketReplies.createdAt));
  },

  async create(reply: InsertTicketReply): Promise<TicketReply> {
    const [result] = await db.insert(ticketReplies).values(reply).returning();
    return result;
  },

  async update(id: string, content: string): Promise<TicketReply | undefined> {
    const [result] = await db
      .update(ticketReplies)
      .set({ content, updatedAt: new Date() })
      .where(eq(ticketReplies.id, id))
      .returning();
    return result;
  },

  /**
   * Deletes a reply and promotes its children to top level. parent_reply_id
   * has no FK, so without this the children would point at a dead id and
   * drop out of any UI that filters on parentReplyId.
   */
  async remove(id: string): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(ticketReplies).set({ parentReplyId: null }).where(eq(ticketReplies.parentReplyId, id));
      await tx.delete(ticketReplies).where(eq(ticketReplies.id, id));
    });
  },

  /**
   * Flip the user's like. Delete-first then insert-on-conflict-do-nothing is
   * branchless, so two concurrent toggles from the same user can't both
   * insert and trip the unique constraint; the count is read in the same
   * transaction so it matches the returned `liked`.
   */
  async toggleLike(replyId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    return db.transaction(async (tx) => {
      const deleted = await tx
        .delete(ticketReplyLikes)
        .where(and(eq(ticketReplyLikes.replyId, replyId), eq(ticketReplyLikes.userId, userId)))
        .returning({ id: ticketReplyLikes.id });

      let liked = false;
      if (deleted.length === 0) {
        const inserted = await tx
          .insert(ticketReplyLikes)
          .values({ replyId, userId })
          .onConflictDoNothing()
          .returning({ id: ticketReplyLikes.id });
        liked = inserted.length > 0;
      }

      const [{ count }] = await tx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(ticketReplyLikes)
        .where(eq(ticketReplyLikes.replyId, replyId));

      return { liked, likeCount: count };
    });
  },
};
