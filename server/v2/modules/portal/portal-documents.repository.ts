// Intentionally outside the shop/homeworker partition: portal reads are client-facing and session-gated, not staff reads.
import { db } from '../../config/database';
import { booking, clientFiles, enquiry_table, quote, transaction } from '@shared/schema';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { liveBookingWhere } from './portal.repository';
import type { PortalLinkedFileRow } from './portal-documents.types';

const linkedBooking = alias(booking, 'link_booking');
const linkedQuote = alias(quote, 'link_quote');
const linkedEnquiry = alias(enquiry_table, 'link_enquiry');
const linkedDeal = alias(transaction, 'link_deal');

/** The stored allocation, normalised the same way for every join: lower-case and trimmed. */
const allocType = sql`lower(trim(${clientFiles.allocationType}))`;
const allocId = sql`lower(trim(${clientFiles.allocationId}))`;

/**
 * Reads for the customer's "My documents". The only file table read is `client_files`, and every query is bound to the
 * session customer's id; columns are named so the uploader and any staff-side detail are never selected.
 */
export const portalDocumentsRepository = {
  /**
   * THE visibility rule, used by both the list and the download. A `client_files` row of THIS customer is returned only
   * when its stored allocation (type + id, which staff entered as free text) joins to a real booking, quote or enquiry
   * whose deal (`transaction`) belongs to the same customer and is not a test deal. The id is compared as text, so an
   * old placeholder like "booking-1" simply joins nothing. A file failing the join is not returned at all.
   * Newest first. Pass `fileId` to look at one file only.
   */
  async findVisibleFiles(clientId: string, fileId?: string): Promise<PortalLinkedFileRow[]> {
    return db
      .select({
        id: clientFiles.id,
        clientId: clientFiles.clientId,
        filename: clientFiles.filename,
        title: clientFiles.title,
        originalName: clientFiles.originalName,
        mimeType: clientFiles.mimeType,
        size: clientFiles.size,
        category: clientFiles.category,
        createdAt: clientFiles.createdAt,
        dealId: linkedDeal.id,
      })
      .from(clientFiles)
      .leftJoin(linkedBooking, and(sql`${allocType} = 'booking'`, sql`${linkedBooking.id}::text = ${allocId}`))
      .leftJoin(linkedQuote, and(sql`${allocType} = 'quote'`, sql`${linkedQuote.id}::text = ${allocId}`, isNull(linkedQuote.deleted_at)))
      .leftJoin(linkedEnquiry, and(sql`${allocType} = 'enquiry'`, sql`${linkedEnquiry.id}::text = ${allocId}`))
      .innerJoin(
        linkedDeal,
        sql`${linkedDeal.id} = coalesce(${linkedBooking.transaction_id}, ${linkedQuote.transaction_id}, ${linkedEnquiry.transaction_id})`,
      )
      .where(
        and(
          eq(clientFiles.clientId, clientId),
          eq(linkedDeal.client_id, clientId),
          sql`${linkedDeal.is_test} IS NOT TRUE`,
          fileId ? eq(clientFiles.id, fileId) : undefined,
        ),
      )
      .orderBy(desc(clientFiles.createdAt));
  },

  /** Of the given deals (of THIS customer), the live booking of each (see liveBookingWhere). */
  async findLiveBookingsByDeal(clientId: string, dealIds: string[]): Promise<Array<{ dealId: string; bookingId: string }>> {
    if (dealIds.length === 0) return [];
    return db
      .select({ dealId: booking.transaction_id, bookingId: booking.id })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(and(inArray(booking.transaction_id, dealIds), eq(transaction.client_id, clientId), liveBookingWhere()));
  },

  /** Of the given deals (of THIS customer), those that have a booking at all, live or not. */
  async findDealIdsWithAnyBooking(clientId: string, dealIds: string[]): Promise<string[]> {
    if (dealIds.length === 0) return [];
    const rows = await db
      .select({ dealId: booking.transaction_id })
      .from(booking)
      .innerJoin(transaction, eq(booking.transaction_id, transaction.id))
      .where(and(inArray(booking.transaction_id, dealIds), eq(transaction.client_id, clientId)));
    return rows.map((r) => r.dealId);
  },
};
