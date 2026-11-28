import { eq, sql } from "drizzle-orm";
import { db } from "../../config/database";
import { clientTable, organization, quote, transaction } from "@shared/schema";
// The portal's visibility rule and live-booking rule, the same ones the public quote link uses, so the page head can
// never say more than the link itself would open.
import { customerVisibleQuoteWhere, dealIsBooked } from "../portal/portal-quotes.repository";
import type { QuoteAccessRow } from "../quote/quote-public.types";

export const pageMetaRepository = {
  /**
   * The access facts and the agency's identity for a share token, in ONE query (an unknown token costs the same
   * single lookup as a known one). Null when no quote has the token, or when more than one does.
   */
  async findAccessByToken(token: string): Promise<QuoteAccessRow | null> {
    const rows = await db
      .select({
        visible: sql<boolean>`coalesce(${customerVisibleQuoteWhere()}, false)`,
        isBooked: sql<boolean>`coalesce(${dealIsBooked()}, false)`,
        clientDeleted: sql<boolean>`(${clientTable.deletedAt} IS NOT NULL)`,
        dateExpiry: quote.date_expiry,
        agencyName: organization.name,
        agencyLogoUrl: organization.logoUrl,
        agencySettings: organization.settings,
      })
      .from(quote)
      .leftJoin(transaction, eq(quote.transaction_id, transaction.id))
      .leftJoin(clientTable, eq(transaction.client_id, clientTable.id))
      .leftJoin(organization, eq(transaction.org_id, organization.id))
      .where(eq(quote.quote_token, token))
      .limit(2);
    return rows.length === 1 ? (rows[0] ?? null) : null;
  },
};
