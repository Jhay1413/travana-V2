import { describe, it, expect, beforeEach } from "vitest";
import { bookingRepository } from "../modules/booking/booking.repository";
import { randomUUID } from "crypto";
import { neonClientRepository } from "../modules/neon-client/neon-client.repository";
import { transactionRepository } from "../modules/transaction/transaction.repository";
import { ticketRepository } from "../modules/ticket/ticket.repository";
import { taskRepository } from "../modules/task/task.repository";
import { noteRepository } from "../modules/note/note.repository";
import { searchRepository } from "../modules/search/search.repository";
import { opportunitiesRepository } from "../modules/opportunities/opportunities.repository";
import { db } from "../config/database";
import { tickets, tasks } from "@shared/schema";
import type { Scope } from "./scope";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction, makeClient, makeBranchMember,
} from "../test/factories";

// Verifies the shop <-> homeworker partition (buildPartitionCond) against the
// REAL Postgres, for clients (list + by-id) and transactions (by-id).
// Not run by `npm test`; run with the integration suite.

function scopeOf(over: Partial<Scope>): Scope {
  return {
    orgId: "",
    branchId: null,
    orgRole: "agent",
    orgRoles: [],
    userId: null,
    branchType: "shop",
    ownsHomeworkerBranch: false,
    ...over,
  };
}

let org: { id: string };
let shopBranch: { id: string };
let hwBranch: { id: string }; // an owned homeworker branch
let sharedHwBranch: { id: string }; // legacy shared homeworker branch (no owner)
let agent: { id: string };
let homeworker: { id: string }; // owns hwBranch
let legacyHomeworker: { id: string }; // sits in the shared branch
let otherLegacyHomeworker: { id: string };

let shopClient: { id: string };
let hwClient: { id: string };
let legacyClient: { id: string };
let otherLegacyClient: { id: string };
let nullBranchClient: { id: string };

let shopTxn: { id: string };
let hwTxn: { id: string };
let legacyTxn: { id: string };
let nullBranchTxn: { id: string };

beforeEach(async () => {
  await truncateAll();

  org = await makeOrg();
  agent = await makeUser({ orgId: org.id });
  homeworker = await makeUser({ role: "homeworker", orgId: org.id });
  legacyHomeworker = await makeUser({ role: "homeworker", orgId: org.id });
  otherLegacyHomeworker = await makeUser({ role: "homeworker", orgId: org.id });

  shopBranch = await makeBranch(org.id, { name: "Shop" });
  hwBranch = await makeBranch(org.id, { name: "HW", branchType: "homeworker", ownerUserId: homeworker.id, profitSharePercent: "50" });
  sharedHwBranch = await makeBranch(org.id, { name: "Homeworkers", branchType: "homeworker" });
  // Memberships drive the user-picker partition (users in a homeworker branch are hidden from shop staff).
  await makeBranchMember({ orgId: org.id, branchId: shopBranch.id, userId: agent.id, orgRole: "agent" });
  await makeBranchMember({ orgId: org.id, branchId: hwBranch.id, userId: homeworker.id, orgRole: "homeworker" });
  await makeBranchMember({ orgId: org.id, branchId: sharedHwBranch.id, userId: legacyHomeworker.id, orgRole: "homeworker" });
  await makeBranchMember({ orgId: org.id, branchId: sharedHwBranch.id, userId: otherLegacyHomeworker.id, orgRole: "homeworker" });

  shopClient = await makeClient({ orgId: org.id, branchId: shopBranch.id, createdBy: agent.id });
  hwClient = await makeClient({ orgId: org.id, branchId: hwBranch.id, createdBy: homeworker.id });
  legacyClient = await makeClient({ orgId: org.id, branchId: sharedHwBranch.id, createdBy: legacyHomeworker.id });
  otherLegacyClient = await makeClient({ orgId: org.id, branchId: sharedHwBranch.id, createdBy: otherLegacyHomeworker.id });
  nullBranchClient = await makeClient({ orgId: org.id, branchId: null, createdBy: agent.id });

  shopTxn = await makeTransaction({ user_id: agent.id, org_id: org.id, branch_id: shopBranch.id });
  hwTxn = await makeTransaction({ user_id: homeworker.id, org_id: org.id, branch_id: hwBranch.id });
  legacyTxn = await makeTransaction({ user_id: legacyHomeworker.id, org_id: org.id, branch_id: sharedHwBranch.id });
  nullBranchTxn = await makeTransaction({ user_id: agent.id, org_id: org.id, branch_id: null });
});

const asSmm = () =>
  scopeOf({ orgId: org.id, orgRole: "social_media_manager", orgRoles: ["social_media_manager"], branchId: shopBranch.id, userId: "smm" });
const asAgent = () => scopeOf({ orgId: org.id, orgRole: "agent", orgRoles: ["agent"], branchId: shopBranch.id, userId: agent.id });
const asOrgAdmin = () => scopeOf({ orgId: org.id, orgRole: "org_admin", orgRoles: ["org_admin"], userId: "admin" });
const asOwnHomeworker = () =>
  scopeOf({
    orgId: org.id, orgRole: "homeworker", orgRoles: ["homeworker"], branchId: hwBranch.id, userId: homeworker.id,
    branchType: "homeworker", ownsHomeworkerBranch: true,
  });
const asLegacyHomeworker = () =>
  scopeOf({
    orgId: org.id, orgRole: "homeworker", orgRoles: ["homeworker"], branchId: sharedHwBranch.id, userId: legacyHomeworker.id,
    branchType: "homeworker", ownsHomeworkerBranch: false,
  });

describe("partition: shop agent", () => {
  it("cannot list or open a homeworker's clients", async () => {
    const ids = (await neonClientRepository.findAll(asAgent())).map((c) => c.id);
    expect(ids).not.toContain(hwClient.id);
    expect(ids).not.toContain(legacyClient.id);
    expect(await neonClientRepository.findById(hwClient.id, asAgent())).toBeUndefined();
    expect(await neonClientRepository.findById(legacyClient.id, asAgent())).toBeUndefined();
  });

  it("cannot open a homeworker's transaction", async () => {
    expect(await bookingRepository.transactionInScope(hwTxn.id, asAgent())).toBe(false);
    expect(await bookingRepository.transactionInScope(legacyTxn.id, asAgent())).toBe(false);
  });

  it("still sees shop rows and legacy rows with a NULL branch_id", async () => {
    const ids = (await neonClientRepository.findAll(asAgent())).map((c) => c.id);
    expect(ids).toContain(shopClient.id);
    expect(ids).toContain(nullBranchClient.id);
    expect(await bookingRepository.transactionInScope(shopTxn.id, asAgent())).toBe(true);
    expect(await bookingRepository.transactionInScope(nullBranchTxn.id, asAgent())).toBe(true);
  });
});

describe("partition: homeworker in their own branch", () => {
  it("sees only their own client and transaction", async () => {
    const ids = (await neonClientRepository.findAll(asOwnHomeworker())).map((c) => c.id);
    expect(ids).toEqual([hwClient.id]);
    expect(await neonClientRepository.findById(shopClient.id, asOwnHomeworker())).toBeUndefined();
    expect(await bookingRepository.transactionInScope(hwTxn.id, asOwnHomeworker())).toBe(true);
    expect(await bookingRepository.transactionInScope(shopTxn.id, asOwnHomeworker())).toBe(false);
    expect(await bookingRepository.transactionInScope(nullBranchTxn.id, asOwnHomeworker())).toBe(false);
  });
});

describe("partition: legacy homeworker in the shared branch", () => {
  it("sees only their own rows, not other homeworkers' or shop rows", async () => {
    const ids = (await neonClientRepository.findAll(asLegacyHomeworker())).map((c) => c.id);
    expect(ids).toEqual([legacyClient.id]);
    expect(ids).not.toContain(otherLegacyClient.id);
    expect(await bookingRepository.transactionInScope(legacyTxn.id, asLegacyHomeworker())).toBe(true);
    expect(await bookingRepository.transactionInScope(shopTxn.id, asLegacyHomeworker())).toBe(false);
  });
});

describe("partition: org_admin", () => {
  it("sees every client and transaction in the org", async () => {
    const ids = (await neonClientRepository.findAll(asOrgAdmin())).map((c) => c.id).sort();
    expect(ids).toEqual(
      [shopClient.id, hwClient.id, legacyClient.id, otherLegacyClient.id, nullBranchClient.id].sort(),
    );
    for (const t of [shopTxn, hwTxn, legacyTxn, nullBranchTxn]) {
      expect(await bookingRepository.transactionInScope(t.id, asOrgAdmin())).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Extended coverage: transaction lists/pipeline/stats, tickets, tasks, notes,
// search and opportunities, for shop agent, social_media_manager, own-branch
// homeworker, legacy homeworker and org_admin.
// ---------------------------------------------------------------------------

let hwTicket: { id: string };
let shopTicket: { id: string };
let legacyTicket: { id: string };
let nullBranchLegacyTicket: { id: string };
let hwTask: { id: string };
let shopTask: { id: string };
let legacyTask: { id: string };

async function seedTicket(userId: string, branchId: string | null) {
  const [row] = await db.insert(tickets).values({ userId, orgId: org.id, branchId, type: "General", subject: "S" }).returning();
  return row;
}
async function seedTask(userId: string, branchId: string | null) {
  const [row] = await db.insert(tasks).values({ id: randomUUID(), userId, orgId: org.id, branchId, title: "T" } as never).returning();
  return row;
}

describe("partition: transactions list, pipeline and stats", () => {
  const ids = async (s: Scope) => (await transactionRepository.findAllLightweight(s)).map((t: { id: string }) => t.id);

  it("shop agent and social_media_manager never see homeworker deals", async () => {
    for (const s of [asAgent(), asSmm()]) {
      const seen = await ids(s);
      expect(seen).not.toContain(hwTxn.id);
      expect(seen).not.toContain(legacyTxn.id);
    }
    expect(await ids(asAgent())).toContain(shopTxn.id);
  });

  it("an own-branch homeworker sees only their deal; a legacy homeworker only theirs", async () => {
    expect(await ids(asOwnHomeworker())).toEqual([hwTxn.id]);
    expect(await ids(asLegacyHomeworker())).toEqual([legacyTxn.id]);
  });

  it("org_admin sees every deal", async () => {
    const seen = await ids(asOrgAdmin());
    for (const t of [shopTxn, hwTxn, legacyTxn, nullBranchTxn]) expect(seen).toContain(t.id);
  });

  it("stats and pipeline respect the partition", async () => {
    const adminStats = await transactionRepository.getStats(asOrgAdmin());
    const agentStats = await transactionRepository.getStats(asAgent());
    expect(Number(agentStats.total)).toBeLessThan(Number(adminStats.total));
    const pipeline = await transactionRepository.findPipelineByStatus(asAgent(), "enquiry", 1, 50);
    expect(pipeline.items.map((i: { id: string }) => i.id)).not.toContain(hwTxn.id);
  });

  it("a shop agent cannot update or delete a homeworker's deal", async () => {
    expect(await transactionRepository.remove(hwTxn.id, asAgent())).toBe(false);
    expect(await transactionRepository.update(hwTxn.id, {}, asAgent())).toBeUndefined();
  });
});

describe("partition: tickets and tasks", () => {
  beforeEach(async () => {
    hwTicket = await seedTicket(homeworker.id, hwBranch.id);
    shopTicket = await seedTicket(agent.id, shopBranch.id);
    legacyTicket = await seedTicket(legacyHomeworker.id, sharedHwBranch.id);
    nullBranchLegacyTicket = await seedTicket(homeworker.id, null);
    hwTask = await seedTask(homeworker.id, hwBranch.id);
    shopTask = await seedTask(agent.id, shopBranch.id);
    legacyTask = await seedTask(legacyHomeworker.id, sharedHwBranch.id);
  });

  it("tickets: shop agent / social_media_manager cannot list or open a homeworker's", async () => {
    for (const s of [asAgent(), asSmm()]) {
      const seen = (await ticketRepository.findAll(s, s.userId)).map((t: { id: string }) => t.id);
      expect(seen).not.toContain(hwTicket.id);
      expect(seen).not.toContain(legacyTicket.id);
      expect(await ticketRepository.findById(hwTicket.id, s, s.userId)).toBeUndefined();
    }
  });

  it("tickets: own-branch homeworker sees their ticket and their legacy NULL-branch ticket, not the shop's", async () => {
    const s = asOwnHomeworker();
    const seen = (await ticketRepository.findAll(s, s.userId)).map((t: { id: string }) => t.id);
    expect(seen).toContain(hwTicket.id);
    expect(seen).toContain(nullBranchLegacyTicket.id);
    expect(seen).not.toContain(shopTicket.id);
    expect(seen).not.toContain(legacyTicket.id);
  });

  it("tickets: legacy homeworker sees only their own", async () => {
    const s = asLegacyHomeworker();
    const seen = (await ticketRepository.findAll(s, s.userId)).map((t: { id: string }) => t.id);
    expect(seen).toEqual([legacyTicket.id]);
  });

  it("tickets: org_admin sees all", async () => {
    const seen = (await ticketRepository.findAll(asOrgAdmin(), null)).map((t: { id: string }) => t.id);
    for (const t of [hwTicket, shopTicket, legacyTicket, nullBranchLegacyTicket]) expect(seen).toContain(t.id);
  });

  it("tasks: shop agent / social_media_manager cannot open a homeworker's task", async () => {
    for (const s of [asAgent(), asSmm()]) {
      expect(await taskRepository.findById(hwTask.id, s)).toBeUndefined();
      expect(await taskRepository.findById(legacyTask.id, s)).toBeUndefined();
    }
  });

  it("tasks: homeworkers see only their own, org_admin sees all", async () => {
    expect(await taskRepository.findById(hwTask.id, asOwnHomeworker())).toBeDefined();
    expect(await taskRepository.findById(shopTask.id, asOwnHomeworker())).toBeUndefined();
    expect(await taskRepository.findById(legacyTask.id, asLegacyHomeworker())).toBeDefined();
    expect(await taskRepository.findById(hwTask.id, asLegacyHomeworker())).toBeUndefined();
    expect(await taskRepository.findById(hwTask.id, asOrgAdmin())).toBeDefined();
  });
});

describe("partition: notes, search and opportunities", () => {
  it("notes: ownership checks go through the partition", async () => {
    expect(await noteRepository.transactionBelongsToOrg(hwTxn.id, org.id, asAgent())).toBe(false);
    expect(await noteRepository.clientBelongsToOrg(hwClient.id, org.id, asSmm())).toBe(false);
    expect(await noteRepository.transactionBelongsToOrg(hwTxn.id, org.id, asOwnHomeworker())).toBe(true);
    expect(await noteRepository.clientBelongsToOrg(legacyClient.id, org.id, asLegacyHomeworker())).toBe(true);
    expect(await noteRepository.clientBelongsToOrg(hwClient.id, org.id, asOrgAdmin())).toBe(true);
    expect(await noteRepository.clientBelongsToOrg(nullBranchClient.id, org.id, asAgent())).toBe(true);
  });

  it("search: shop staff never find homeworker clients; homeworkers find only their own", async () => {
    const find = async (s: Scope) =>
      (await searchRepository.globalSearch("Client", { orgId: org.id, scope: s })).clients.map((c: { id: string }) => c.id);
    for (const s of [asAgent(), asSmm()]) {
      const seen = await find(s);
      expect(seen).not.toContain(hwClient.id);
      expect(seen).not.toContain(legacyClient.id);
      expect(seen).toContain(shopClient.id);
    }
    expect(await find(asOwnHomeworker())).toEqual([hwClient.id]);
    expect(await find(asLegacyHomeworker())).toEqual([legacyClient.id]);
    expect(await find(asOrgAdmin())).toHaveLength(5);
  });

  it("opportunities: the org-wide agent picker hides homeworker users from shop staff", async () => {
    const agents = async (s: Scope) =>
      (await opportunitiesRepository.findAgentsInOrg(org.id, null, s)).map((u: { id: string }) => u.id);
    const seen = await agents(asSmm());
    expect(seen).not.toContain(homeworker.id);
    expect(seen).not.toContain(legacyHomeworker.id);
    expect(seen).toContain(agent.id);
    expect(await agents(asOrgAdmin())).toEqual(expect.arrayContaining([agent.id, homeworker.id, legacyHomeworker.id]));
  });
});
