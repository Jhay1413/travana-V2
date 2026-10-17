import { describe, it, expect, beforeEach } from "vitest";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../config/database";
import { branchMembers, clientTable, enquiry_table, tasks, tickets, transaction, user } from "@shared/schema";
import { organizationMemberRemovalRepository as repo } from "./organization-member-removal.repository";
import { organizationSeatRepository } from "./organization-seat.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction, makeClient, makePackageType, makeQuote, makeBranchMember,
} from "../../test/factories";

// Verifies the REAL SQL of Remove (hand over + deactivate in one transaction) and of the
// seat count against Postgres. Written for the integration config (npm run test:integration);
// not part of `npm test`, and not run by the agent that wrote it (no test database).

let org: { id: string };
let branchA: { id: string };
let branchB: { id: string };
let leaver: { id: string };
let heir: { id: string };

async function enquiryDeal(userId: string, over: { enquiryStatus?: "LOST" | "NEW_LEAD"; deleted?: boolean } = {}) {
  const txn = await makeTransaction({
    user_id: userId, org_id: org.id, branch_id: branchA.id, status: "on_enquiry",
  });
  const holiday = await makePackageType();
  await db.insert(enquiry_table).values({
    transaction_id: txn.id,
    holiday_type_id: holiday.id,
    status: over.enquiryStatus ?? "NEW_LEAD",
    deleted_at: over.deleted ? new Date() : null,
  });
  return txn;
}

async function addTask(userId: string, entityId: string | null, completed = false) {
  const id = randomUUID();
  await db.insert(tasks).values({
    id, userId, orgId: org.id, branchId: branchA.id, completed,
    entityType: entityId ? "transaction" : null, entityId,
  });
  return id;
}

beforeEach(async () => {
  await truncateAll();
  org = await makeOrg({ seatLimit: 3 });
  branchA = await makeBranch(org.id, { name: "A" });
  branchB = await makeBranch(org.id, { name: "B" });
  leaver = await makeUser({ orgId: org.id, orgRole: "agent" });
  heir = await makeUser({ orgId: org.id, orgRole: "agent" });
  await makeBranchMember({ orgId: org.id, branchId: branchA.id, userId: leaver.id, orgRole: "agent" });
  await makeBranchMember({ orgId: org.id, branchId: branchB.id, userId: heir.id, orgRole: "agent" });
});

describe("countWorkload / reassignAndDeactivate", () => {
  it("counts only OPEN work: not Lost, deleted, booked, completed or closed", async () => {
    await enquiryDeal(leaver.id);
    await enquiryDeal(leaver.id, { enquiryStatus: "LOST" });
    await enquiryDeal(leaver.id, { deleted: true });
    const booked = await makeTransaction({ user_id: leaver.id, org_id: org.id, branch_id: branchA.id, status: "on_booking" });
    const quoteDeal = await makeTransaction({ user_id: leaver.id, org_id: org.id, branch_id: branchA.id, status: "on_quote" });
    await makeQuote({ transaction_id: quoteDeal.id, quote_status: "quoted" });
    const lostQuoteDeal = await makeTransaction({ user_id: leaver.id, org_id: org.id, branch_id: branchA.id, status: "on_quote" });
    await makeQuote({ transaction_id: lostQuoteDeal.id, quote_status: "lost" });
    await addTask(leaver.id, booked.id);
    await addTask(leaver.id, null, true);
    await db.insert(tickets).values([
      { userId: heir.id, assignedTo: leaver.id, orgId: org.id, type: "Query", subject: "open", status: "Open" },
      { userId: heir.id, assignedTo: leaver.id, orgId: org.id, type: "Query", subject: "done", status: "Resolved" },
    ]);
    await makeClient({ createdBy: leaver.id, orgId: org.id });
    await makeClient({ createdBy: leaver.id, orgId: org.id, status: "merged" });

    const counts = await repo.countWorkload(org.id, leaver.id);

    expect(counts).toEqual({ openDeals: 2, openTasks: 1, openTickets: 1, clients: 1 });
  });

  it("hands everything to the new owner's branch, deactivates the login and memberships, keeps booked deals", async () => {
    const deal = await enquiryDeal(leaver.id);
    const booked = await makeTransaction({ user_id: leaver.id, org_id: org.id, branch_id: branchA.id, status: "on_booking" });
    const dealTask = await addTask(leaver.id, deal.id);
    await db.insert(tickets).values({
      userId: leaver.id, assignedTo: leaver.id, orgId: org.id, branchId: branchA.id,
      type: "Query", subject: "open", status: "In Progress", transactionId: deal.id,
    });
    const client = await makeClient({ createdBy: leaver.id, orgId: org.id });

    const moved = await repo.reassignAndDeactivate({
      orgId: org.id, userId: leaver.id, newOwnerId: heir.id, newOwnerBranchId: branchB.id, banReason: "Removed by Test",
    });

    expect(moved).toEqual({ openDeals: 1, openTasks: 1, openTickets: 1, clients: 1 });
    const [movedDeal] = await db.select().from(transaction).where(eq(transaction.id, deal.id));
    expect(movedDeal).toMatchObject({ user_id: heir.id, branch_id: branchB.id });
    const [keptBooked] = await db.select().from(transaction).where(eq(transaction.id, booked.id));
    expect(keptBooked.user_id).toBe(leaver.id);
    const [task] = await db.select().from(tasks).where(eq(tasks.id, dealTask));
    expect(task).toMatchObject({ userId: heir.id, branchId: branchB.id });
    const [ticket] = await db.select().from(tickets).where(eq(tickets.transactionId, deal.id));
    expect(ticket).toMatchObject({ assignedTo: heir.id, branchId: branchB.id });
    const [c] = await db.select().from(clientTable).where(eq(clientTable.id, client.id));
    expect(c.createdBy).toBe(heir.id);

    const [u] = await db.select().from(user).where(eq(user.id, leaver.id));
    expect(u).toMatchObject({ banned: true, banReason: "Removed by Test" });
    const members = await db.select().from(branchMembers).where(eq(branchMembers.userId, leaver.id));
    expect(members.every((m) => m.isActive === false)).toBe(true);
  });

  it("rolls everything back when the member was already removed", async () => {
    const deal = await enquiryDeal(leaver.id);
    await db.update(user).set({ banned: true, banReason: "Removed by Someone" }).where(eq(user.id, leaver.id));

    await expect(
      repo.reassignAndDeactivate({
        orgId: org.id, userId: leaver.id, newOwnerId: heir.id, newOwnerBranchId: branchB.id, banReason: "Removed by Test",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });

    const [unchanged] = await db.select().from(transaction).where(eq(transaction.id, deal.id));
    expect(unchanged.user_id).toBe(leaver.id);
  });
});

describe("organizationSeatRepository.countUsage", () => {
  it("counts active members and pending invites, excluding suspended, removed, platform staff and referral-only", async () => {
    // leaver + heir are the 2 active members seeded above.
    const suspended = await makeUser({ orgId: org.id, orgRole: "agent" });
    await makeBranchMember({ orgId: org.id, branchId: branchA.id, userId: suspended.id, orgRole: "agent", isActive: false });
    await makeUser({ orgId: org.id, orgRole: "agent", banned: true, banReason: "Removed by X" });
    await makeUser({ orgId: org.id, role: "platform_admin" });
    await makeUser({ orgId: org.id, orgRole: "referral_agent" });
    await makeUser({ orgId: org.id, orgRole: "agent", inviteToken: "tok", inviteTokenExpiry: new Date(Date.now() + 1e9) });
    await makeUser({ orgId: org.id, orgRole: "referral_agent", inviteToken: "tok2", inviteTokenExpiry: new Date(Date.now() + 1e9) });

    await expect(organizationSeatRepository.countUsage(org.id)).resolves.toEqual({
      limit: 3, activeMembers: 2, pendingInvites: 1,
    });
  });
});
