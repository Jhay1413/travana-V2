// Intentionally outside the shop/homeworker partition: portal reads are client-facing and token-gated, not staff reads.
import { db } from '../../config/database';
import {
  accomodation_list,
  board_basis,
  booking,
  country,
  destination,
  quote,
  quote_accomodation,
  quoteCustomerActionsTable,
  resorts,
  tour_operator,
  transaction,
} from '@shared/schema';
import { and, desc, eq, exists, inArray, isNull, not, notInArray, or, sql } from 'drizzle-orm';
import { quoteExtrasTotalExpr } from '../../utils/commission-sql';
import { isUndefinedColumn } from '../../utils/pg-errors';
import { liveBookingWhere, portalDealActiveWhere } from './portal.repository';
import type { PortalDecisionActionRow, PortalQuoteAccessRow, PortalQuoteListRow } from './portal-quotes.types';

/** The action types that carry a decision (the public page's "request changes" does not). */
const DECISION_ACTION_TYPES = ['accepted', 'declined', 'reopened'];

/**
 * THE rule for which quotes a customer can ever see, used by the list, the detail, the actions, ownership and view
 * logging (all go through this file) and by Home's summary. The quote must be live, and so must its deal, the deal
 * must not be a test deal, and staff must not have marked the quote lost or archived (no status counts as live).
 */
export const customerVisibleQuoteWhere = () =>
  and(
    eq(quote.is_active, true),
    eq(transaction.is_active, true),
    eq(transaction.is_test, false),
    or(isNull(quote.quote_status), notInArray(quote.quote_status, ['lost', 'archived'])),
  );

/**
 * The quote's deal already has an active BOOKED booking. Transaction-level (not booking.quote_id) so it also covers
 * bookings created without a quote_id. One rule for the list (hidden) and for access by link (the BOOKED answer).
 */
export const dealIsBooked = () =>
  exists(
    db.select({ one: sql`1` })
      .from(booking)
      .where(and(eq(booking.transaction_id, transaction.id), liveBookingWhere())),
  );

let warnedDecisionColumns = false;

export const portalQuotesRepository = {
  /** Ids of the live bookings (see liveBookingWhere) on the quote's deal; at most two are read, enough to tell "exactly one" from "several". */
  async findLiveBookingIdsForQuote(quoteId: string): Promise<string[]> {
    const rows = await db
      .select({ id: booking.id })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .innerJoin(booking, eq(booking.transaction_id, transaction.id))
      .where(and(eq(quote.id, quoteId), liveBookingWhere()))
      .limit(2);
    return rows.map((r) => r.id);
  },

  /** The customer's active quotes, newest first, minus those whose deal already has a booked booking. */
  async findClientQuotes(clientId: string): Promise<PortalQuoteListRow[]> {
    return db
      .select({
        quoteId: quote.id,
        title: quote.title,
        salesPrice: quote.sales_price,
        discounts: quote.discounts,
        serviceCharge: quote.service_charge,
        extrasTotal: quoteExtrasTotalExpr(),
        adult: quote.adult,
        child: quote.child,
        infant: quote.infant,
        travelDate: quote.travel_date,
        numNights: quote.num_of_nights,
        dateExpiry: quote.date_expiry,
        sentAt: quote.quote_sent_at,
        quoteToken: quote.quote_token,
        operatorName: tour_operator.name,
        boardName: board_basis.type,
        accommodationName: accomodation_list.name,
        destinationName: destination.name,
        countryName: country.country_name,
      })
      .from(transaction)
      .innerJoin(quote, eq(quote.transaction_id, transaction.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .leftJoin(quote_accomodation, and(eq(quote_accomodation.quote_id, quote.id), eq(quote_accomodation.is_primary, true)))
      .leftJoin(board_basis, eq(quote_accomodation.board_basis_id, board_basis.id))
      .leftJoin(accomodation_list, eq(quote_accomodation.accomodation_id, accomodation_list.id))
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(and(
        eq(transaction.client_id, clientId),
        customerVisibleQuoteWhere(),
        // Once a trip is booked, its other quote options/copies stop appearing as pending quotes.
        not(dealIsBooked()),
      ))
      .orderBy(desc(quote.date_created));
  },

  /**
   * Owner, operator, expiry and sent date for a share token, or null when no quote with that token is visible
   * to customers (see customerVisibleQuoteWhere). `isPublishedDeal` is true when the quote is a published
   * deal of `viewerOrgId`'s agency, by exactly the predicate the deals list uses; with no org it is never true.
   */
  async findAccessByToken(token: string, viewerOrgId: string | null): Promise<PortalQuoteAccessRow | null> {
    const [row] = await db
      .select({
        quoteId: quote.id,
        ownerClientId: transaction.client_id,
        isBooked: sql<boolean>`coalesce(${dealIsBooked()}, false)`,
        isPublishedDeal: viewerOrgId ? sql<boolean>`coalesce(${portalDealActiveWhere(viewerOrgId)}, false)` : sql<boolean>`false`,
        operatorName: tour_operator.name,
        dateExpiry: quote.date_expiry,
        sentAt: quote.quote_sent_at,
      })
      .from(quote)
      .innerJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(tour_operator, eq(quote.main_tour_operator_id, tour_operator.id))
      .where(and(eq(quote.quote_token, token), customerVisibleQuoteWhere()))
      .limit(1);
    return row ?? null;
  },

  /**
   * Accepted / declined / reopened actions on these quotes, newest first. The reason and "something similar"
   * columns are newer than the rest: until the schema is pushed they read as null (logged once) so the list
   * and the existing "interested" state keep working.
   */
  async findDecisionActions(quoteIds: string[]): Promise<PortalDecisionActionRow[]> {
    if (quoteIds.length === 0) return [];
    const where = and(
      inArray(quoteCustomerActionsTable.quoteId, quoteIds),
      inArray(quoteCustomerActionsTable.actionType, DECISION_ACTION_TYPES),
    );
    const base = {
      quoteId: quoteCustomerActionsTable.quoteId,
      actionType: quoteCustomerActionsTable.actionType,
      message: quoteCustomerActionsTable.message,
      createdAt: quoteCustomerActionsTable.createdAt,
    };
    try {
      return await db
        .select({ ...base, reason: quoteCustomerActionsTable.reason, wantsSimilar: quoteCustomerActionsTable.wantsSimilar })
        .from(quoteCustomerActionsTable)
        .where(where)
        .orderBy(desc(quoteCustomerActionsTable.createdAt));
    } catch (err) {
      if (!isUndefinedColumn(err)) throw err;
      if (!warnedDecisionColumns) {
        warnedDecisionColumns = true;
        console.warn('[portal-quotes] quote_customer_actions.reason / wants_similar do not exist yet; push the schema. Reasons read as empty until then.');
      }
      const rows = await db.select(base).from(quoteCustomerActionsTable).where(where).orderBy(desc(quoteCustomerActionsTable.createdAt));
      return rows.map((r) => ({ ...r, reason: null, wantsSimilar: null }));
    }
  },
};
