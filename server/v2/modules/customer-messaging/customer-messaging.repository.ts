import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../../config/database";
import {
  booking as bookingTable,
  branches,
  clientTable,
  customerMessageLog,
  organization,
  smsTemplatesTable,
  transaction as transactionTable,
  user as userTable,
  userOrgRoles,
  type InsertCustomerMessageLog,
} from "@shared/schema";
import type { MessageLogRow } from "./customer-messaging-staff.types";

// Repository: database access for automatic customer messages. Reads the client, the agency's switch rows,
// who owns the client, and writes/reads customer_message_log. Every query that touches a customer is scoped
// by org_id, so one agency can never see or affect another's log.

/** The log table is not in the database yet (Postgres 42P01, possibly wrapped by the driver). */
export class LogUnavailableError extends Error {
  constructor() {
    super("customer_message_log is not available");
    this.name = "LogUnavailableError";
  }
}

function isUndefinedTable(err: unknown): boolean {
  const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null ? (e as { code?: unknown }).code : undefined);
  const cause = typeof err === "object" && err !== null ? (err as { cause?: unknown }).cause : undefined;
  return codeOf(err) === "42P01" || codeOf(cause) === "42P01";
}

async function onLog<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (err) {
    if (isUndefinedTable(err)) throw new LogUnavailableError();
    throw err;
  }
}

export interface MessagingClient {
  id: string;
  orgId: string | null;
  firstName: string;
  surename: string;
  email: string | null;
  phoneNumber: string;
  smsOptIn: boolean;
  branchId: string | null;
  createdBy: string | null;
}

export interface ActiveSwitchRow {
  autoTrigger: string;
  category: string;
  triggerDaysBefore: number | null;
}

export const customerMessagingRepository = {
  /** Soft-deleted clients read as not found, so nothing automatic is ever sent to them. */
  async findClient(clientId: string): Promise<MessagingClient | null> {
    const [row] = await db
      .select({
        id: clientTable.id,
        orgId: clientTable.orgId,
        firstName: clientTable.firstName,
        surename: clientTable.surename,
        email: clientTable.email,
        phoneNumber: clientTable.phoneNumber,
        smsOptIn: clientTable.smsOptIn,
        branchId: clientTable.branchId,
        createdBy: clientTable.createdBy,
      })
      .from(clientTable)
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  async isOrgActive(orgId: string): Promise<boolean> {
    const [row] = await db.select({ isActive: organization.isActive }).from(organization).where(eq(organization.id, orgId)).limit(1);
    return row?.isActive === true;
  },

  /** The org's active SMS template rows for the three automatic triggers: the on/off switches of the message types. */
  async listActiveSwitchRows(orgId: string): Promise<ActiveSwitchRow[]> {
    return db
      .select({
        autoTrigger: smsTemplatesTable.autoTrigger,
        category: smsTemplatesTable.category,
        triggerDaysBefore: smsTemplatesTable.triggerDaysBefore,
      })
      .from(smsTemplatesTable)
      .where(
        and(
          eq(smsTemplatesTable.orgId, orgId),
          eq(smsTemplatesTable.active, true),
          inArray(smsTemplatesTable.autoTrigger, ["on_booking_create", "on_pin_set", "days_before_departure"]),
        ),
      );
  },

  /** The agent and branch of the deal a booking belongs to, scoped to this client; null when it is not theirs. */
  async findBookingOwner(clientId: string, bookingId: string): Promise<{ userId: string; branchId: string | null } | null> {
    const [row] = await db
      .select({ userId: transactionTable.user_id, branchId: transactionTable.branch_id })
      .from(bookingTable)
      .innerJoin(transactionTable, eq(bookingTable.transaction_id, transactionTable.id))
      .where(and(eq(bookingTable.id, bookingId), eq(transactionTable.client_id, clientId)))
      .limit(1);
    return row ?? null;
  },

  /**
   * Is any of these branches a homeworker branch, or does any of these users hold the homeworker role in this org?
   * That is the rule for "handled by a homeworker" (see customer-messaging.service).
   */
  async hasHomeworkerOwner(input: { orgId: string; branchIds: string[]; userIds: string[] }): Promise<boolean> {
    if (input.branchIds.length > 0) {
      const [row] = await db
        .select({ id: branches.id })
        .from(branches)
        .where(and(inArray(branches.id, input.branchIds), eq(branches.organizationId, input.orgId), eq(branches.branchType, "homeworker")))
        .limit(1);
      if (row) return true;
    }
    if (input.userIds.length > 0) {
      const [row] = await db
        .select({ id: userOrgRoles.id })
        .from(userOrgRoles)
        .where(and(inArray(userOrgRoles.userId, input.userIds), eq(userOrgRoles.orgId, input.orgId), eq(userOrgRoles.role, "homeworker")))
        .limit(1);
      if (row) return true;
    }
    return false;
  },

  /** Throws LogUnavailableError while the log table does not exist. A sent or pending row counts. */
  async hasRecentSent(input: { orgId: string; clientId: string; purpose: string; dedupeKey: string; since: Date }): Promise<boolean> {
    return onLog(async () => {
      const [row] = await db
        .select({ id: customerMessageLog.id })
        .from(customerMessageLog)
        .where(
          and(
            eq(customerMessageLog.orgId, input.orgId),
            eq(customerMessageLog.clientId, input.clientId),
            eq(customerMessageLog.purpose, input.purpose),
            eq(customerMessageLog.dedupeKey, input.dedupeKey),
            // A reserved (pending) send counts too: it is on its way, or crashed and blocks only for the window.
            inArray(customerMessageLog.status, ["sent", "pending"]),
            gte(customerMessageLog.createdAt, input.since),
          ),
        )
        .limit(1);
      return !!row;
    });
  },

  /**
   * Reserves a send: under a Postgres advisory lock keyed on (agency, client, type, dedupe key) it checks for a
   * sent or pending row since `since` (on EITHER channel, so switching channel inside the window is still a
   * duplicate) and, if there is none, inserts this one as `pending` in the same transaction. Two sends of the same
   * message therefore cannot both pass. Returns the new row id, or null for a duplicate. Throws LogUnavailableError
   * while the log table does not exist.
   */
  async reserveSend(input: { row: InsertCustomerMessageLog; since: Date }): Promise<{ id: string } | null> {
    const { row } = input;
    return onLog(() =>
      db.transaction(async (tx) => {
        const key = `customer_message:${row.orgId}:${row.clientId ?? ""}:${row.purpose}:${row.dedupeKey ?? row.purpose}`;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
        const [existing] = await tx
          .select({ id: customerMessageLog.id })
          .from(customerMessageLog)
          .where(
            and(
              eq(customerMessageLog.orgId, row.orgId),
              row.clientId ? eq(customerMessageLog.clientId, row.clientId) : isNull(customerMessageLog.clientId),
              eq(customerMessageLog.purpose, row.purpose),
              eq(customerMessageLog.dedupeKey, row.dedupeKey ?? row.purpose),
              inArray(customerMessageLog.status, ["sent", "pending"]),
              gte(customerMessageLog.createdAt, input.since),
            ),
          )
          .limit(1);
        if (existing) return null;
        const [created] = await tx.insert(customerMessageLog).values({ ...row, status: "pending" }).returning({ id: customerMessageLog.id });
        return { id: created.id };
      }),
    );
  },

  /** Settles a reserved row as sent or skipped. */
  async finalizeLog(
    id: string,
    patch: { status: "sent" | "skipped"; reason: string | null; templateName: string | null; providerMessageId: string | null },
  ): Promise<void> {
    await onLog(async () => {
      await db
        .update(customerMessageLog)
        .set({ status: patch.status, reason: patch.reason, templateName: patch.templateName, providerMessageId: patch.providerMessageId })
        .where(eq(customerMessageLog.id, id));
    });
  },

  /** True when the log table exists. */
  async isLogAvailable(): Promise<boolean> {
    try {
      await db.select({ id: customerMessageLog.id }).from(customerMessageLog).limit(1);
      return true;
    } catch (err) {
      if (isUndefinedTable(err)) return false;
      throw err;
    }
  },

  /** Every SMS template row that can act as a switch (active or not) for the three automatic triggers. */
  async listSwitchRows(orgId: string): Promise<(ActiveSwitchRow & { id: string; active: boolean })[]> {
    return db
      .select({
        id: smsTemplatesTable.id,
        active: smsTemplatesTable.active,
        autoTrigger: smsTemplatesTable.autoTrigger,
        category: smsTemplatesTable.category,
        triggerDaysBefore: smsTemplatesTable.triggerDaysBefore,
      })
      .from(smsTemplatesTable)
      .where(and(eq(smsTemplatesTable.orgId, orgId), inArray(smsTemplatesTable.autoTrigger, ["on_booking_create", "on_pin_set", "days_before_departure"])));
  },

  /** Turns the given SMS template rows (of this agency only) on or off. */
  async setSwitchActive(orgId: string, ids: string[], active: boolean): Promise<number> {
    if (ids.length === 0) return 0;
    const rows = await db
      .update(smsTemplatesTable)
      .set({ active, updatedAt: new Date() })
      .where(and(eq(smsTemplatesTable.orgId, orgId), inArray(smsTemplatesTable.id, ids)))
      .returning({ id: smsTemplatesTable.id });
    return rows.length;
  },

  /**
   * One page of a client's message history, newest first, for ONE agency (a client of another agency reads as empty).
   * `offset` is how many rows were already shown. Throws LogUnavailableError while the table does not exist.
   */
  async listLogForClient(input: { orgId: string; clientId: string; limit: number; offset: number }): Promise<MessageLogRow[]> {
    return onLog(async () => {
      return db
        .select({
          id: customerMessageLog.id,
          purpose: customerMessageLog.purpose,
          channel: customerMessageLog.channel,
          status: customerMessageLog.status,
          reason: customerMessageLog.reason,
          templateName: customerMessageLog.templateName,
          triggerSource: customerMessageLog.triggerSource,
          triggeredByName: userTable.name,
          createdAt: customerMessageLog.createdAt,
        })
        .from(customerMessageLog)
        .leftJoin(userTable, eq(userTable.id, customerMessageLog.triggeredBy))
        .where(and(eq(customerMessageLog.orgId, input.orgId), eq(customerMessageLog.clientId, input.clientId)))
        .orderBy(desc(customerMessageLog.createdAt), desc(customerMessageLog.id))
        .limit(input.limit)
        .offset(input.offset);
    });
  },

  /**
   * Staff-pressed sign-in sends that minted a link (sent, or handed over as a wa.me fallback, or failed after minting)
   * for this client since `since`. Used as the cap's fallback count before portal_login_tokens.source exists.
   */
  async countStaffSignInSince(input: { orgId: string; clientId: string; since: Date }): Promise<number> {
    return onLog(async () => {
      const result = await db.execute(sql`select count(*)::int as n from customer_message_log
        where org_id = ${input.orgId} and client_id = ${input.clientId} and purpose = 'portal_sign_in' and trigger_source = 'staff'
          and created_at >= ${input.since} and (status = 'sent' or reason in ('staff_fallback', 'send_failed'))`);
      return Number((result.rows[0] as { n?: number } | undefined)?.n ?? 0);
    });
  },

  /** Throws LogUnavailableError while the log table does not exist. */
  async insertLog(row: InsertCustomerMessageLog): Promise<void> {
    await onLog(async () => {
      await db.insert(customerMessageLog).values(row);
    });
  },
};
