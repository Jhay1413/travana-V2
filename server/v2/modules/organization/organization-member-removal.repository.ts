import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { db } from "../../config/database";
import { branchMembers, clientTable, tasks, tickets, transaction, user } from "@shared/schema";
import { AppError } from "../../utils/error-handler";
import type { MemberWorkload } from "./organization.types";
import {
  activeClientCond,
  openDealCond,
  openTaskCond,
  openTicketCond,
  tasksOfDealsCond,
} from "./organization-member-removal.sql";

export interface ReassignAndDeactivateInput {
  orgId:            string;
  userId:           string;
  /** Who inherits the open work; null when there is none to hand over. */
  newOwnerId:       string | null;
  /** The new owner's active shop branch; moved deals are re-homed into it. */
  newOwnerBranchId: string | null;
  /** Written to user.banReason, e.g. "Removed by Alex". */
  banReason:        string;
}

async function countRows(table: PgTable, where: SQL): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return Number(row?.n ?? 0);
}

export const organizationMemberRemovalRepository = {
  async countWorkload(orgId: string, userId: string): Promise<MemberWorkload> {
    const [openDeals, openTasks, openTickets, clients] = await Promise.all([
      countRows(transaction, openDealCond(orgId, userId)),
      countRows(tasks, openTaskCond(orgId, userId)),
      countRows(tickets, openTicketCond(orgId, userId)),
      countRows(clientTable, activeClientCond(orgId, userId)),
    ]);
    return { openDeals, openTasks, openTickets, clients };
  },

  /**
   * One transaction, all or nothing: hand the open work to the new owner, then
   * deactivate the login and every membership. History (user_org_roles, booked
   * deals, notes, audit) is untouched. Throws 409 (rolling everything back) when
   * the member was already removed by someone else in the meantime.
   */
  async reassignAndDeactivate(input: ReassignAndDeactivateInput): Promise<MemberWorkload> {
    const { orgId, userId, newOwnerId, newOwnerBranchId, banReason } = input;
    return db.transaction(async (tx) => {
      const moved: MemberWorkload = { openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 };

      if (newOwnerId) {
        const dealPatch: { user_id: string; branch_id?: string } = { user_id: newOwnerId };
        if (newOwnerBranchId) dealPatch.branch_id = newOwnerBranchId;
        const dealRows = await tx
          .update(transaction)
          .set(dealPatch)
          .where(openDealCond(orgId, userId))
          .returning({ id: transaction.id });
        moved.openDeals = dealRows.length;

        // Everything attached to a moved deal follows it into the new owner's branch.
        if (dealRows.length > 0 && newOwnerBranchId) {
          const dealIds = dealRows.map((r) => r.id);
          await tx.update(tasks).set({ branchId: newOwnerBranchId }).where(tasksOfDealsCond(dealIds));
          await tx.update(tickets).set({ branchId: newOwnerBranchId }).where(inArray(tickets.transactionId, dealIds));
        }

        const taskRows = await tx
          .update(tasks)
          .set({ userId: newOwnerId })
          .where(openTaskCond(orgId, userId))
          .returning({ id: tasks.id });
        moved.openTasks = taskRows.length;

        const ticketRows = await tx
          .update(tickets)
          .set({ assignedTo: newOwnerId, updatedAt: new Date() })
          .where(openTicketCond(orgId, userId))
          .returning({ id: tickets.id });
        moved.openTickets = ticketRows.length;

        const clientRows = await tx
          .update(clientTable)
          .set({ createdBy: newOwnerId })
          .where(activeClientCond(orgId, userId))
          .returning({ id: clientTable.id });
        moved.clients = clientRows.length;
      }

      const deactivated = await tx
        .update(user)
        .set({
          banned: true,
          banReason,
          resetToken: null,
          resetTokenExpiry: null,
          updatedAt: new Date(),
        })
        .where(and(eq(user.id, userId), sql`${user.banned} IS NOT TRUE`))
        .returning({ id: user.id });
      if (deactivated.length !== 1) {
        throw new AppError("This member has already been removed", 409);
      }

      await tx
        .update(branchMembers)
        .set({ isActive: false })
        .where(and(eq(branchMembers.orgId, orgId), eq(branchMembers.userId, userId)));

      return moved;
    });
  },
};
